import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { AdminSistemaGuard } from './admin-sistema.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { AdminSistemaService } from './admin-sistema.service.js';

@Controller('admin-sistema')
@UseGuards(AuthGuard, AdminSistemaGuard)
export class AdminSistemaController {
  constructor(private readonly adminSistemaService: AdminSistemaService) {}

  @Get('lanchonetes')
  listarLanchonetes() {
    return this.adminSistemaService.listarLanchonetes();
  }

  @Get('lanchonetes/:id')
  consultarLanchonete(@Param('id') id: string) {
    return this.adminSistemaService.consultarLanchonete(id);
  }

  @Get('lanchonetes/:id/cardapio')
  consultarCardapio(@Param('id') id: string) {
    return this.adminSistemaService.consultarCardapio(id);
  }

  @Get('lanchonetes/:id/pedidos')
  consultarPedidos(@Param('id') id: string, @Query('status') status?: string) {
    return this.adminSistemaService.consultarPedidos(id, status);
  }

  @Patch('lanchonetes/:id/situacao')
  alterarSituacao(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminSistemaService.alterarSituacao(id, body, user);
  }

  @Patch('lanchonetes/:id/plano')
  alterarPlano(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminSistemaService.alterarPlano(id, body, user);
  }

  @Delete('lanchonetes/:id')
  removerLanchonete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminSistemaService.removerLanchonete(id, user);
  }

  @Get('logs')
  listarLogs(
    @Query('nivel') nivel?: string,
    @Query('categoria') categoria?: string,
    @Query('limite') limite?: string,
  ) {
    const limiteNum =
      limite !== undefined ? Number.parseInt(limite, 10) : undefined;
    return this.adminSistemaService.listarLogs({
      nivel,
      categoria,
      limite: Number.isNaN(limiteNum) ? undefined : limiteNum,
    });
  }

  @Get('admins')
  listarAdmins() {
    return this.adminSistemaService.listarAdmins();
  }

  @Post('admins')
  criarAdmin(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminSistemaService.criarAdmin(user, body);
  }

  @Get('plataforma')
  consultarPlataforma() {
    return this.adminSistemaService.getPlataforma();
  }

  @Patch('plataforma')
  atualizarPlataforma(
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminSistemaService.updatePlataforma(user, body);
  }

  @Delete('admins/:id')
  removerAdmin(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminSistemaService.removerAdmin(id, user);
  }

  @Patch('admins/:id')
  atualizarAdmin(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminSistemaService.atualizarAdmin(id, body, user);
  }
}
