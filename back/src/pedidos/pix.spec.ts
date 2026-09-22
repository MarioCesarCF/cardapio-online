import { describe, expect, it } from 'vitest';
import { calcularCrc16, gerarBrCode, normalizarChavePix } from './pix.js';

const CHAVE = '+5511999999999';

// Decodificação independente do payload EMV: retorna o mapa de campos do nível
// (id -> { len, valor }); quando o valor é um TLV interno, expõe subcampos.
function decodificar(
  payload: string,
): Map<string, { valor: string; campo: Map<string, string> | null }> {
  const mapa = new Map<
    string,
    { valor: string; campo: Map<string, string> | null }
  >();
  let i = 0;
  while (i + 4 <= payload.length) {
    const id = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    const valor = payload.slice(i + 4, i + 4 + len);
    i += 4 + len;
    let campo: Map<string, string> | null = null;
    if (/^\d{2}\d{2}/.test(valor)) {
      campo = new Map();
      let j = 0;
      while (j + 4 <= valor.length) {
        const subId = valor.slice(j, j + 2);
        const subLen = Number(valor.slice(j + 2, j + 4));
        campo.set(subId, valor.slice(j + 4, j + 4 + subLen));
        j += 4 + subLen;
      }
    }
    mapa.set(id, { valor, campo });
  }
  return mapa;
}

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

  it('embute a chave normalizada (sem máscara) no campo 26/01 e o CRC bate', () => {
    const br = gerarBrCode({
      chavePix: '(11) 99999-9999',
      nomeTitular: 'Fulano de Tal',
      valorTotal: 2,
    });
    const campos = decodificar(br.slice(0, -4)); // remove o 6304+crc do fim
    const conta = campos.get('26')!.campo!;
    expect(campos.get('26')!.valor).toContain('br.gov.bcb.pix');
    expect(conta.get('01')).toBe('+5511999999999');
    expect(calcularCrc16(br.slice(0, -4))).toBe(br.slice(-4));
  });

  it('br code com CPF/CNPJ/e-mail usa a chave normalizada', () => {
    const brCpf = gerarBrCode({
      chavePix: '123.456.789-09',
      nomeTitular: 'Fulano',
      valorTotal: 1,
    });
    expect(decodificar(brCpf.slice(0, -4)).get('26')!.campo!.get('01')).toBe(
      '12345678909',
    );

    const brEmail = gerarBrCode({
      chavePix: 'DUARTE@Teste.dev',
      nomeTitular: 'Fulano',
      valorTotal: 1,
    });
    expect(decodificar(brEmail.slice(0, -4)).get('26')!.campo!.get('01')).toBe(
      'duarte@teste.dev',
    );
  });
});

describe('normalizarChavePix', () => {
  it('telefone vira dígitos com DDI +55', () => {
    expect(normalizarChavePix('(11) 99999-9999')).toBe('+5511999999999');
    expect(normalizarChavePix('11 99999-9999')).toBe('+5511999999999');
    expect(normalizarChavePix('11999999999')).toBe('+5511999999999');
  });

  it('telefone já com DDI não duplica o +55', () => {
    expect(normalizarChavePix('+55 11 99999-9999')).toBe('+5511999999999');
    expect(normalizarChavePix('+5511999999999')).toBe('+5511999999999');
    expect(normalizarChavePix('5511999999999')).toBe('+5511999999999');
  });

  it('CPF e CNPJ viram apenas dígitos', () => {
    expect(normalizarChavePix('123.456.789-09')).toBe('12345678909');
    expect(normalizarChavePix('12.345.678/0001-95')).toBe('12345678000195');
  });

  it('11 dígitos sem CPF válido viram telefone com +55', () => {
    expect(normalizarChavePix('11999999999')).toBe('+5511999999999');
  });

  it('e-mail vira minúsculo e sem espaços nas pontas', () => {
    expect(normalizarChavePix('  Duarte@Teste.dev  ')).toBe('duarte@teste.dev');
  });

  it('chave aleatória apenas com trim', () => {
    expect(normalizarChavePix('  abc-def-123  ')).toBe('abc-def-123');
  });

  it('idempotente e vazio preservado', () => {
    expect(normalizarChavePix(normalizarChavePix('+55 (11) 99999-9999'))).toBe(
      '+5511999999999',
    );
    expect(normalizarChavePix('')).toBe('');
    expect(normalizarChavePix('   ')).toBe('');
  });
});
