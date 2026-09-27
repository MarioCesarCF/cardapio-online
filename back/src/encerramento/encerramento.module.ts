import { Module } from '@nestjs/common';
import { EncerramentoController } from './encerramento.controller.js';
import { EncerramentoService } from './encerramento.service.js';
import { AdminSistemaGuard } from '../admin-sistema/admin-sistema.guard.js';

@Module({
  controllers: [EncerramentoController],
  providers: [EncerramentoService, AdminSistemaGuard],
})
export class EncerramentoModule {}
