import { Controller, Get, Query } from '@nestjs/common';
import { GaleriaService } from './galeria.service.js';

@Controller('galeria')
export class GaleriaController {
  constructor(private readonly galeria: GaleriaService) {}

  @Get('categorias')
  categorias() {
    return this.galeria.categorias();
  }

  @Get()
  list(@Query('q') q?: string, @Query('categoria') categoria?: string) {
    return this.galeria.list(q, categoria);
  }
}
