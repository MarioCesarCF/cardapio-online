import { describe, expect, it } from 'vitest';
import { calcularCrc16, gerarBrCode } from './pix.js';

const CHAVE = '+5511999999999';

describe('pix.ts', () => {
  it('gera um BR Code com estrutura EMV e CRC válido', () => {
    const br = gerarBrCode({
      chavePix: CHAVE,
      nomeTitular: 'Fulano de Tal',
      valorTotal: 10.5,
    });

    expect(br.slice(0, 6)).toBe('000201');
    expect(br).toContain('br.gov.bcb.pix');
    expect(br).toContain('520400005303986');
    expect(br).toContain('5802BR');
    expect(br).toContain('540510.50');
    expect(br).toContain('62070503***');
    expect(br).toMatch(/6304[0-9A-F]{4}$/);

    const crc = br.slice(-4);
    expect(calcularCrc16(br.slice(0, -4))).toBe(crc);
  });

  it('normaliza nome e cidade (sem acentos, maiúsculo)', () => {
    const br = gerarBrCode({
      chavePix: CHAVE,
      nomeTitular: 'Bar do João & Cia',
      cidade: 'São Paulo/SP',
      valorTotal: 1,
    });

    expect(br).toContain('BAR DO JOAO');
    expect(br).toContain('SAO PAULO');
  });
});
