import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { AdminSistemaGuard } from '../admin-sistema/admin-sistema.guard.js';
import { EncerramentoService } from './encerramento.service.js';
import type { RespostaEncerramentoInput } from './encerramento.types.js';

@Controller()
@UseGuards(AuthGuard)
export class EncerramentoController {
  constructor(private readonly encerramento: EncerramentoService) {}

  /** Questionário de encerramento do cliente (pode ser pulado pelo front). */
  @Post('me/encerramento')
  registrarCliente(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RespostaEncerramentoInput,
  ) {
    return this.encerramento.registrarCliente(user, body);
  }

  /** Questionário de encerramento da lanchonete (dono da loja). */
  @Post('admin/lanchonetes/:slug/encerramento')
  registrarLanchonete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
    @Body() body: RespostaEncerramentoInput,
  ) {
    return this.encerramento.registrarLanchonete(user, slug, body);
  }

  /**
   * Painel de motivos de cancelamento. Protected por AdminSistemaGuard
   * (sempre junto do AuthGuard). O contato informado por quem saiu é dado
   * pessoal: a service só devolve para o admin raiz.
   */
  @Get('admin-sistema/encerramentos')
  @UseGuards(AuthGuard, AdminSistemaGuard)
  resumo(@CurrentUser() user: AuthenticatedUser, @Query('dias') dias?: string) {
    const parsed = Number(dias);
    return this.encerramento.resumo(
      user,
      Number.isFinite(parsed) ? parsed : 90,
    );
  }
}
