import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BpjsModule } from './bpjs/bpjs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BpjsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
