import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegistrasisDummy } from './entities/registrasis-dummy.entity';
import { Pasien } from './entities/pasien.entity';
import { Registrasi } from './entities/registrasi.entity';
import { Poli } from './entities/poli.entity';
import { AntrianPoli } from './entities/antrian-poli.entity';
import { Nomorrm } from './entities/nomorrm.entity';
import { Pegawai } from './entities/pegawai.entity';
import { HistoriStatus } from './entities/histori-status.entity';
import { Historipengunjung } from './entities/histori-pengunjung.entity';
import { HistorikunjunganIRJ } from './entities/histori-kunjungan-irj.entity';
import { BpjsRencanaKontrol } from './entities/bpjs-rencana-kontrol.entity';
import * as crypto from 'crypto';
import * as LZString from 'lz-string';
import { Like, DataSource } from 'typeorm';

@Injectable()
export class BpjsService {
    private readonly logger = new Logger(BpjsService.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        private readonly dataSource: DataSource,
        @InjectRepository(RegistrasisDummy)
        private readonly registrasisRepository: Repository<RegistrasisDummy>,
        @InjectRepository(Pasien)
        private readonly pasiensRepository: Repository<Pasien>,
        @InjectRepository(Registrasi)
        private readonly registrasisTableRepository: Repository<Registrasi>,
        @InjectRepository(Poli)
        private readonly polisRepository: Repository<Poli>,
        @InjectRepository(AntrianPoli)
        private readonly antrianPoliRepository: Repository<AntrianPoli>,
        @InjectRepository(Nomorrm)
        private readonly nomorrmsRepository: Repository<Nomorrm>,
        @InjectRepository(Pegawai)
        private readonly pegawaisRepository: Repository<Pegawai>,
        @InjectRepository(HistoriStatus)
        private readonly historiStatusRepository: Repository<HistoriStatus>,
        @InjectRepository(Historipengunjung)
        private readonly historiPengunjungRepository: Repository<Historipengunjung>,
        @InjectRepository(HistorikunjunganIRJ)
        private readonly historiKunjunganIrjRepository: Repository<HistorikunjunganIRJ>,
        @InjectRepository(BpjsRencanaKontrol)
        private readonly bpjsRencanaKontrolRepository: Repository<BpjsRencanaKontrol>,
    ) { }

    private getServiceConfig(service: 'antrean' | 'vclaim') {
        const prefix = service.toUpperCase();
        return {
            baseUrl: this.configService.get<string>(`${prefix}_BASE_URL`) || '',
            consId: this.configService.get<string>(`${prefix}_CONS_ID`) || '',
            secretKey: this.configService.get<string>(`${prefix}_SECRET_KEY`) || '',
            userKey: this.configService.get<string>(`${prefix}_USER_KEY`) || '',
        };
    }

    generateHeaders(timestamp: string, service: 'antrean' | 'vclaim', contentType: string = 'application/json') {
        const { consId, secretKey, userKey } = this.getServiceConfig(service);

        if (!consId || !secretKey || !userKey) {
            this.logger.error(`BPJS configuration missing for ${service}`);
            throw new Error(`BPJS configuration missing for ${service}. Please check your .env file.`);
        }

        const data = `${consId}&${timestamp}`;
        const signature = crypto
            .createHmac('sha256', secretKey)
            .update(data)
            .digest('base64');

        return {
            'X-cons-id': consId,
            'X-timestamp': timestamp,
            'X-signature': signature,
            'user_key': userKey,
            'Content-Type': contentType,
        };
    }

    decryptResponse(encryptedData: string, timestamp: string, service: 'antrean' | 'vclaim'): any {
        try {
            const { consId, secretKey } = this.getServiceConfig(service);
            const key = `${consId}${secretKey}${timestamp}`;
            const hash = crypto.createHash('sha256').update(key).digest();
            const aesKey = hash.slice(0, 32);
            const iv = hash.slice(0, 16);

            const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
            let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
            decrypted += decipher.final('utf8');

            const decompressed = LZString.decompressFromEncodedURIComponent(decrypted);

            try {
                return JSON.parse(decompressed);
            } catch (e) {
                return decompressed;
            }
        } catch (error) {
            this.logger.error(`Failed to decrypt BPJS response for ${service}`, error.stack);
            throw new Error('Decryption failed');
        }
    }

