import { Module } from '@nestjs/common';
import { AdminSistemaController } from './admin-sistema.controller.js';
import { AdminSistemaService } from './admin-sistema.service.js';
import { AdminSistemaGuard } from './admin-sistema.guard.js';

@Module({
  controllers: [AdminSistemaController],
  providers: [AdminSistemaService, AdminSistemaGuard],
})
export class AdminSistemaModule {}
