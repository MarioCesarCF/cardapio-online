import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { PedidosService, type CriaPedidoInput } from './pedidos.service.js';

@Controller('l')
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post(':slug/pedidos')
  @UseGuards(AuthGuard)
  criaPedido(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CriaPedidoInput,
  ) {
    return this.pedidosService.criaPedido(slug, user, body);
  }
}