    private async makeRequest(service: 'antrean' | 'vclaim', method: 'get' | 'post', path: string, payload?: any, contentType?: string) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        let config: any = {};
        try {
            config = this.getServiceConfig(service);
            const headers = this.generateHeaders(timestamp, service, contentType);
            const url = `${config.baseUrl}${path}`;

            const response = await firstValueFrom(
                method === 'get'
                    ? this.httpService.get(url, { headers })
                    : this.httpService.post(url, payload, { headers })
            );

            if (!response || !response.data) {
                this.logger.error(`Empty response from BPJS API ${service} (${path})`);
                throw new Error(`Empty response from BPJS API`);
            }

            const encryptedResponse = response.data.response;
            const metadata = response.data.metadata || response.data.metaData;

            if (!metadata) {
                this.logger.error(`Missing metadata in BPJS API response ${service} (${path}). Raw data: ${JSON.stringify(response.data)}`);
                return response.data;
            }

            // Normalisasi code ke number untuk pengecekan
            const code = Number(metadata.code);

            if ((code === 200 || code === 1) && typeof encryptedResponse === 'string') {
                const decryptedData = this.decryptResponse(encryptedResponse, timestamp, service);
                return {
                    ...response.data,
                    response: decryptedData,
                };
            }

            return response.data;
        } catch (error) {
            const status = error.response?.status || 500;
            const errorData = error.response?.data;
            const errorMessage = error.message;

            this.logger.error(`[BPJS BRIDGE ERROR] ${service} (${path}): ${errorMessage}`);
            if (errorData) {
                this.logger.error(`BPJS raw error response: ${JSON.stringify(errorData)}`);
            }

            // Return a structured error that doesn't trigger NestJS 500 Internal Server Error
            return {
                metaData: {
                    code: status,
                    message: `Bridge Error: ${errorMessage}`,
                    source: service.toUpperCase(),
                },
                response: errorData || null,
                _debug: {
                    path,
                    timestamp,
                    baseUrl: config.baseUrl
                }
            };
        }
    }

    // Antrean RS Methods
    async getRefPoli() { return this.makeRequest('antrean', 'get', '/ref/poli'); }
    async getRefDokter() { return this.makeRequest('antrean', 'get', '/ref/dokter'); }
    async getJadwalDokter(kodepoli: string, tanggal: string) {
        return this.makeRequest('antrean', 'get', `/jadwaldokter/kodepoli/${kodepoli}/tanggal/${tanggal}`);
    }
    async getRefPoliFP() { return this.makeRequest('antrean', 'get', '/ref/poli/fp'); }
    async getRefPasienFP(identitas: string, noidentitas: string) {
        return this.makeRequest('antrean', 'get', `/ref/pasien/fp/identitas/${identitas}/noidentitas/${noidentitas}`);
    }
    async getListTask(data: any) { return this.makeRequest('antrean', 'post', '/antrean/getlisttask', data); }
    async addAntrean(data: any) { return this.makeRequest('antrean', 'post', '/antrean/add', data); }
    async updateWaktuAntrean(data: any) { return this.makeRequest('antrean', 'post', '/antrean/updatewaktu', data); }
    async getDashboardWaktuTungguTanggal(tanggal: string, waktu: string) {
        return this.makeRequest('antrean', 'get', `/dashboard/waktutunggu/tanggal/${tanggal}/waktu/${waktu}`);
    }
    async getDashboardWaktuTungguBulan(bulan: string, tahun: string, waktu: string) {
        return this.makeRequest('antrean', 'get', `/dashboard/waktutunggu/bulan/${bulan}/tahun/${tahun}/waktu/${waktu}`);
    }
    async getPendaftaranTanggal(tanggal: string) {
        return this.makeRequest('antrean', 'get', `/antrean/pendaftaran/tanggal/${tanggal}`);
    }
    async getPendaftaranByKodeBooking(kodeBooking: string) {
        return this.makeRequest('antrean', 'get', `/antrean/pendaftaran/kodebooking/${kodeBooking}`);
    }
    async getPendaftaranAktif() { return this.makeRequest('antrean', 'get', '/antrean/pendaftaran/aktif'); }
    async getPendaftaranSpesifik(kodepoli: string, kodedokter: string, hari: string, jampraktek: string) {
        return this.makeRequest('antrean', 'get', `/antrean/pendaftaran/kodepoli/${kodepoli}/kodedokter/${kodedokter}/hari/${hari}/jampraktek/${jampraktek}`);
    }

    // VClaim Methods
    async getPesertaByNoKartu(noKartu: string, tglSep: string) {
        return this.makeRequest('vclaim', 'get', `/Peserta/nokartu/${noKartu}/tglSEP/${tglSep}`);
    }

    async getPesertaByNIK(nik: string, tglSep: string) {
        return this.makeRequest('vclaim', 'get', `/Peserta/nik/${nik}/tglSEP/${tglSep}`);
    }

    async getSepDetail(noSep: string) {
        return this.makeRequest('vclaim', 'get', `/SEP/${noSep}`);
    }

    async getLastSepByNoRujukan(noRujukan: string) {
        return this.makeRequest('vclaim', 'get', `/Rujukan/lastsep/norujukan/${noRujukan}`);
    }

    async getRujukanByNoRujukan(noRujukan: string) {
        return this.makeRequest('vclaim', 'get', `/Rujukan/${noRujukan}`);
    }

    async getRujukanByNoKartu(noKartu: string) {
        return this.makeRequest('vclaim', 'get', `/Rujukan/Peserta/${noKartu}`);
    }

    async getRujukanListByNoKartu(noKartu: string) {
        return this.makeRequest('vclaim', 'get', `/Rujukan/RS/List/Peserta/${noKartu}`);
    }

    async insertSep(data: any) {
        return this.makeRequest('vclaim', 'post', '/SEP/1.1/insert', JSON.stringify(data), 'Application/x-www-form-urlencoded');
    }

    async insertSepV2(data: any) {
        return this.makeRequest('vclaim', 'post', '/SEP/2.0/insert', JSON.stringify(data), 'Application/x-www-form-urlencoded');
    }

    async createSepWithBusinessLogic(body: any) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const { id_reg_dum, dokter_id, vclaim_data } = body;
            const dokterParts = dokter_id.split('_'); // [id, nama, jam, poli_bpjs]
            const kodePoliBpjs = dokterParts[3];
            const today = new Date().toISOString().split('T')[0];

            // 1. Get/Verify RegistrasiDummy
            const regDummy = await queryRunner.manager.findOne(RegistrasisDummy, {
                where: { id: id_reg_dum, tglperiksa: today }
            });

            if (!regDummy) {
                return { metaData: { code: 201, message: 'Maaf, Tidak dapat checkin, cek tanggal periksa' } };
            }

            // 2. Queue Logic (AntrianPoli)
            const poli = await queryRunner.manager.findOne(Poli, { where: { bpjs: kodePoliBpjs } });
            if (!poli) {
                return { metaData: { code: 201, message: 'Poli tidak ditemukan' } };
            }

            const antrianCount = await queryRunner.manager.count(AntrianPoli, {
                where: { tanggal: today, kelompok: poli.kelompok }
            });
            const nomorAntrian = antrianCount + 1;

            const antrian = queryRunner.manager.create(AntrianPoli, {
                nomor: nomorAntrian,
                suara: `${nomorAntrian}.mp3`,
                status: 0,
                panggil: 1,
                poli_id: poli.id,
                tanggal: today,
                loket: poli.loket,
                kelompok: poli.kelompok,
            });
            const savedAntrian = await queryRunner.manager.save(antrian);

            // 3. Patient Logic
            let pasien = await queryRunner.manager.findOne(Pasien, { where: { no_rm: regDummy.no_rm } });
            if (!pasien) {
                pasien = queryRunner.manager.create(Pasien, {
                    nama: body.nama?.toUpperCase(),
                    nik: body.nik,
                    tgllahir: body.tanggallahir,
                    kelamin: body.jeniskelamin,
                    alamat: body.alamat?.toUpperCase(),
                    tgldaftar: today,
                    nohp: body.nohp,
                    negara: 'Indonesia',
                    no_jkn: body.nomorkartu,
                    user_create: 'APM-KIOSK',
                });
                pasien = await queryRunner.manager.save(pasien);

                // Create Nomor RM
                const rmCount = await queryRunner.manager.count(Nomorrm);
                const rms = queryRunner.manager.create(Nomorrm, {
                    pasien_id: pasien.id,
                    no_rm: (rmCount + 769695).toString()
                });
                const savedRms = await queryRunner.manager.save(rms);
                pasien.no_rm = savedRms.id.toString();
                await queryRunner.manager.save(pasien);
            }

            // 4. Registrasi Table
            const regCount = await queryRunner.manager.count(Registrasi, {
                where: { reg_id: Like(`${today.replace(/-/g, '')}%`) }
            });

            const registrasi = queryRunner.manager.create(Registrasi, {
                input_from: 'APM',
                antrian_poli_id: savedAntrian.id,
                nomorantrian: regDummy.kodebooking,
                nomorantrian_jkn: regDummy.nomorantrian,
                pasien_id: pasien.id,
                reg_id: today.replace(/-/g, '') + String(regCount + 1).padStart(4, '0'),
                status: 1,
                dokter_id: parseInt(dokterParts[0]),
                poli_id: poli.id,
                bayar: '1',
                no_jkn: pasien.no_jkn,
                no_rujukan: body.no_rujukan,
                jenis_pasien: '1',
                posisiberkas_id: '2',
                status_reg: 'J1',
            });
            const savedReg = await queryRunner.manager.save(registrasi);

            // 5. History Logging
            await queryRunner.manager.save(HistoriStatus, {
                registrasi_id: savedReg.id,
                status: 'J1',
                poli_id: savedReg.poli_id,
                pengirim_rujukan: 1,
            });

            await queryRunner.manager.save(Historipengunjung, {
                registrasi_id: savedReg.id,
                pasien_id: pasien.id,
                pengirim_rujukan: 1,
                politipe: 'J',
                status_pasien: 'LAMA',
            });

            await queryRunner.manager.save(HistorikunjunganIRJ, {
                registrasi_id: savedReg.id,
                pasien_id: pasien.id,
                poli_id: poli.id,
                dokter_id: registrasi.dokter_id,
                pengirim_rujukan: '1',
            });

            // 6. Update Dummy Status
            regDummy.status = 'checkin';
            regDummy.no_rm = pasien.no_rm;
            regDummy.registrasi_id = savedReg.id;
            await queryRunner.manager.save(regDummy);

            // 7. Call BPJS Bridge
            const bpjsResponse = await this.insertSepV2(vclaim_data);

            await queryRunner.commitTransaction();
            return {
                metaData: { code: 200, message: 'Berhasil Checkin' },
                response: {
                    registrasi_id: savedReg.id,
                    no_rm: pasien.no_rm,
                    bpjs: bpjsResponse
                }
            };

        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Error in createSepWithBusinessLogic: ${error.message}`, error.stack);
            return {
                metaData: {
                    code: 500,
                    message: `Internal Server Error: ${error.message}`
                }
            };
        } finally {
            await queryRunner.release();
        }
    }

    // Custom Local Database Methods
    async findKodeBooking(identifier: string, tanggal?: string): Promise<string | null> {
        try {
            let targetDate = tanggal;

            if (!targetDate) {
                // Get today's date in YYYY-MM-DD format (WIB)
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                targetDate = `${year}-${month}-${day}`;
            }

            this.logger.log(`Searching for identifier: '${identifier}' in registrasis_dummy for date: ${targetDate}...`);

            const result = await this.registrasisRepository.findOne({
                where: [
                    { no_rm: identifier, tglperiksa: targetDate },
                    { nik: identifier, tglperiksa: targetDate },
                    { nomorkartu: identifier, tglperiksa: targetDate },
                    { nomorantrian: identifier, tglperiksa: targetDate },
                ],
                select: ['kodebooking'],
                order: { id: 'DESC' } // Prioritaskan data yang paling baru masuk
            });

            if (result) {
                this.logger.log(`Found booking: ${result.kodebooking} for identifier: ${identifier}`);
                return result.kodebooking;
            } else {
                this.logger.warn(`No booking found for identifier: ${identifier} on date ${targetDate}`);
                return null;
            }
        } catch (error) {
            this.logger.error(`Error finding booking in local DB for identifier ${identifier}: ${error.message}`, error.stack);
            throw error;
        }
    }

    async findAndGetBooking(identifier: string, tanggal?: string) {
        try {
            const kodeBooking = await this.findKodeBooking(identifier, tanggal);
            if (!kodeBooking) {
                return {
                    metaData: {
                        code: 201,
                        message: `Kode booking tidak ditemukan di database lokal untuk identifier tersebut pada tanggal ${tanggal || 'hari ini'}.`,
                    },
                    response: null
                };
            }
            return await this.getPendaftaranByKodeBooking(kodeBooking);
        } catch (error) {
            this.logger.error(`Error in findAndGetBooking for identifier ${identifier}: ${error.message}`, error.stack);
            return {
                metaData: {
                    code: 500,
                    message: "Terjadi kesalahan internal saat mencari data (Cek Log Server).",
                    details: error.message
                },
                response: null
            };
        }
    }

    async generateSepInsertV2Payload(identifier: string) {
        try {
            // Use Local Date (WIB/Server Time)
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            this.logger.log(`Generating SEP Payload for identifier: ${identifier} on date: ${today}`);

            // 1. Search for records today
            const recordsToday = await this.registrasisRepository.find({
                where: [
                    { kodebooking: identifier, tglperiksa: today },
                    { no_rm: identifier, tglperiksa: today },
                    { nik: identifier, tglperiksa: today },
                    { nomorkartu: identifier, tglperiksa: today },
                ],
                order: { id: 'DESC' }
            });

            if (recordsToday.length > 1) {
                return {
                    metaData: {
                        code: 201,
                        message: `[KODE V3] Ditemukan ${recordsToday.length} pendaftaran untuk '${identifier}' hari ini. Silakan gunakan Kode Booking agar lebih spesifik.`,
                        _found: recordsToday.map(r => ({ kodebooking: r.kodebooking, poli: r.kode_poli }))
                    }
                };
            }

            let regDummy = recordsToday[0];

            if (!regDummy) {
                // Diagnostic: Check if data exists for ANY other date
                const anyRecord = await this.registrasisRepository.findOne({
                    where: [
                        { kodebooking: identifier },
                        { no_rm: identifier },
                        { nik: identifier },
                        { nomorkartu: identifier },
                    ],
                    order: { tglperiksa: 'DESC', id: 'DESC' }
                });

                if (anyRecord) {
                    return {
                        metaData: {
                            code: 201,
                            message: `[KODE V3] Data ditemukan untuk tanggal ${anyRecord.tglperiksa}, namun pencarian dibatasi untuk hari ini (${today}).`
                        }
                    };
                }

                return { metaData: { code: 201, message: `[KODE V3] Data pendaftaran untuk '${identifier}' tidak ditemukan di database untuk hari ini maupun tanggal lain.` } };
            }

            // Fetch supplementary data (Rujukan, Peserta, Rencana Kontrol) - Fail-safe
            let rujukan: any = null;
            let peserta: any = null;
            let renkon: BpjsRencanaKontrol | null = null;
            let isRanap = false;
            let reqPoli = regDummy.kode_poli || '';

            try {
                // 1. Check for Control Plan
                if (regDummy.registrasi_id) {
                    renkon = await this.bpjsRencanaKontrolRepository.findOneBy({ registrasi_id: regDummy.registrasi_id });
                }

                // 2. Fetch Referral (Rujukan)
                if (regDummy.no_rujukan) {
                    const rujukanResponse = await this.getRujukanByNoRujukan(regDummy.no_rujukan);
                    if (rujukanResponse?.metaData?.code == 200) {
                        rujukan = rujukanResponse.response?.rujukan;
                        if (rujukan) {
                            isRanap = rujukan.pelayanan?.kode === '1';
                            if (!reqPoli) reqPoli = rujukan.poliRujukan?.kode;
                        }
                    }
                }

                // 3. Fetch Patient Info (Peserta)
                const pesertaResponse = await this.getPesertaByNoKartu(regDummy.nomorkartu, today);
                if (pesertaResponse?.metaData?.code == 200) {
                    peserta = pesertaResponse.response?.peserta;
                }
            } catch (err) {
                this.logger.warn(`Failed to fetch supplementary BPJS data: ${err.message}`);
            }

            // Logic for default values and overrides from BpjsRencanaKontrol
            const tujuanKunj = renkon?.tujuanKunj || '0';
            const flagProcedure = renkon?.flagProcedure || '';
            const kdPenunjang = renkon?.kdPenunjang || '';
            let assesmentPel = renkon?.assesmentPel || '';

            if (!assesmentPel && tujuanKunj === '0' && rujukan && reqPoli && reqPoli !== rujukan.poliRujukan?.kode) {
                assesmentPel = '2'; // Cross-poli detection
            }

            // Construct VClaim 2.0 Payload
            const payload = {
                request: {
                    t_sep: {
                        noKartu: regDummy.nomorkartu,
                        tglSep: today,
                        ppkPelayanan: this.configService.get('VCLAIM_PPK_LAYANAN'),
                        jnsPelayanan: isRanap ? '1' : '2',
                        klsRawat: {
                            klsRawatHak: peserta?.hakKelas?.kode || rujukan?.peserta?.hakKelas?.kode || '',
                            klsRawatNaik: '',
                            pembiayaan: '',
                            penanggungJawab: '',
                        },
                        noMR: regDummy.no_rm,
                        rujukan: {
                            asalRujukan: '1',
                            tglRujukan: rujukan?.tglKunjungan || today,
                            noRujukan: regDummy.no_rujukan || '',
                            ppkRujukan: rujukan?.provPerujuk?.kode || '',
                        },
                        catatan: '',
                        diagAwal: renkon?.diagnosa_awal || rujukan?.diagnosa?.kode || '',
                        poli: {
                            tujuan: reqPoli,
                            eksekutif: '0',
                        },
                        cob: {
                            cob: '0',
                        },
                        katarak: {
                            katarak: '0',
                        },
                        jaminan: {
                            lakaLantas: '0',
                            noLP: '',
                            penjamin: {
                                tglKejadian: '',
                                keterangan: '',
                                suplesi: {
                                    suplesi: '0',
                                    noSepSuplesi: '',
                                    lokasiLaka: {
                                        kdPropinsi: '',
                                        kdKabupaten: '',
                                        kdKecamatan: '',
                                    },
                                },
                            },
                        },
                        tujuanKunj: tujuanKunj,
                        flagProcedure: flagProcedure,
                        kdPenunjang: kdPenunjang,
                        assesmentPel: assesmentPel,
                        skdp: {
                            noSurat: renkon?.no_surat_kontrol || '',
                            kodeDPJP: regDummy.kode_dokter || '',
                        },
                        dpjpLayan: isRanap ? '' : (regDummy.kode_dokter || ''),
                        noTelp: regDummy.no_hp || peserta?.noTelepon || '',
                        user: 'APM-OID',
                    },
                },
            };

            return {
                metaData: { code: 200, message: 'OK' },
                response: payload
            };
        } catch (error) {
            this.logger.error(`Error generating SEP payload: ${error.message}`, error.stack);
            return { metaData: { code: 500, message: `Error generating payload: ${error.message}` } };
        }
    }
}
