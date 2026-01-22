import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiResponse } from '@nestjs/swagger';
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
}
