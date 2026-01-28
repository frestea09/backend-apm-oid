import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { BpjsService } from './bpjs.service';

@ApiTags('BPJS')
@Controller('bpjs')
export class BpjsController {
    constructor(private readonly bpjsService: BpjsService) { }

    // --- ANTREAN RS ENDPOINTS ---

    @Get('ref/poli')
    @ApiOperation({ summary: 'Melihat referensi poli yang ada pada Aplikasi HFIS' })
    @ApiResponse({ status: 200, description: 'Success response with decrypted poli data' })
    async getRefPoli() {
        return await this.bpjsService.getRefPoli();
    }

    @Get('ref/dokter')
    @ApiOperation({ summary: 'Melihat referensi dokter yang ada pada Aplikasi HFIS' })
    @ApiResponse({ status: 200, description: 'Success response with decrypted dokter data' })
    async getRefDokter() {
        return await this.bpjsService.getRefDokter();
    }

    @Get('jadwaldokter/kodepoli/:kodepoli/tanggal/:tanggal')
    @ApiOperation({ summary: 'Melihat referensi jadwal dokter yang ada pada Aplikasi HFIS' })
    @ApiParam({ name: 'kodepoli', description: 'Kode Poli (e.g., ANA)', example: 'ANA' })
    @ApiParam({ name: 'tanggal', description: 'Tanggal (YYYY-MM-DD)', example: '2021-08-07' })
    @ApiResponse({ status: 200, description: 'Success response with decrypted jadwal dokter data' })
    async getJadwalDokter(
        @Param('kodepoli') kodepoli: string,
        @Param('tanggal') tanggal: string,
    ) {
        return await this.bpjsService.getJadwalDokter(kodepoli, tanggal);
    }

    @Get('ref/poli/fp')
    @ApiOperation({ summary: 'Melihat referensi poli finger print' })
    @ApiResponse({ status: 200, description: 'Success response with decrypted poli FP data' })
    async getRefPoliFP() {
        return await this.bpjsService.getRefPoliFP();
    }

    @Get('ref/pasien/fp/identitas/:identitas/noidentitas/:noidentitas')
    @ApiOperation({ summary: 'Melihat referensi pasien finger print' })
    @ApiParam({ name: 'identitas', description: 'nik atau noka', example: 'nik' })
    @ApiParam({ name: 'noidentitas', description: 'Nomor Identitas', example: '3201xxx' })
    @ApiResponse({ status: 200, description: 'Success response with decrypted pasien FP data' })
    async getRefPasienFP(
        @Param('identitas') identitas: string,
        @Param('noidentitas') noidentitas: string,
    ) {
        return await this.bpjsService.getRefPasienFP(identitas, noidentitas);
    }

    @Post('antrean/getlisttask')
    @ApiOperation({ summary: 'Melihat waktu task id yang telah dikirim ke BPJS' })
    @ApiBody({ schema: { example: { kodebooking: '123' } } })
    @ApiResponse({ status: 201, description: 'Success response with decrypted task list data' })
    async getListTask(@Body() body: any) {
        return await this.bpjsService.getListTask(body);
    }

    @Post('antrean/add')
    @ApiOperation({ summary: 'Tambah Antrean RS' })
    @ApiBody({
        schema: {
            example: {
                kodebooking: '16032021A001',
                jenispasien: 'JKN',
                nomorkartu: '00012345678',
                nik: '3212345678987654',
                nohp: '085635228888',
                kodepoli: 'ANA',
                namapoli: 'Anak',
                pasienbaru: 0,
                norm: '123345',
                tanggalperiksa: '2021-01-28',
                kodedokter: 12345,
                namadokter: 'Dr. Hendra',
                jampraktek: '08:00-16:00',
                jeniskunjungan: 1,
                nomorreferensi: '0001R0040116A000001',
                nomorantrean: 'A-12',
                angkaantrean: 12,
                estimasidilayani: 1615869169000,
                sisakuotajkn: 5,
                kuotajkn: 30,
                sisakuotanonjkn: 5,
                kuotanonjkn: 30,
                keterangan: 'Peserta harap 30 menit lebih awal guna pencatatan administrasi.',
            },
        },
    })
    @ApiResponse({ status: 201, description: 'Success response with decrypted antrean data' })
    async addAntrean(@Body() body: any) {
        return await this.bpjsService.addAntrean(body);
    }

