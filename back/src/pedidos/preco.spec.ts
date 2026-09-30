import { describe, expect, it } from 'vitest';
import { montaPrecoUnit, precoDoProduto } from './preco.js';

describe('precoDoProduto', () => {
  it('usa o preço normal quando não há promoção', () => {
    expect(precoDoProduto({ preco: 25, precoPromo: null })).toBe(25);
  });

  it('usa a promoção quando ela é menor que o preço normal', () => {
    expect(precoDoProduto({ preco: 25, precoPromo: 19.9 })).toBe(19.9);
  });

  it('aceita promoção zero (item grátis de verdade)', () => {
    expect(precoDoProduto({ preco: 25, precoPromo: 0 })).toBe(0);
  });

  it('ignora promoção maior que o preço normal (dado sujo no banco)', () => {
    expect(precoDoProduto({ preco: 25, precoPromo: 30 })).toBe(25);
  });

  it('ignora promoção igual ao preço normal', () => {
    expect(precoDoProduto({ preco: 25, precoPromo: 25 })).toBe(25);
  });

  it('ignora promoção negativa', () => {
    expect(precoDoProduto({ preco: 25, precoPromo: -5 })).toBe(25);
  });

  it('ignora promoção não numérica', () => {
    expect(precoDoProduto({ preco: 25, precoPromo: 'abc' })).toBe(25);
  });

  it('funciona quando o campo de promoção nem existe no payload', () => {
    expect(precoDoProduto({ preco: 25 })).toBe(25);
  });

  it('aceita Decimal do Prisma (string) sem perder precisão', () => {
    expect(precoDoProduto({ preco: '25.00', precoPromo: '19.90' })).toBe(19.9);
  });
});

describe('montaPrecoUnit', () => {
  it('soma o adicional das opções ao preço promocional', () => {
    expect(
      montaPrecoUnit({ preco: 25, precoPromo: 19.9 }, [
        { precoAdicional: 3 },
        { precoAdicional: 2.5 },
      ]),
    ).toBe(25.4);
  });

  it('opção de remover não acrescenta nada', () => {
    expect(
      montaPrecoUnit({ preco: 25, precoPromo: null }, [
        { precoAdicional: 0, remove: true },
        { precoAdicional: 2 },
      ]),
    ).toBe(27);
  });

  it('arredonda para centavos', () => {
    expect(
      montaPrecoUnit({ preco: 10, precoPromo: 9.99 }, [{ precoAdicional: 0.005 }]),
    ).toBe(10);
  });

  it('sem opções devolve só o preço do produto', () => {
    expect(montaPrecoUnit({ preco: 32.9, precoPromo: null }, [])).toBe(32.9);
  });
});
