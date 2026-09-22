import { describe, expect, it } from 'vitest';
import { normalizarNumeroWhatsApp } from './whatsapp.utils.js';

describe('whatsapp.utils.ts', () => {
  it('mantém número já em E.164 com DDI brasileiro', () => {
    expect(normalizarNumeroWhatsApp('5511999990001')).toBe('5511999990001');
    expect(normalizarNumeroWhatsApp('5527998927442')).toBe('5527998927442');
  });

  it('adiciona o DDI 55 a celulares/telefones sem código do país', () => {
    expect(normalizarNumeroWhatsApp('11999990001')).toBe('5511999990001');
    expect(normalizarNumeroWhatsApp('2799999999')).toBe('552799999999');
    expect(normalizarNumeroWhatsApp('27992892742')).toBe('5527992892742');
  });

  it('remove máscaras, espaços e o +', () => {
    expect(normalizarNumeroWhatsApp('+55 (27) 99928-9274')).toBe(
      '5527999289274',
    );
    expect(normalizarNumeroWhatsApp('55 11 99999-0001')).toBe('5511999990001');
  });

  it('rejeita entradas inválidas', () => {
    expect(() => normalizarNumeroWhatsApp('')).toThrow(/WhatsApp inválido/);
    expect(() => normalizarNumeroWhatsApp('abc')).toThrow(/WhatsApp inválido/);
    expect(() => normalizarNumeroWhatsApp('999')).toThrow(/WhatsApp inválido/);
    expect(() => normalizarNumeroWhatsApp('55279995077806')).toThrow(
      /WhatsApp inválido/,
    );
    expect(() => normalizarNumeroWhatsApp('119999900')).toThrow(
      /WhatsApp inválido/,
    );
    expect(() => normalizarNumeroWhatsApp(null)).toThrow(/WhatsApp inválido/);
    expect(() => normalizarNumeroWhatsApp(1234567890)).toThrow(
      /WhatsApp inválido/,
    );
  });
});