import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LojasService } from './lojas.service.js';

// Rotas públicas do cardápio: sob o limite global 100/min, um crawler varre o
// catálogo da plataforma inteira sem esforço — 30/min por IP é o teto aqui.
@Controller('l/:slug')
@Throttle({ default: { ttl: 60_000, limit: 30 } })
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