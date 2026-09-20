import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import {
  MeService,
  type AtualizaPerfilInput,
  type CriaEnderecoInput,
} from './me.service.js';

@Controller('me')
@UseGuards(AuthGuard)
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.meService.getMe(user);
  }

  @Patch()
  atualizarPerfil(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AtualizaPerfilInput,
  ) {
    return this.meService.atualizarPerfil(user, body);
  }

  @Get('enderecos')
  listarEnderecos(@CurrentUser() user: AuthenticatedUser) {
    return this.meService.listarEnderecos(user);
  }

  @Post('enderecos')
  criarEndereco(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CriaEnderecoInput,
  ) {
    return this.meService.criarEndereco(user, body);
  }

  @Patch('enderecos/:enderecoId')
  atualizarEndereco(
    @CurrentUser() user: AuthenticatedUser,
    @Param('enderecoId') enderecoId: string,
    @Body() body: Partial<CriaEnderecoInput>,
  ) {
    return this.meService.atualizarEndereco(user, enderecoId, body);
  }

  @Delete('enderecos/:enderecoId')
  removerEndereco(
    @CurrentUser() user: AuthenticatedUser,
    @Param('enderecoId') enderecoId: string,
  ) {
    return this.meService.removerEndereco(user, enderecoId);
  }

  @Get('pedidos')
  listarPedidos(@CurrentUser() user: AuthenticatedUser) {
    return this.meService.listarPedidos(user);
  }
}
