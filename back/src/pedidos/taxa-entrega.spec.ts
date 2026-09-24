import { describe, expect, it } from 'vitest';
import { calculaTaxaEntrega, calculaTotalPedido } from './taxa-entrega.js';

describe('calculaTaxaEntrega (F8.10)', () => {
  it('cobra taxa so para entrega quando a lanchonete esta configurada', () => {
    expect(calculaTaxaEntrega('entrega', true, 8.5)).toBe(8.5);
  });

  it('retirada/consumir nao paga taxa mesmo se a lanchonete cobra', () => {
    expect(calculaTaxaEntrega('retirar', true, 8.5)).toBe(0);
    expect(calculaTaxaEntrega('consumir', true, 8.5)).toBe(0);
  });

  it('entrega sem configuracao de taxa nao cobra', () => {
    expect(calculaTaxaEntrega('entrega', false, 8.5)).toBe(0);
  });

  it('taxa nula ou nao numerica vira 0', () => {
    expect(calculaTaxaEntrega('entrega', true, 0)).toBe(0);
    expect(calculaTaxaEntrega('entrega', true, Number.NaN)).toBe(0);
  });

  it('taxa com mais de 2 casas e arredondada para 2', () => {
    expect(calculaTaxaEntrega('entrega', true, 8.555)).toBe(8.56);
  });
});

describe('calculaTotalPedido (F8.10)', () => {
  it('total = subtotal + taxa', () => {
    expect(calculaTotalPedido(100, 8.5)).toBe(108.5);
  });

  it('sem taxa o total e o subtotal', () => {
    expect(calculaTotalPedido(42.9, 0)).toBe(42.9);
  });

  it('subtotal com centavos quebrados arredonda para 2 casas', () => {
    expect(calculaTotalPedido(19.995, 1.005)).toBe(21);
  });
});
