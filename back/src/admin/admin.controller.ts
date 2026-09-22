import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { AdminService } from './admin.service.js';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

@Controller('admin')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('lanchonetes')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.admin.listMine(user.id);
  }

  @Post('lanchonetes')
  createLanchonete(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.admin.create(user.id, body);
  }

  @Get('lanchonetes/:slug')
  getConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
  ) {
    return this.admin.getConfig(user.id, slug);
  }

  @Patch('lanchonetes/:slug')
  updateConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.admin.updateConfig(user.id, slug, body);
  }

  @Delete('lanchonetes/:slug')
  removeLanchonete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
  ) {
    return this.admin.remove(user.id, slug);
  }

  @Get('lanchonetes/:slug/cardapio')
  getCardapio(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
  ) {
    return this.admin.getCardapioAdmin(user.id, slug);
  }

  @Get('lanchonetes/:slug/pedidos')
  listPedidos(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
    @Query('status') status?: string,
    @Query('historico') historico?: string,
  ) {
    return this.admin.listPedidos(user.id, slug, status, historico === '1');
  }

  @Patch('pedidos/:idPedido/status')
  updatePedidoStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('idPedido') idPedido: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.admin.updatePedidoStatus(user.id, idPedido, body);
  }

  @Post('lanchonetes/:slug/categorias')
  createCategoria(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.admin.createCategoria(user.id, slug, body);
  }

  @Patch('categorias/:idCat')
  updateCategoria(
    @CurrentUser() user: AuthenticatedUser,
    @Param('idCat') idCat: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.admin.updateCategoria(user.id, idCat, body);
  }

  @Delete('categorias/:idCat')
  removeCategoria(
    @CurrentUser() user: AuthenticatedUser,
    @Param('idCat') idCat: string,
  ) {
    return this.admin.removeCategoria(user.id, idCat);
  }

  @Post('categorias/:idCat/produtos')
  createProduto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('idCat') idCat: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.admin.createProduto(user.id, idCat, body);
  }

  @Patch('produtos/:idProd')
  updateProduto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('idProd') idProd: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.admin.updateProduto(user.id, idProd, body);
  }

  @Delete('produtos/:idProd')
  removeProduto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('idProd') idProd: string,
  ) {
    return this.admin.removeProduto(user.id, idProd);
  }

  @Put('produtos/:idProd/grupos')
  setProdutoGrupos(
    @CurrentUser() user: AuthenticatedUser,
    @Param('idProd') idProd: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.admin.setProdutoGrupos(user.id, idProd, body);
  }

  @Post('lanchonetes/:slug/grupos')
  createGrupo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.admin.createGrupo(user.id, slug, body);
  }

  @Patch('grupos/:idGrupo')
  updateGrupo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('idGrupo') idGrupo: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.admin.updateGrupo(user.id, idGrupo, body);
  }

  @Delete('grupos/:idGrupo')
  removeGrupo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('idGrupo') idGrupo: string,
  ) {
    return this.admin.removeGrupo(user.id, idGrupo);
  }

  @Post('grupos/:idGrupo/opcoes')
  createOpcao(
    @CurrentUser() user: AuthenticatedUser,
    @Param('idGrupo') idGrupo: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.admin.createOpcao(user.id, idGrupo, body);
  }

  @Patch('opcoes/:idOpcao')
  updateOpcao(
    @CurrentUser() user: AuthenticatedUser,
    @Param('idOpcao') idOpcao: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.admin.updateOpcao(user.id, idOpcao, body);
  }

  @Delete('opcoes/:idOpcao')
  removeOpcao(
    @CurrentUser() user: AuthenticatedUser,
    @Param('idOpcao') idOpcao: string,
  ) {
    return this.admin.removeOpcao(user.id, idOpcao);
  }
}
