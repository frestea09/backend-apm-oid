import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegistrasisDummy } from './entities/registrasis-dummy.entity';
import * as crypto from 'crypto';
import * as LZString from 'lz-string';

@Injectable()
export class BpjsService {
    private readonly logger = new Logger(BpjsService.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        @InjectRepository(RegistrasisDummy)
        private readonly registrasisRepository: Repository<RegistrasisDummy>,
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
        const config = this.getServiceConfig(service);
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const headers = this.generateHeaders(timestamp, service, contentType);
        const url = `${config.baseUrl}${path}`;

        try {
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
            this.logger.error(`Error calling BPJS API ${service} (${path}): ${error.message}`);
            throw error;
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

    async insertSepV2(data: any) {
        return this.makeRequest('vclaim', 'post', '/SEP/2.0/insert', data, 'Application/x-www-form-urlencoded');
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
}
