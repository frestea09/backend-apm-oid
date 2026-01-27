import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BpjsService } from './bpjs.service';
import { BpjsController } from './bpjs.controller';
import { RegistrasisDummy } from './entities/registrasis-dummy.entity';

@Module({
    imports: [
        HttpModule,
        TypeOrmModule.forFeature([RegistrasisDummy]),
    ],
    providers: [BpjsService],
    controllers: [BpjsController],
    exports: [BpjsService],
})
export class BpjsModule { }
