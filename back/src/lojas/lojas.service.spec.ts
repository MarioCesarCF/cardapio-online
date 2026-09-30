import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { LojasService } from './lojas.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const LOJA = {
  id: 'lanchonete-1',
  nome: 'Duarte Burguers',
  logoUrl: null,
  fonte: null,
  corPrincipal: '#e8800c',
  tipo: 'lanches',
  whatsapp: '5511999990001',
  emailContato: 'contato@duarte.com.br',
  enderecoLoja: 'Av. Paulista, 1000 - Sao Paulo/SP',
  horarios: null,
  cobraTaxaEntrega: true,
  taxaEntrega: { toNumber: () => 5, toString: () => '5' },
  chavePix: '+5527995077806',
  nomePix: 'Duarte LTDA',
};

function criarServico(prisma: unknown) {
  return new LojasService(prisma as PrismaService);
}

function prismaParaConfig(lanchonete: unknown) {
  return {
    lanchonete: {
      findFirst: vi.fn().mockResolvedValue(lanchonete),
    },
  };
}

describe('LojasService.getConfig (endpoint publico)', () => {
  it('informa que aceita PIX quando a loja tem chave', async () => {
    const prisma = prismaParaConfig(LOJA);
    const config = await criarServico(prisma).getConfig('duarte-burguers');

    expect(config.aceitaPix).toBe(true);
    expect(config.taxaEntrega).toBe(5);
  });

  it('NUNCA expoe a chave PIX nem o nome do titular no endpoint publico', async () => {
    const prisma = prismaParaConfig(LOJA);
    const config = await criarServico(prisma).getConfig('duarte-burguers');

    expect(config).not.toHaveProperty('chavePix');
    expect(config).not.toHaveProperty('nomePix');
    expect(JSON.stringify(config)).not.toContain('27995077806');
    expect(JSON.stringify(config)).not.toContain('Duarte LTDA');
  });

  it('informa que NAO aceita PIX quando a loja nao tem chave', async () => {
    const prisma = prismaParaConfig({ ...LOJA, chavePix: null, nomePix: null });
    const config = await criarServico(prisma).getConfig('duarte-burguers');

    expect(config.aceitaPix).toBe(false);
  });

  it('trata chave vazia como loja sem PIX', async () => {
    const prisma = prismaParaConfig({ ...LOJA, chavePix: '' });
    const config = await criarServico(prisma).getConfig('duarte-burguers');

    expect(config.aceitaPix).toBe(false);
  });

  it('filtra por situacao ativa (nao expoe loja pendente/pausada)', async () => {
    const prisma = prismaParaConfig(null);
    await expect(
      criarServico(prisma).getConfig('duarte-burguers'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.lanchonete.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: 'duarte-burguers', situacao: 'ativa' },
      }),
    );
  });
});

function prismaParaCardapio(lanchonete: unknown) {
  return {
    lanchonete: {
      findFirst: vi.fn().mockResolvedValue(lanchonete),
    },
  };
}

/** O Prisma devolve `Decimal` nos campos `Decimal` do schema. */
function decimal(valor: number) {
  return { toNumber: () => valor, toString: () => String(valor) };
}

/** Extrai o `orderBy` de produtos da consulta de cardápio que o service montou. */
function orderByProdutos(chamadas: unknown[][]): unknown {
  const [args] = chamadas[0];
  const where = (args as { include: { categorias: { include: { produtos: unknown } } } })
    .include;
  return where.categorias.include.produtos;
}

describe('LojasService.getCardapio — promoções', () => {
  const CARDAPIO = {
    id: 'lanchonete-1',
    nome: 'Duarte Burguers',
    logoUrl: null,
    fonte: null,
    corPrincipal: '#e8800c',
    tipo: 'lanches',
    whatsapp: '5511999990001',
    emailContato: null,
    enderecoLoja: null,
    categorias: [],
  };

  it('pede os produtos em promoção na frente (nulls: last)', async () => {
    const prisma = prismaParaCardapio(CARDAPIO);
    await criarServico(prisma).getCardapio('duarte-burguers');

    const produtos = orderByProdutos(prisma.lanchonete.findFirst.mock.calls) as {
      orderBy: unknown[];
    };
    expect(produtos.orderBy[0]).toEqual({
      precoPromo: { sort: 'asc', nulls: 'last' },
    });
  });

  it('mantem destaque e nome como criterio seguinte', async () => {
    const prisma = prismaParaCardapio(CARDAPIO);
    await criarServico(prisma).getCardapio('duarte-burguers');

    const produtos = orderByProdutos(prisma.lanchonete.findFirst.mock.calls) as {
      orderBy: unknown[];
    };
    expect(produtos.orderBy.slice(1)).toEqual([{ destaque: 'desc' }, { nome: 'asc' }]);
  });

  it('devolve o precoPromo dos produtos (a lanchonete precisa montar a vitrine)', async () => {
    const prisma = prismaParaCardapio({
      ...CARDAPIO,
      categorias: [
        {
          id: 'cat1',
          nome: 'Lanches',
          imagemUrl: null,
          produtos: [
            {
              id: 'p1',
              nome: 'X-Burguer',
              descricao: null,
              preco: decimal(25),
              precoPromo: decimal(19.9),
              imagemUrl: null,
              destaque: false,
              grupos: [],
            },
            {
              id: 'p2',
              nome: 'Batata',
              descricao: null,
              preco: decimal(12),
              precoPromo: null,
              imagemUrl: null,
              destaque: false,
              grupos: [],
            },
          ],
        },
      ],
    });

    const cardapio = await criarServico(prisma).getCardapio('duarte-burguers');
    const produtos = cardapio.categorias[0].produtos as {
      preco: number;
      precoPromo: number | null;
    }[];

    // A vitrine precisa dos dois números como `number` simples, senão o
    // `| currency` do front receberia um Decimal serializado como objeto.
    expect(produtos[0].preco).toBe(25);
    expect(produtos[0].precoPromo).toBe(19.9);
    expect(produtos[1].precoPromo).toBeNull();
  });
});
