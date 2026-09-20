import { Controller, Get, Param } from '@nestjs/common';
import { LojasService } from './lojas.service.js';

@Controller('l/:slug')
export class LojasController {
  constructor(private readonly lojasService: LojasService) {}

  @Get('config')
  getConfig(@Param('slug') slug: string) {
    return this.lojasService.getConfig(slug);
  }

  @Get('cardapio')
  getCardapio(@Param('slug') slug: string) {
    return this.lojasService.getCardapio(slug);
  }
}
