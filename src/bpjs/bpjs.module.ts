import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BpjsService } from './bpjs.service';
import { BpjsController } from './bpjs.controller';

@Module({
    imports: [HttpModule],
    providers: [BpjsService],
    controllers: [BpjsController],
    exports: [BpjsService],
})
export class BpjsModule { }