    @Post('antrean/updatewaktu')
    @ApiOperation({ summary: 'Update Waktu Antrean / Kirim Task ID' })
    @ApiBody({
        schema: {
            example: {
                kodebooking: '16032021A001',
                taskid: 1,
                waktu: 1616559330000,
                jenisresep: 'Tidak ada/Racikan/Non racikan',
            },
        },
    })
    @ApiResponse({ status: 201, description: 'Success response with decrypted update status' })
    async updateWaktuAntrean(@Body() body: any) {
        return await this.bpjsService.updateWaktuAntrean(body);
    }

    @Get('dashboard/waktutunggu/tanggal/:tanggal/waktu/:waktu')
    @ApiOperation({ summary: 'Dashboard waktu per tanggal' })
    @ApiParam({ name: 'tanggal', description: 'Tanggal (YYYY-MM-DD)', example: '2021-04-16' })
    @ApiParam({ name: 'waktu', description: 'rs atau server', example: 'rs' })
    @ApiResponse({ status: 200, description: 'Success response with decrypted dashboard data' })
    async getDashboardWaktuTungguTanggal(
        @Param('tanggal') tanggal: string,
        @Param('waktu') waktu: string,
    ) {
        return await this.bpjsService.getDashboardWaktuTungguTanggal(tanggal, waktu);
    }

    @Get('dashboard/waktutunggu/bulan/:bulan/tahun/:tahun/waktu/:waktu')
    @ApiOperation({ summary: 'Dashboard waktu per bulan' })
    @ApiParam({ name: 'bulan', description: 'Bulan (MM)', example: '07' })
    @ApiParam({ name: 'tahun', description: 'Tahun (YYYY)', example: '2021' })
    @ApiParam({ name: 'waktu', description: 'rs atau server', example: 'rs' })
    @ApiResponse({ status: 200, description: 'Success response with decrypted dashboard data' })
    async getDashboardWaktuTungguBulan(
        @Param('bulan') bulan: string,
        @Param('tahun') tahun: string,
        @Param('waktu') waktu: string,
    ) {
        return await this.bpjsService.getDashboardWaktuTungguBulan(bulan, tahun, waktu);
    }

    @Get('antrean/pendaftaran/tanggal/:tanggal')
    @ApiOperation({ summary: 'Melihat pendaftaran antrean per tanggal' })
    @ApiParam({ name: 'tanggal', description: 'Tanggal (YYYY-MM-DD)', example: '2026-01-22' })
    @ApiResponse({ status: 200, description: 'Success response with decrypted pendaftaran data' })
    async getPendaftaranTanggal(@Param('tanggal') tanggal: string) {
        return await this.bpjsService.getPendaftaranTanggal(tanggal);
    }

    @Get('antrean/pendaftaran/kodebooking/:kodebooking')
    @ApiOperation({ summary: 'Melihat pendaftaran antrean per kode booking' })
    @ApiParam({ name: 'kodebooking', description: 'Kode Booking', example: '22012026BRTSAR1' })
    @ApiResponse({ status: 200, description: 'Success response with decrypted booking data' })
    async getPendaftaranByKodeBooking(@Param('kodebooking') kodebooking: string) {
        return await this.bpjsService.getPendaftaranByKodeBooking(kodebooking);
    }

