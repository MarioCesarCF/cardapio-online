import { Controller, Get } from '@nestjs/common';
import { LojasService } from './lojas.service.js';

@Controller('l')
export class DiretorioController {
  constructor(private readonly lojasService: LojasService) {}

  @Get()
  getDiretorio() {
    return this.lojasService.getDiretorio();
  }
}
