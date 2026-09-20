import { Controller, Get } from '@nestjs/common';
import { PlataformaService } from './plataforma.service.js';

@Controller('plataforma')
export class PlataformaController {
  constructor(private readonly plataformaService: PlataformaService) {}

  @Get('email-lojista')
  emailLojista() {
    return this.plataformaService.emailLojista();
  }
}