    @Get('antrean/pendaftaran/cari-kodebooking/:identifier')
    @ApiOperation({ summary: 'Mencari pendaftaran antrean berdasarkan No RM / NIK / No Kartu BPJS / Nomor Antrean (Local DB Lookup)' })
    @ApiParam({ name: 'identifier', description: 'No RM / NIK / No Kartu BPJS / Nomor Antrean', example: 'A-12' })
    @ApiQuery({ name: 'tanggal', required: false, description: 'Tanggal Periksa (YYYY-MM-DD)', example: '2024-12-07' })
    @ApiResponse({ status: 200, description: 'Success response with booking data found via local DB lookup' })
    async cariPendaftaran(
        @Param('identifier') identifier: string,
        @Query('tanggal') tanggal?: string,
    ) {
        return await this.bpjsService.findAndGetBooking(identifier, tanggal);
    }

    @Get('antrean/pendaftaran/aktif')
    @ApiOperation({ summary: 'Melihat pendaftaran antrean belum dilayani' })
    @ApiResponse({ status: 200, description: 'Success response with decrypted active pendaftaran data' })
    async getPendaftaranAktif() {
        return await this.bpjsService.getPendaftaranAktif();
    }

    @Get('antrean/pendaftaran/kodepoli/:kodepoli/kodedokter/:kodedokter/hari/:hari/jampraktek/:jampraktek')
    @ApiOperation({ summary: 'Melihat pendaftaran antrean belum dilayani per poli per dokter per hari per jam praktek' })
    @ApiParam({ name: 'kodepoli', example: 'ANA' })
    @ApiParam({ name: 'kodedokter', example: '123' })
    @ApiParam({ name: 'hari', example: '1' })
    @ApiParam({ name: 'jampraktek', example: '08:00-14:00' })
    @ApiResponse({ status: 200, description: 'Success response with decrypted specific pendaftaran data' })
    async getPendaftaranSpesifik(
        @Param('kodepoli') kodepoli: string,
        @Param('kodedokter') kodedokter: string,
        @Param('hari') hari: string,
        @Param('jampraktek') jampraktek: string,
    ) {
        return await this.bpjsService.getPendaftaranSpesifik(kodepoli, kodedokter, hari, jampraktek);
    }

    // --- VCLAIM ENDPOINTS ---

    @ApiTags('VClaim')
    @Get('vclaim/peserta/nokartu/:nokartu/tglSEP/:tglSEP')
    @ApiOperation({ summary: 'Pencarian data peserta BPJS Kesehatan berdasarkan Nomor Kartu' })
    @ApiParam({ name: 'nokartu', description: 'Nomor Kartu Peserta', example: '0002741926746' })
    @ApiParam({ name: 'tglSEP', description: 'Tanggal Pelayanan/SEP (YYYY-MM-DD)', example: '2026-01-22' })
    @ApiResponse({ status: 200, description: 'Success response with decrypted peserta data' })
    async getPesertaByNoKartu(
        @Param('nokartu') nokartu: string,
        @Param('tglSEP') tglSEP: string,
    ) {
        return await this.bpjsService.getPesertaByNoKartu(nokartu, tglSEP);
    }

    @ApiTags('VClaim')
    @Get('vclaim/peserta/nik/:nik/tglSEP/:tglSEP')
    @ApiOperation({ summary: 'Pencarian data peserta berdasarkan NIK Kependudukan' })
    @ApiParam({ name: 'nik', description: 'NIK KTP', example: '327 account number here maybe? nah using nik example' })
    @ApiParam({ name: 'tglSEP', description: 'Tanggal Pelayanan/SEP (YYYY-MM-DD)', example: '2026-01-22' })
    @ApiResponse({ status: 200, description: 'Success response with decrypted peserta data' })
    async getPesertaByNIK(
        @Param('nik') nik: string,
        @Param('tglSEP') tglSEP: string,
    ) {
        return await this.bpjsService.getPesertaByNIK(nik, tglSEP);
    }

    @ApiTags('VClaim')
    @Get('vclaim/sep/:nosep')
    @ApiOperation({ summary: 'Melihat data detail SEP Peserta' })
    @ApiParam({ name: 'nosep', description: 'Nomor SEP Peserta', example: '1002R0060126V000001' })
    @ApiResponse({ status: 200, description: 'Success response with decrypted SEP data' })
    async getSepDetail(@Param('nosep') nosep: string) {
        return await this.bpjsService.getSepDetail(nosep);
    }

