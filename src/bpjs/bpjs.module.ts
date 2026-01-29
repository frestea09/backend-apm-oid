import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BpjsService } from './bpjs.service';
import { BpjsController } from './bpjs.controller';
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

@Module({
    imports: [
        HttpModule,
        TypeOrmModule.forFeature([
            RegistrasisDummy,
            Pasien,
            Registrasi,
            Poli,
            AntrianPoli,
            Nomorrm,
            Pegawai,
            HistoriStatus,
            Historipengunjung,
            HistorikunjunganIRJ,
        ]),
    ],
    providers: [BpjsService],
    controllers: [BpjsController],
    exports: [BpjsService],
})
export class BpjsModule { }
