import { Module } from '@nestjs/common';
import { PedidosController } from './pedidos.controller.js';
import { PedidosService } from './pedidos.service.js';
import { PedidosGateway } from './pedidos.gateway.js';
import { PedidosMaintService } from './pedidos-maint.service.js';

@Module({
  controllers: [PedidosController],
  providers: [PedidosService, PedidosGateway, PedidosMaintService],
  exports: [PedidosGateway],
})
export class PedidosModule {}
