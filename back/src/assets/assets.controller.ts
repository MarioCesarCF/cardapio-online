import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
} from '@nestjs/common';

const LOGO_TIPOS: Record<string, string> = {
  lanches: '🍔',
  pizzaria: '🍕',
  sorvetes: '🍨',
  acai: '🍧',
};

const LOGO_CORES: Record<string, string> = {
  lanches: '#e8800c',
  pizzaria: '#d64541',
  sorvetes: '#f2a2c5',
  acai: '#6b3fa0',
};

function svgLogo(emoji: string, cor: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect width="200" height="200" rx="44" fill="${cor}"/>
  <text x="100" y="126" font-size="92" text-anchor="middle">${emoji}</text>
</svg>`;
}

@Controller('assets')
export class AssetsController {
  @Get('logo-:tipo.svg')
  @Header('Content-Type', 'image/svg+xml')
  @Header('Cache-Control', 'public, max-age=86400')
  logo(@Param('tipo') tipo: string): string {
    const emoji = LOGO_TIPOS[tipo];
    const cor = LOGO_CORES[tipo];
    if (!emoji || !cor) {
      throw new NotFoundException('Logo não encontrado');
    }
    return svgLogo(emoji, cor);
  }
}
