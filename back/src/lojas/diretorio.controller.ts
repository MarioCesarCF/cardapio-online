import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LojasService } from './lojas.service.js';

@Controller('l')
export class DiretorioController {
  constructor(private readonly lojasService: LojasService) {}

  @Get()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  getDiretorio() {
    return this.lojasService.getDiretorio();
  }
}