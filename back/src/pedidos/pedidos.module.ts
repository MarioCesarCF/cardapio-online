import { Module } from '@nestjs/common';
import { PedidosController } from './pedidos.controller.js';
import { PedidosService } from './pedidos.service.js';
import { PedidosGateway } from './pedidos.gateway.js';

@Module({
  controllers: [PedidosController],
  providers: [PedidosService, PedidosGateway],
  exports: [PedidosGateway],
})
export class PedidosModule {}