    @ApiTags('VClaim')
    @Get('vclaim/rujukan/lastsep/norujukan/:norujukan')
    @ApiOperation({ summary: 'Melihat data detail SEP Terakhir Peserta Berdasarkan Nomor Rujukan' })
    @ApiParam({ name: 'norujukan', description: 'Nomor Rujukan', example: '12345678' })
    @ApiResponse({ status: 200, description: 'Success response with decrypted last SEP data' })
    async getLastSepByNoRujukan(@Param('norujukan') norujukan: string) {
        return await this.bpjsService.getLastSepByNoRujukan(norujukan);
    }

    @ApiTags('VClaim')
    @Get('vclaim/rujukan/:norujukan')
    @ApiOperation({ summary: 'Pencarian data rujukan dari rumah sakit berdasarkan nomor rujukan' })
    @ApiParam({ name: 'norujukan', description: 'Nomor Rujukan', example: '12345678' })
    @ApiResponse({ status: 200, description: 'Success response with decrypted rujukan data' })
    async getRujukanByNoRujukan(@Param('norujukan') norujukan: string) {
        return await this.bpjsService.getRujukanByNoRujukan(norujukan);
    }

    @ApiTags('VClaim')
    @Get('vclaim/rujukan/peserta/:nokartu')
    @ApiOperation({ summary: 'Pencarian data rujukan dari rumahsakit berdasarkan nomor kartu' })
    @ApiParam({ name: 'nokartu', description: 'Nomor Kartu Peserta', example: '0001462707099' })
    @ApiResponse({ status: 200, description: 'Success response with decrypted rujukan data' })
    async getRujukanByNoKartu(@Param('nokartu') nokartu: string) {
        return await this.bpjsService.getRujukanByNoKartu(nokartu);
    }

    @ApiTags('VClaim')
    @Get('vclaim/rujukan/rs/list/peserta/:nokartu')
    @ApiOperation({ summary: 'Pencarian data rujukan dari rumah sakit berdasarkan nomor kartu (List)' })
    @ApiParam({ name: 'nokartu', description: 'Nomor Kartu Peserta', example: '0001462707099' })
    @ApiResponse({ status: 200, description: 'Success response with decrypted rujukan list data' })
    async getRujukanListByNoKartu(@Param('nokartu') nokartu: string) {
        return await this.bpjsService.getRujukanListByNoKartu(nokartu);
    }

    @ApiTags('VClaim')
    @Post('vclaim/sep/2.0/insert')
    @ApiOperation({ summary: 'Insert SEP versi 2.0' })
    @ApiBody({
        schema: {
            example: {
                request: {
                    t_sep: {
                        noKartu: '0001105689835',
                        tglSep: '2021-07-30',
                        ppkPelayanan: '0301R011',
                        jnsPelayanan: '1',
                        klsRawat: {
                            klsRawatHak: '2',
                            klsRawatNaik: '1',
                            pembiayaan: '1',
                            penanggungJawab: 'Pribadi',
                        },
                        noMR: 'MR9835',
                        rujukan: {
                            asalRujukan: '2',
                            tglRujukan: '2021-07-23',
                            noRujukan: 'RJKMR9835001',
                            ppkRujukan: '0301R011',
                        },
                        catatan: 'testinsert RI',
                        diagAwal: 'E10',
                        poli: {
                            tujuan: '',
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
                            noLP: '12345',
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
                        tujuanKunj: '0',
                        flagProcedure: '',
                        kdPenunjang: '',
                        assesmentPel: '',
                        skdp: {
                            noSurat: '0301R0110721K000021',
                            kodeDPJP: '31574',
                        },
                        dpjpLayan: '',
                        noTelp: '081111111101',
                        user: 'Coba Ws',
                    },
                },
            },
        },
    })
    @ApiResponse({ status: 201, description: 'Success response with decrypted SEP data' })
    async insertSepV2(@Body() body: any) {
        return await this.bpjsService.insertSepV2(body);
    }
}
