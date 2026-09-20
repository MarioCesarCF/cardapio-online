import { Module } from '@nestjs/common';
import { PlataformaController } from './plataforma.controller.js';
import { PlataformaService } from './plataforma.service.js';

@Module({
  controllers: [PlataformaController],
  providers: [PlataformaService],
})
export class PlataformaModule {}
