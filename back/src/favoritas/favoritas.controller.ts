import { Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { FavoritasService } from './favoritas.service.js';

@Controller('favoritas')
@UseGuards(AuthGuard)
export class FavoritasController {
  constructor(private readonly favoritasService: FavoritasService) {}

  @Get()
  listar(@CurrentUser() user: AuthenticatedUser) {
    return this.favoritasService.listar(user);
  }

  @Put(':lanchoneteId')
  favoritar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lanchoneteId') lanchoneteId: string,
  ) {
    return this.favoritasService.favoritar(user, lanchoneteId);
  }

  @Delete(':lanchoneteId')
  desfavoritar(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lanchoneteId') lanchoneteId: string,
  ) {
    return this.favoritasService.desfavoritar(user, lanchoneteId);
  }
}
