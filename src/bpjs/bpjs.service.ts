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

    private getServiceConfig(service: 'antrean' | 'vclaim' | 'pcare') {
        const prefix = service.toUpperCase();
        return {
            baseUrl: this.configService.get<string>(`${prefix}_BASE_URL`) || '',
            consId: this.configService.get<string>(`${prefix}_CONS_ID`) || '',
            secretKey: this.configService.get<string>(`${prefix}_SECRET_KEY`) || '',
            userKey: this.configService.get<string>(`${prefix}_USER_KEY`) || '',
        };
    }

    generateHeaders(timestamp: string, service: 'antrean' | 'vclaim' | 'pcare', contentType: string = 'application/json') {
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

    decryptResponse(encryptedData: string, timestamp: string, service: 'antrean' | 'vclaim' | 'pcare'): any {
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

    private async makeRequest(service: 'antrean' | 'vclaim' | 'pcare', method: 'get' | 'post', path: string, payload?: any, contentType?: string) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const debugMode = this.configService.get<string>('DEBUG_MODE') === 'true';
        let config: any = {};
        let requestDetails: any = {};

        try {
            config = this.getServiceConfig(service);
            const headers = this.generateHeaders(timestamp, service, contentType);
            const url = `${config.baseUrl}${path}`;

            // Store request details for debug mode
            if (debugMode) {
                requestDetails = {
                    service,
                    method: method.toUpperCase(),
                    url,
                    path,
                    timestamp,
                    headers: {
                        'X-cons-id': headers['X-cons-id'],
                        'X-timestamp': headers['X-timestamp'],
                        'X-signature': headers['X-signature'],
                        'user_key': headers['user_key'],
                        'Content-Type': headers['Content-Type'],
                    },
                    payload: payload || null,
                };
            }

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

                if (debugMode) {
                    return {
                        ...response.data,
                        _debug: {
                            ...requestDetails,
                            rawResponse: response.data,
                            error: 'Missing metadata in response',
                        }
                    };
                }
                return response.data;
            }

            // Normalisasi code ke number untuk pengecekan
            const code = Number(metadata.code);

            if ((code === 200 || code === 1) && typeof encryptedResponse === 'string') {
                const decryptedData = this.decryptResponse(encryptedResponse, timestamp, service);

                const result = {
                    ...response.data,
                    response: decryptedData,
                };

                // Add debug information if debug mode is enabled
                if (debugMode) {
                    result['_debug'] = {
                        ...requestDetails,
                        rawEncryptedResponse: encryptedResponse,
                        decryptedResponse: decryptedData,
                        metadata,
                        decryptionSuccess: true,
                    };
                }

                return result;
            }

            // For non-200 responses or non-encrypted responses
            const result = response.data;

            if (debugMode) {
                result['_debug'] = {
                    ...requestDetails,
                    rawResponse: response.data,
                    metadata,
                    note: 'Response was not encrypted or code was not 200/1',
                };
            }

            return result;
        } catch (error) {
            const status = error.response?.status || 500;
            const errorData = error.response?.data;
            const errorMessage = error.message;

            this.logger.error(`[BPJS BRIDGE ERROR] ${service} (${path}): ${errorMessage}`);
            if (errorData) {
                this.logger.error(`BPJS raw error response: ${JSON.stringify(errorData)}`);
            }

            // Return a structured error that doesn't trigger NestJS 500 Internal Server Error
            const errorResponse = {
                metaData: {
                    code: status,
                    message: `Bridge Error: ${errorMessage}`,
                    source: service.toUpperCase(),
                },
                response: errorData || null,
            };

            // Add comprehensive debug information in debug mode
            if (debugMode) {
                errorResponse['_debug'] = {
                    ...requestDetails,
                    error: {
                        message: errorMessage,
                        status,
                        stack: error.stack,
                        rawErrorData: errorData,
                        fullError: {
                            name: error.name,
                            message: error.message,
                            code: error.code,
                            response: {
                                status: error.response?.status,
                                statusText: error.response?.statusText,
                                headers: error.response?.headers,
                                data: error.response?.data,
                            }
                        }
                    },
                    baseUrl: config.baseUrl,
                };
            } else {
                errorResponse['_debug'] = {
                    path,
                    timestamp,
                    baseUrl: config.baseUrl
                };
            }

            return errorResponse;
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
        return this.makeRequest('vclaim', 'get', `/SEP/2.0/${noSep}`);
    }

    async getLastSepByNoRujukan(noRujukan: string) {
        return this.makeRequest('vclaim', 'get', `/Rujukan/RS/LastSEP/NoRujukan/${noRujukan}`);
    }

    async getRujukanByNoRujukan(noRujukan: string) {
        return this.makeRequest('vclaim', 'get', `/Rujukan/${noRujukan}`);
    }

    async getRujukanRSByNoRujukan(noRujukan: string) {
        return this.makeRequest('vclaim', 'get', `/Rujukan/RS/${noRujukan}`);
    }

    async getRujukanByNoKartu(noKartu: string) {
        return this.makeRequest('vclaim', 'get', `/Rujukan/Peserta/${noKartu}`);
    }

    async getRujukanListByNoKartu(noKartu: string) {
        return this.makeRequest('vclaim', 'get', `/Rujukan/RS/List/Peserta/${noKartu}`);
    }

    async getRujukanKeluarList(tglMulai: string, tglAkhir: string) {
        return this.makeRequest('vclaim', 'get', `/Rujukan/Keluar/List/tglMulai/${tglMulai}/tglAkhir/${tglAkhir}`);
    }

    async getKunjunganRujukan(noKunjungan: string) {
        return this.makeRequest('pcare', 'get', `/kunjungan/rujukan/${noKunjungan}`);
    }

    async getKunjunganPeserta(noKartu: string) {
        return this.makeRequest('pcare', 'get', `/kunjungan/peserta/${noKartu}`);
    }

    async checkRujukanExpiry(noRujukan: string, targetDate?: string) {
        try {
            const tglPeriksa = targetDate || new Date().toISOString().split('T')[0];

            // Try to add rujukan to antrean to check if it's expired
            // This mimics rsud-otista's validation approach
            const timestamp = Math.floor(Date.now() / 1000).toString();
            const headers = this.generateHeaders(timestamp, 'antrean');
            const { baseUrl } = this.getServiceConfig('antrean');

            // Create a minimal antrean payload to test rujukan validity
            const payload = {
                kodebooking: `TEST${Date.now()}`,
                jenispasien: "JKN",
                nomorkartu: "0000000000000", // Dummy
                nik: "0000000000000000",
                nohp: "08123456789",
                kodepoli: "001",
                namapoli: "Poli Umum",
                pasienbaru: 0,
                norm: "000000",
                tanggalperiksa: tglPeriksa,
                kodedokter: 1,
                namadokter: "Test",
                jampraktek: "08:00-12:00",
                jeniskunjungan: 1,
                nomorreferensi: noRujukan,
                nomorantrean: "001",
                angkaantrean: 1,
                estimasidilayani: Date.now() + 3600000,
                sisakuotajkn: 10,
                kuotajkn: 10,
                sisakuotanonjkn: 0,
                kuotanonjkn: 0,
                keterangan: "Test rujukan validity"
            };

            const url = `${baseUrl}/antrean/add`;
            const response = await firstValueFrom(
                this.httpService.post(url, payload, { headers })
            );

            const metadata = response.data.metadata || response.data.metaData;
            const message = metadata?.message || '';

            // Check for expired rujukan message
            const isExpired = message.includes('masa berlaku habis') ||
                message.includes('tidak valid');

            return {
                metadata: {
                    code: metadata?.code || 200,
                    message: metadata?.message || 'OK'
                },
                response: {
                    noRujukan,
                    targetDate: tglPeriksa,
                    isValid: !isExpired,
                    isExpired,
                    validationMessage: message
                }
            };
        } catch (error) {
            this.logger.error(`Failed to check rujukan expiry for ${noRujukan}`, error.stack);
            return {
                metadata: {
                    code: 500,
                    message: 'Failed to validate rujukan'
                },
                response: {
                    noRujukan,
                    targetDate: targetDate || new Date().toISOString().split('T')[0],
                    isValid: false,
                    isExpired: false,
                    validationMessage: error.message
                }
            };
        }
    }

    async getSuratKontrol(noSuratKontrol: string) {
        return this.makeRequest('vclaim', 'get', `/RencanaKontrol/noSuratKontrol/${noSuratKontrol}`);
    }

    async findSuratKontrolByIdentifier(identifier: string) {
        try {
            // 1. Search in RegistrasisDummy to get no_rm
            const regDummy = await this.registrasisRepository.findOne({
                where: [
                    { kodebooking: identifier },
                    { no_rm: identifier },
                    { nik: identifier },
                    { nomorkartu: identifier },
                ],
                order: { id: 'DESC' }
            });

            if (!regDummy) {
                return { metaData: { code: 404, message: `Pendaftaran tidak ditemukan untuk identifier '${identifier}' di database lokal.` } };
            }

            // 2. Find Pasien ID from no_rm
            const pasien = await this.pasiensRepository.findOne({ where: { no_rm: regDummy.no_rm } });
            if (!pasien) {
                return { metaData: { code: 404, message: `Pasien dengan no_rm '${regDummy.no_rm}' tidak ditemukan.` } };
            }

            // 3. Find no_surat_kontrol in bpjs_rencana_kontrol
            const renkon = await this.bpjsRencanaKontrolRepository.findOne({
                where: { pasien_id: pasien.id },
                order: { id: 'DESC' }
            });

            if (!renkon || !renkon.no_surat_kontrol) {
                return { metaData: { code: 404, message: `Nomor Surat Kontrol tidak ditemukan untuk pasien ini di database lokal.` } };
            }

            // 4. Call BPJS API
            return await this.getSuratKontrol(renkon.no_surat_kontrol);
        } catch (error) {
            this.logger.error(`Error in findSuratKontrolByIdentifier: ${error.message}`, error.stack);
            return { metaData: { code: 500, message: `Internal Server Error: ${error.message}` } };
        }
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
                await queryRunner.rollbackTransaction();
                return { metaData: { code: 201, message: 'Maaf, Tidak dapat checkin, cek tanggal periksa' } };
            }

            // 2. Queue Logic (AntrianPoli)
            const poli = await queryRunner.manager.findOne(Poli, { where: { bpjs: kodePoliBpjs } });
            if (!poli) {
                await queryRunner.rollbackTransaction();
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

    async createSepOtoMimic(identifier: string) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            this.logger.log(`[CREATE-SEP-MIMIC] Starting for identifier: ${identifier}`);
            const today = new Date().toISOString().split('T')[0];

            // 1. Find the booking record
            const kodeBooking = await this.findKodeBooking(identifier, today);
            if (!kodeBooking) {
                await queryRunner.rollbackTransaction();
                return { metaData: { code: 404, message: `Pendaftaran tidak ditemukan untuk '${identifier}' hari ini di database lokal.` } };
            }

            // 2. Get full details from BPJS Antrean API
            const antreanResponse = await this.getPendaftaranByKodeBooking(kodeBooking);
            if (antreanResponse?.metadata?.code !== 200) {
                await queryRunner.rollbackTransaction();
                return { metaData: { code: 201, message: `Gagal mengambil data antrean dari BPJS: ${antreanResponse?.metadata?.message}` } };
            }

            const antrean = antreanResponse.response[0];

            // 3. Get record from RegistrasisDummy for more local details (like nik, noka)
            const regDummy = await queryRunner.manager.findOne(RegistrasisDummy, {
                where: { kodebooking: kodeBooking }
            });

            if (!regDummy) {
                await queryRunner.rollbackTransaction();
                return { metaData: { code: 404, message: 'Data pendaftaran lokal (dummy) tidak ditemukan.' } };
            }

            // 4. Prepare SEP Payload (Mimic generateSepInsertV2Payload logic)
            // Need to fetch supplementary data for VClaim 2.0 requirement
            let peserta: any = null;
            let rujukan: any = null;
            let renkon: BpjsRencanaKontrol | null = null;

            try {
                // Fetch Patient Info (Peserta)
                const pesertaRes = await this.getPesertaByNoKartu(regDummy.nomorkartu, today);
                if (pesertaRes?.metaData?.code == 200) {
                    peserta = pesertaRes.response?.peserta;
                }

                // Fetch Referral (Rujukan)
                if (regDummy.no_rujukan) {
                    const rujukanRes = await this.getRujukanByNoRujukan(regDummy.no_rujukan);
                    if (rujukanRes?.metaData?.code == 200) {
                        rujukan = rujukanRes.response?.rujukan;
                    }
                }

                // Fetch Rencana Kontrol if any
                // Best to find by pasien_id as suggested by user
                let curPasien = await queryRunner.manager.findOne(Pasien, { where: { no_rm: regDummy.no_rm } });
                if (curPasien) {
                    renkon = await this.bpjsRencanaKontrolRepository.findOne({
                        where: { pasien_id: curPasien.id },
                        order: { id: 'DESC' }
                    });
                } else {
                    // Fallback
                    renkon = await this.bpjsRencanaKontrolRepository.findOneBy({ registrasi_id: regDummy.registrasi_id });
                }

                // If rujukan doesn't have diagnosis, try fetching from Surat Kontrol
                if (!rujukan?.diagnosa?.kode && renkon?.no_surat_kontrol) {
                    const skRes = await this.getSuratKontrol(renkon.no_surat_kontrol);
                    if (skRes?.metaData?.code == 200 || skRes?.metaData?.code == "200") {
                        const skData = skRes.response;
                        const diagRaw = skData?.sep?.diagnosa || '';
                        const diagCode = diagRaw.split(' - ')[0];
                        if (diagCode) {
                            if (!rujukan) rujukan = { diagnosa: {} };
                            if (!rujukan.diagnosa) rujukan.diagnosa = {};
                            rujukan.diagnosa.kode = diagCode;
                        }
                    }
                }
            } catch (err) {
                this.logger.warn(`[CREATE-SEP-MIMIC] Warning fetching BPJS supplements: ${err.message}`);
            }

            const payloadVClaim2 = {
                request: {
                    t_sep: {
                        noKartu: regDummy.nomorkartu,
                        tglSep: today,
                        ppkPelayanan: this.configService.get('VCLAIM_PPK_LAYANAN'),
                        jnsPelayanan: '2', // Rawat Jalan as per requirement
                        klsRawat: {
                            klsRawatHak: peserta?.hakKelas?.kode || rujukan?.peserta?.hakKelas?.kode || '',
                            klsRawatNaik: '',
                            pembiayaan: '',
                            penanggungJawab: '',
                        },
                        noMR: regDummy.no_rm,
                        rujukan: {
                            asalRujukan: antrean.jeniskunjungan == 1 ? '1' : '2',
                            tglRujukan: rujukan?.tglKunjungan || today,
                            noRujukan: regDummy.no_rujukan || '',
                            ppkRujukan: rujukan?.provPerujuk?.kode || '',
                        },
                        catatan: '',
                        diagAwal: rujukan?.diagnosa?.kode || '',
                        poli: {
                            tujuan: regDummy.kode_poli,
                            eksekutif: '0',
                        },
                        cob: { cob: '0' },
                        katarak: { katarak: '0' },
                        jaminan: {
                            lakaLantas: '0',
                            noLP: '',
                            penjamin: {
                                tglKejadian: '',
                                keterangan: '',
                                suplesi: {
                                    suplesi: '0',
                                    noSepSuplesi: '',
                                    lokasiLaka: { kdPropinsi: '', kdKabupaten: '', kdKecamatan: '' },
                                },
                            },
                        },
                        tujuanKunj: renkon?.tujuanKunj || '0',
                        flagProcedure: renkon?.flagProcedure || '',
                        kdPenunjang: renkon?.kdPenunjang || '',
                        assesmentPel: renkon?.assesmentPel || '',
                        skdp: {
                            noSurat: renkon?.no_surat_kontrol || '',
                            kodeDPJP: regDummy.kode_dokter || '',
                        },
                        dpjpLayan: regDummy.kode_dokter || '',
                        noTelp: regDummy.no_hp || '',
                        user: 'APM-OID-MIMIC',
                    },
                },
            };

            // 5. Execute VClaim SEP Insertion
            const bpjsResponse = await this.insertSepV2(payloadVClaim2);
            if (bpjsResponse?.metaData?.code !== '200' && bpjsResponse?.metaData?.code !== 200 && bpjsResponse?.metaData?.code !== 1) {
                await queryRunner.rollbackTransaction();
                return { metaData: { code: 201, message: `Gagal Insert SEP BPJS: ${bpjsResponse?.metaData?.message}` }, response: bpjsResponse };
            }

            const sepData = bpjsResponse.response?.sep;
            const noSep = sepData?.noSep;

            // 6. Database Updates (Mimic createSepWithBusinessLogic & apm-oto)

            // Poli
            const poli = await queryRunner.manager.findOne(Poli, { where: { bpjs: regDummy.kode_poli } });
            if (!poli) {
                throw new Error(`Poli dengan kode BPJS ${regDummy.kode_poli} tidak ditemukan di database local`);
            }

            // AntrianPoli
            const antrianCount = await queryRunner.manager.count(AntrianPoli, {
                where: { tanggal: today, kelompok: poli.kelompok }
            });
            const nomorAntrian = antrianCount + 1;
            const savedAntrian = await queryRunner.manager.save(queryRunner.manager.create(AntrianPoli, {
                nomor: nomorAntrian,
                suara: `${nomorAntrian}.mp3`,
                status: 0,
                panggil: 1,
                poli_id: poli.id,
                tanggal: today,
                loket: poli.loket,
                kelompok: poli.kelompok,
            }));

            // Pasien
            let pasien = await queryRunner.manager.findOne(Pasien, { where: { no_rm: regDummy.no_rm } });
            if (!pasien) {
                pasien = await queryRunner.manager.save(queryRunner.manager.create(Pasien, {
                    nama: antrean.nama || '',
                    nik: regDummy.nik,
                    alamat: (rujukan?.peserta?.provUmum?.nmProv || '').toUpperCase(),
                    tgldaftar: today,
                    no_jkn: regDummy.nomorkartu,
                    user_create: 'APM-OID-MIMIC',
                    no_rm: regDummy.no_rm // Use from dummy if exists
                }));

                if (!pasien.no_rm) {
                    const rmCount = await queryRunner.manager.count(Nomorrm);
                    const nextRm = (rmCount + 769695).toString();
                    await queryRunner.manager.save(queryRunner.manager.create(Nomorrm, { pasien_id: pasien.id, no_rm: nextRm }));
                    pasien.no_rm = nextRm;
                    await queryRunner.manager.save(pasien);
                }
            }

            // Pegawai (Dokter)
            const dokter = await queryRunner.manager.findOne(Pegawai, { where: { kode_bpjs: regDummy.kode_dokter } });

            // Registrasi
            const regCount = await queryRunner.manager.count(Registrasi, {
                where: { reg_id: Like(`${today.replace(/-/g, '')}%`) }
            });

            const registrasi = await queryRunner.manager.save(queryRunner.manager.create(Registrasi, {
                input_from: 'APM-OID',
                antrian_poli_id: savedAntrian.id,
                nomorantrian: regDummy.kodebooking,
                nomorantrian_jkn: antrean.noantrean,
                pasien_id: pasien.id,
                reg_id: today.replace(/-/g, '') + String(regCount + 1).padStart(4, '0'),
                status: 1,
                dokter_id: dokter?.id,
                poli_id: poli.id,
                bayar: '1',
                no_jkn: pasien.no_jkn,
                no_rujukan: regDummy.no_rujukan,
                no_sep: noSep,
                tgl_sep: today,
                diagnosa_awal: sepData?.diagnosa,
                tgl_rujukan: rujukan?.tglKunjungan,
                ppk_rujukan: rujukan?.provPerujuk?.kode,
                jenis_pasien: '1',
                posisiberkas_id: '2',
                status_reg: 'J1',
            }));

            // Audit Logs / History
            await queryRunner.manager.save(HistoriStatus, { registrasi_id: registrasi.id, status: 'J1', poli_id: poli.id, pengirim_rujukan: 1 });
            await queryRunner.manager.save(Historipengunjung, { registrasi_id: registrasi.id, pasien_id: pasien.id, pengirim_rujukan: 1, politipe: 'J', status_pasien: 'LAMA' });
            await queryRunner.manager.save(HistorikunjunganIRJ, { registrasi_id: registrasi.id, pasien_id: pasien.id, poli_id: poli.id, dokter_id: dokter?.id, pengirim_rujukan: '1' });

            // Update Dummy Status
            regDummy.status = 'checkin';
            regDummy.no_rm = pasien.no_rm;
            regDummy.registrasi_id = registrasi.id;
            await queryRunner.manager.save(regDummy);

            // 7. Update Waktu Antrean (Task ID 3)
            await this.updateWaktuAntrean({
                kodebooking: kodeBooking,
                taskid: 3,
                waktu: Date.now()
            });

            await queryRunner.commitTransaction();

            return {
                metaData: { code: 200, message: 'Sukses' },
                response: {
                    noSep: noSep,
                    kodeBooking: kodeBooking,
                    registrasi_id: registrasi.id,
                    no_rm: pasien.no_rm
                }
            };

        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`[CREATE-SEP-MIMIC] Error: ${error.message}`, error.stack);
            return {
                metaData: { code: 500, message: `Internal Server Error: ${error.message}` }
            };
        } finally {
            await queryRunner.release();
        }
    }

    async createSepWithValidation(identifier: string, sepPayload: any) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // 1. Find registration data
            const regDummy = await this.registrasisRepository.findOne({
                where: [
                    { no_rm: identifier },
                    { nik: identifier },
                    { nomorkartu: identifier },
                    { nomorantrian: identifier },
                ],
                order: { id: 'DESC' }
            });

            if (!regDummy) {
                await queryRunner.rollbackTransaction();
                return {
                    metaData: { code: 404, message: `Data registrasi tidak ditemukan untuk identifier: ${identifier}` },
                    response: null
                };
            }

            // 2. Validate rujukan expiry if rujukan number is provided
            if (sepPayload.noRujukan) {
                const rujukanCheck = await this.checkRujukanExpiry(
                    sepPayload.noRujukan,
                    sepPayload.tglSep || new Date().toISOString().split('T')[0]
                );

                if (rujukanCheck.response.isExpired) {
                    await queryRunner.rollbackTransaction();
                    return {
                        metaData: {
                            code: 201,
                            message: rujukanCheck.response.validationMessage || 'Rujukan sudah tidak valid / masa berlaku habis'
                        },
                        response: rujukanCheck.response
                    };
                }
            }

            // 3. Create BPJS Antrean if nomorantrian exists
            if (regDummy.nomorantrian) {
                const timestamp = Math.floor(Date.now() / 1000).toString();
                const headers = this.generateHeaders(timestamp, 'antrean');
                const { baseUrl } = this.getServiceConfig('antrean');

                // Add antrean
                const antreanPayload = {
                    kodebooking: regDummy.kodebooking || regDummy.nomorantrian,
                    jenispasien: "JKN",
                    nomorkartu: sepPayload.noKartu || regDummy.nomorkartu,
                    nik: sepPayload.nik || regDummy.nik,
                    nohp: sepPayload.noTelp || regDummy.no_hp || '08123456789',
                    kodepoli: sepPayload.poliTujuan || regDummy.kode_poli,
                    namapoli: sepPayload.namaPoliTujuan || 'Poli',
                    pasienbaru: regDummy.no_rm ? 0 : 1,
                    norm: regDummy.no_rm || '',
                    tanggalperiksa: sepPayload.tglSep || new Date().toISOString().split('T')[0],
                    kodedokter: sepPayload.kodeDPJP || regDummy.kode_dokter || 1,
                    namadokter: sepPayload.namaDokter || 'Dokter',
                    jampraktek: "08:00-14:00",
                    jeniskunjungan: sepPayload.jenisKunjungan || 1,
                    nomorreferensi: sepPayload.noRujukan || '',
                    nomorantrean: regDummy.nomorantrian.slice(-4),
                    angkaantrean: parseInt(regDummy.nomorantrian.slice(-4)),
                    estimasidilayani: Date.now() + 3600000,
                    sisakuotajkn: 10,
                    kuotajkn: 10,
                    sisakuotanonjkn: 0,
                    kuotanonjkn: 0,
                    keterangan: "Pembuatan SEP"
                };

                try {
                    const antreanUrl = `${baseUrl}/antrean/add`;
                    const antreanResponse = await firstValueFrom(
                        this.httpService.post(antreanUrl, antreanPayload, { headers })
                    );

                    const antreanMeta = antreanResponse.data.metadata || antreanResponse.data.metaData;

                    // Check if rujukan is invalid from antrean response
                    if (antreanMeta?.code === 201 &&
                        antreanMeta?.message?.includes('masa berlaku habis')) {
                        await queryRunner.rollbackTransaction();
                        return {
                            metaData: antreanMeta,
                            response: null
                        };
                    }

                    // Update task IDs (1, 2, 3)
                    for (let taskId = 1; taskId <= 3; taskId++) {
                        const updatePayload = {
                            kodebooking: regDummy.kodebooking || regDummy.nomorantrian,
                            taskid: taskId,
                            waktu: Date.now()
                        };

                        const updateUrl = `${baseUrl}/antrean/updatewaktu`;
                        await firstValueFrom(
                            this.httpService.post(updateUrl, updatePayload, { headers })
                        ).catch(() => {
                            // Ignore update errors
                        });

                        if (taskId < 3) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    }
                } catch (antreanError) {
                    this.logger.warn(`Antrean creation failed: ${antreanError.message}`);
                    // Continue with SEP creation even if antrean fails
                }
            }

            // 4. Build SEP payload
            const sepVClaimPayload = {
                request: {
                    t_sep: {
                        noKartu: sepPayload.noKartu || regDummy.nomorkartu,
                        tglSep: sepPayload.tglSep || new Date().toISOString().split('T')[0],
                        ppkPelayanan: this.configService.get('VCLAIM_PPK_PELAYANAN') || '0301R001',
                        jnsPelayanan: sepPayload.jnsPelayanan || '2',
                        klsRawat: {
                            klsRawatHak: sepPayload.klsRawatHak || '3',
                            klsRawatNaik: sepPayload.klsRawatNaik || '',
                            pembiayaan: sepPayload.pembiayaan || '',
                            penanggungJawab: sepPayload.penanggungJawab || ''
                        },
                        noMR: sepPayload.noMR || regDummy.no_rm,
                        rujukan: {
                            asalRujukan: sepPayload.asalRujukan || '1',
                            tglRujukan: sepPayload.tglRujukan || new Date().toISOString().split('T')[0],
                            noRujukan: sepPayload.noRujukan || '',
                            ppkRujukan: sepPayload.ppkRujukan || ''
                        },
                        catatan: sepPayload.catatan || '-',
                        diagAwal: sepPayload.diagAwal || '',
                        poli: {
                            tujuan: sepPayload.poliTujuan || regDummy.kode_poli,
                            eksekutif: '0'
                        },
                        cob: {
                            cob: sepPayload.cob || '0'
                        },
                        katarak: {
                            katarak: sepPayload.katarak || '0'
                        },
                        jaminan: {
                            lakaLantas: sepPayload.lakaLantas || '0',
                            noLP: sepPayload.noLP || '',
                            penjamin: {
                                penjamin: sepPayload.penjamin || '',
                                tglKejadian: sepPayload.tglKejadian || '',
                                keterangan: sepPayload.keterangan || '',
                                suplesi: {
                                    suplesi: sepPayload.suplesi || '0',
                                    noSepSuplesi: sepPayload.noSepSuplesi || '',
                                    lokasiLaka: {
                                        kdPropinsi: sepPayload.kdPropinsi || '',
                                        kdKabupaten: sepPayload.kdKabupaten || '',
                                        kdKecamatan: sepPayload.kdKecamatan || ''
                                    }
                                }
                            }
                        },
                        tujuanKunj: sepPayload.tujuanKunj || '0',
                        flagProcedure: sepPayload.flagProcedure || '',
                        kdPenunjang: sepPayload.kdPenunjang || '',
                        assesmentPel: sepPayload.assesmentPel || '',
                        skdp: {
                            noSurat: sepPayload.noSurat || '',
                            kodeDPJP: sepPayload.kodeDPJP || regDummy.kode_dokter || ''
                        },
                        dpjpLayan: sepPayload.dpjpLayan || regDummy.kode_dokter || '',
                        noTelp: sepPayload.noTelp || regDummy.no_hp || '',
                        user: 'RSUD-OTISTA-MIMIC'
                    }
                }
            };

            // 5. Execute VClaim SEP Insertion
            const bpjsResponse = await this.insertSepV2(sepVClaimPayload);

            if (bpjsResponse?.metaData?.code !== '200' &&
                bpjsResponse?.metaData?.code !== 200 &&
                bpjsResponse?.metaData?.code !== 1) {
                await queryRunner.rollbackTransaction();
                return {
                    metaData: {
                        code: 201,
                        message: `Gagal Insert SEP BPJS: ${bpjsResponse?.metaData?.message}`
                    },
                    response: bpjsResponse
                };
            }

            const sepData = bpjsResponse.response?.sep;
            const noSep = sepData?.noSep;

            // 6. Update registrasi_dummy with SEP number
            // if (noSep) {
            //     regDummy.no_sep = noSep;
            //     await queryRunner.manager.save(regDummy);
            // }

            await queryRunner.commitTransaction();

            return {
                metaData: { code: 200, message: 'SEP berhasil dibuat' },
                response: {
                    sep: sepData,
                    noSep: noSep,
                    bpjsResponse: bpjsResponse
                }
            };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Error in createSepWithValidation: ${error.message}`, error.stack);
            return {
                metaData: {
                    code: 500,
                    message: `Internal Server Error: ${error.message}`
                },
                response: null
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
                        code: 404,
                        message: `Data tidak ditemukan di database lokal (${identifier}).`,
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
                            code: 404,
                            message: `Pendaftaran ditemukan pada ${anyRecord.tglperiksa}, mohon gunakan tanggal yang sesuai.`
                        }
                    };
                }

                return { metaData: { code: 404, message: `Pendaftaran tidak ditemukan untuk '${identifier}' pada database lokal.` } };
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

    async createSepFromSimrs(identifier: string) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            this.logger.log(`[SEP-SIMRS] Starting creation for identifier: ${identifier} with User Query`);

            // 1. Execute Custom User Query Adapted for Search
            const query = `
                SELECT
                  r.id                          AS registrasi_id,
                  r.reg_id                      AS reg_id,
                  r.pasien_id                   AS pasien_id,

                  p.no_rm                       AS no_mr,
                  p.nama                        AS nama_pasien,
                  p.no_jkn                      AS no_kartu_from_pasiens,
                  p.nik                         AS nik_pasien,
                  COALESCE(p.nohp, p.notlp)     AS telp_pasien,

                  rd.nomorkartu                 AS no_kartu_from_dummy,
                  rd.no_hp                      AS telp_from_dummy,
                  rd.tglperiksa                 AS tgl_periksa,
                  rd.kode_poli                  AS kode_poli_dummy,
                  rd.no_rujukan                 AS no_rujukan_dummy,
                  rd.polieksekutif              AS poli_eksekutif,
                  rd.kode_dokter                AS kode_dpjp_dummy,

                  r.no_rujukan                  AS no_rujukan_reg,
                  r.tgl_rujukan                 AS tgl_rujukan,
                  r.ppk_rujukan                 AS ppk_rujukan,
                  r.diagnosa_awal               AS diagnosa_awal_reg,
                  r.no_sep                      AS no_sep_reg,
                  r.tgl_sep                     AS tgl_sep_reg,
                  r.poli_bpjs                   AS poli_bpjs,

                  bk.no_surat_kontrol           AS no_surat_kontrol,
                  bk.no_sep                     AS no_sep_kontrol,
                  bk.no_rujukan                 AS no_rujukan_kontrol,
                  bk.tujuanKunj                 AS tujuanKunj,
                  bk.flagProcedure              AS flagProcedure,
                  bk.kdPenunjang                AS kdPenunjang,
                  bk.assesmentPel               AS assesmentPel,
                  bk.diagnosa_awal              AS diagnosa_awal_kontrol,
                  bk.tgl_rencana_kontrol        AS tgl_rencana_kontrol

                FROM registrasis r
                JOIN pasiens p
                  ON p.id = r.pasien_id
                LEFT JOIN registrasis_dummy rd
                  ON rd.registrasi_id = r.id
                LEFT JOIN bpjs_rencana_kontrol bk
                  ON bk.registrasi_id = r.id
                  AND bk.pasien_id = p.id
                WHERE 
                   CAST(r.id AS CHAR) = ?
                   OR p.no_rm = ?
                   OR p.nik = ?
                   OR p.no_jkn = ?
                   OR rd.nomorkartu = ?
                   OR rd.kodebooking = ?
                ORDER BY r.id DESC
                LIMIT 1
            `;

            const results = await queryRunner.query(query, [identifier, identifier, identifier, identifier, identifier, identifier]);

            if (!results || results.length === 0) {
                return {
                    metaData: { code: 404, message: `Data Registrasi tidak ditemukan untuk '${identifier}'` },
                    _debugQuery: query
                };
            }

            const data = results[0];
            const noKartu = data.no_kartu_from_dummy || data.no_kartu_from_pasiens;
            const tglSep = data.tgl_periksa || new Date().toISOString().split('T')[0]; // Fallback to today if null, though likely should exist

            // 2. Fetch Peserta from BPJS to get Hak Kelas (Important!)
            let klsRawatHak = '';
            try {
                const pesertaRes = await this.getPesertaByNoKartu(noKartu, tglSep);
                if (pesertaRes?.metaData?.code === '200') {
                    klsRawatHak = pesertaRes.response?.peserta?.hakKelas?.kode || '';
                }
            } catch (e) {
                this.logger.warn(`[SEP-SIMRS] Failed to fetch peserta info for Hak Kelas: ${e.message}`);
            }

            // 3. Construct Payload
            // Prioritize Dummy/Reg data, fallbacks to defaults

            const payload = {
                request: {
                    t_sep: {
                        noKartu: noKartu,
                        tglSep: tglSep,
                        ppkPelayanan: this.configService.get('VCLAIM_PPK_LAYANAN') || '0301R011', // Default from user example or ENV
                        jnsPelayanan: '2', // Default Rawat Jalan based on user context
                        klsRawat: {
                            klsRawatHak: klsRawatHak || '3', // Fallback 3 is risky but needed if API fails
                            klsRawatNaik: '',
                            pembiayaan: '',
                            penanggungJawab: ''
                        },
                        noMR: data.no_mr,
                        rujukan: {
                            asalRujukan: '1', // Default Faskes 1, user should ideally specify logic or input
                            tglRujukan: data.tgl_rujukan || '',
                            noRujukan: data.no_rujukan_reg || data.no_rujukan_dummy || data.no_rujukan_kontrol || '',
                            ppkRujukan: data.ppk_rujukan || ''
                        },
                        catatan: 'SEP Created via SIMRS Integration',
                        diagAwal: data.diagnosa_awal_reg || data.diagnosa_awal_kontrol || '',
                        poli: {
                            tujuan: data.kode_poli_dummy || data.poli_bpjs || '',
                            eksekutif: data.poli_eksekutif || '0'
                        },
                        cob: { cob: '0' },
                        katarak: { katarak: '0' },
                        jaminan: {
                            lakaLantas: '0',
                            noLP: '',
                            penjamin: {
                                tglKejadian: '',
                                keterangan: '',
                                suplesi: {
                                    suplesi: '0',
                                    noSepSuplesi: '',
                                    lokasiLaka: { kdPropinsi: '', kdKabupaten: '', kdKecamatan: '' }
                                }
                            }
                        },
                        tujuanKunj: data.tujuanKunj || '0',
                        flagProcedure: data.flagProcedure || '',
                        kdPenunjang: data.kdPenunjang || '',
                        assesmentPel: data.assesmentPel || '',
                        skdp: {
                            noSurat: data.no_surat_kontrol || '',
                            kodeDPJP: data.kode_dpjp_dummy || ''
                        },
                        dpjpLayan: data.kode_dpjp_dummy || '',
                        noTelp: data.telp_from_dummy || data.telp_pasien || '',
                        user: 'APM-SIMRS-V2'
                    }
                }
            };

            // 4. Validate Critical Fields before sending
            // e.g. DiagAwal is mandatory

            // 5. Send to BPJS
            const bpjsResponse = await this.insertSepV2(payload);

            // 6. Return combined result
            return {
                metaData: bpjsResponse?.metaData,
                response: bpjsResponse?.response,
                _simrs_debug: {
                    source_data: data,
                    generated_payload: payload
                }
            };

        } catch (error) {
            this.logger.error(`[SEP-SIMRS] Error: ${error.message}`, error.stack);
            return {
                metaData: { code: 500, message: `Internal Error: ${error.message}` }
            };
        } finally {
            await queryRunner.release();
        }
    }
}
