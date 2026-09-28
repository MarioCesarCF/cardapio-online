import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ROTULOS_MODELO,
  TIPOS_MODELO,
  ehTipoModelo,
  modeloDoTipo,
  modeloSugerido,
  resumoDoModelo,
  type CardapioModelo,
} from './cardapio-modelo.js';

const DONO = '33333333-3333-3333-3333-333333333333';

// ---------------------------------------------------------------- Modelos

const MODELOS: CardapioModelo[] = TIPOS_MODELO.map((tipo) => modeloDoTipo(tipo));

describe('cardápios modelo — dados', () => {
  it('cobre os três tipos e tem rótulo em pt-BR', () => {
    expect(ROTULOS_MODELO).toEqual([
      { tipo: 'lanches', rotulo: 'Lanchonete' },
      { tipo: 'pizzaria', rotulo: 'Pizzaria' },
      { tipo: 'acai', rotulo: 'Açaíteria' },
    ]);
  });

  it('todo grupo citado por um produto existe no modelo', () => {
    for (const modelo of MODELOS) {
      const nomes = new Set(modelo.grupos.map((g) => g.nome));
      for (const categoria of modelo.categorias) {
        for (const produto of categoria.produtos) {
          for (const grupo of produto.grupos ?? []) {
            expect(nomes, `${modelo.tipo}/${produto.nome}`).toContain(grupo);
          }
        }
      }
    }
  });

  it('nomes de categoria, grupo e opção são únicos', () => {
    for (const modelo of MODELOS) {
      const categorias = modelo.categorias.map((c) => c.nome);
      expect(new Set(categorias).size, modelo.tipo).toBe(categorias.length);

      const grupos = modelo.grupos.map((g) => g.nome);
      expect(new Set(grupos).size, modelo.tipo).toBe(grupos.length);

      for (const grupo of modelo.grupos) {
        const opcoes = grupo.opcoes.map((o) => o.nome);
        expect(new Set(opcoes).size, `${modelo.tipo}/${grupo.nome}`).toBe(
          opcoes.length,
        );
      }
    }
  });

  it('nenhuma categoria fica vazia e todo preço é válido', () => {
    for (const modelo of MODELOS) {
      expect(modelo.categorias.length, modelo.tipo).toBeGreaterThan(0);
      for (const categoria of modelo.categorias) {
        expect(categoria.produtos.length, `${modelo.tipo}/${categoria.nome}`).toBeGreaterThan(0);
        for (const produto of categoria.produtos) {
          expect(produto.nome.trim().length, produto.nome).toBeGreaterThan(1);
          expect(Number.isFinite(produto.preco), produto.nome).toBe(true);
          expect(produto.preco, produto.nome).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('grupos "unica" não aceitam mais de 1 opção e obrigatórios exigem ao menos 1', () => {
    for (const modelo of MODELOS) {
      for (const grupo of modelo.grupos) {
        if (grupo.tipo === 'unica') {
          expect(grupo.maxSelecoes, `${modelo.tipo}/${grupo.nome}`).toBe(1);
        }
        if (grupo.obrigatorio) {
          expect(grupo.minSelecoes, `${modelo.tipo}/${grupo.nome}`).toBeGreaterThan(0);
        }
        // "remover" nunca divide grupo com acréscimo (o back rejeita a mistura).
        const remove = grupo.opcoes.filter((o) => o.remove);
        if (remove.length > 0) {
          expect(remove.length, `${modelo.tipo}/${grupo.nome}`).toBe(
            grupo.opcoes.length,
          );
          for (const opcao of remove) {
            expect(opcao.precoAdicional, opcao.nome).toBe(0);
          }
        }
        for (const opcao of grupo.opcoes) {
          expect(Number.isFinite(opcao.precoAdicional), opcao.nome).toBe(true);
          expect(opcao.precoAdicional, opcao.nome).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('as categorias pedidas pelo dono existem em cada modelo', () => {
    const nomes = (tipo: (typeof TIPOS_MODELO)[number]) =>
      modeloDoTipo(tipo).categorias.map((c) => c.nome);

    expect(nomes('lanches')).toEqual([
      'Hambúrgueres',
      'X-Saladas',
      'Cachorros-quentes',
      'Porções',
      'Combos',
      'Bebidas',
      'Sobremesas',
    ]);
    expect(nomes('pizzaria')).toEqual([
      'Pizzas Salgadas',
      'Pizzas Doces',
      'Bebidas',
      'Combos',
    ]);
    expect(nomes('acai')).toEqual([
      'Açaí',
      'Cremes',
      'Frutas',
      'Complementos',
      'Bebidas',
    ]);
  });

  it('resumo do modelo conta categorias, produtos, grupos e opções', () => {
    const modelo = modeloDoTipo('pizzaria');
    const resumo = resumoDoModelo(modelo);
    expect(resumo.categorias).toBe(modelo.categorias.length);
    expect(resumo.produtos).toBe(
      modelo.categorias.reduce((acc, c) => acc + c.produtos.length, 0),
    );
    expect(resumo.opcoes).toBe(
      modelo.grupos.reduce((acc, g) => acc + g.opcoes.length, 0),
    );
    expect(resumo.produtos).toBeGreaterThan(10);
  });

  it('valida o tipo e sugere o modelo pelo tipo da loja', () => {
    expect(ehTipoModelo('lanches')).toBe(true);
    expect(ehTipoModelo('acai')).toBe(true);
    expect(ehTipoModelo('sorvetes')).toBe(false);
    expect(ehTipoModelo('pizza')).toBe(false);
    expect(ehTipoModelo(undefined)).toBe(false);

    expect(modeloSugerido('pizzaria')).toBe('pizzaria');
    expect(modeloSugerido('acai')).toBe('acai');
    expect(modeloSugerido('sorvetes')).toBe('acai');
    expect(modeloSugerido('lanches')).toBe('lanches');
    expect(modeloSugerido(null)).toBe('lanches');
  });
});

// ----------------------------------------------------------------- Serviço

function prismaVazio() {
  const tx = {
    grupoOpcoes: {
      create: vi.fn(({ data }: { data: { nome: string } }) =>
        Promise.resolve({ id: `g_${data.nome}` }),
      ),
    },
    opcao: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    categoria: {
      create: vi.fn(({ data }: { data: { nome: string } }) =>
        Promise.resolve({ id: `c_${data.nome}` }),
      ),
    },
    produto: {
      create: vi.fn(({ data }: { data: { nome: string } }) =>
        Promise.resolve({ id: `p_${data.nome}` }),
      ),
    },
    produtoGrupo: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
  return {
    tx,
    prisma: {
      lanchonete: {
        findUnique: vi.fn().mockResolvedValue({ id: 'l1', donoId: DONO }),
      },
      categoria: { count: vi.fn().mockResolvedValue(0) },
      grupoOpcoes: { count: vi.fn().mockResolvedValue(0) },
      $transaction: vi.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    },
  };
}

function servico(prisma: unknown) {
  return new AdminService(prisma as PrismaService, {
    emitirStatusPedido: vi.fn(),
  } as never);
}

describe('AdminService.gerarCardapioModelo', () => {
  it('cria o cardápio completo do tipo pedido', async () => {
    const { prisma, tx } = prismaVazio();
    const modelo = modeloDoTipo('lanches');

    const resultado = await servico(prisma).gerarCardapioModelo(DONO, 'loja', {
      tipo: 'lanches',
    });

    expect(resultado).toEqual({
      ok: true,
      tipo: 'lanches',
      rotulo: 'Lanchonete',
      ...resumoDoModelo(modelo),
      vinculos: modelo.categorias
        .flatMap((c) => c.produtos)
        .reduce((acc, p) => acc + (p.grupos?.length ?? 0), 0),
    });

    expect(tx.grupoOpcoes.create).toHaveBeenCalledTimes(modelo.grupos.length);
    expect(tx.categoria.create).toHaveBeenCalledTimes(modelo.categorias.length);
    expect(tx.produto.create).toHaveBeenCalledTimes(
      modelo.categorias.reduce((acc, c) => acc + c.produtos.length, 0),
    );
    // Uma chamada de createMany por grupo com opções + uma de produto_grupos.
    expect(tx.opcao.createMany).toHaveBeenCalledTimes(modelo.grupos.length);
    expect(tx.produtoGrupo.createMany).toHaveBeenCalledTimes(1);
  });

  it('cria categorias na ordem do modelo e produtos com preço/descrição', async () => {
    const { prisma, tx } = prismaVazio();
    await servico(prisma).gerarCardapioModelo(DONO, 'loja', { tipo: 'acai' });

    const posicoes = tx.categoria.create.mock.calls.map(
      ([arg]) => (arg as { data: { posicao: number } }).data.posicao,
    );
    expect(posicoes).toEqual([0, 1, 2, 3, 4]);

    const primeiro = tx.produto.create.mock.calls[0][0] as {
      data: { nome: string; preco: number; descricao: string | null };
    };
    expect(primeiro.data.nome).toBe('Açaí Tradicional');
    expect(primeiro.data.preco).toBe(16);
    expect(primeiro.data.descricao).toContain('Açaí puro');
  });

  it('vincula só grupos que existem e marca "remover" nas removíveis', async () => {
    const { prisma, tx } = prismaVazio();
    await servico(prisma).gerarCardapioModelo(DONO, 'loja', { tipo: 'pizzaria' });

    const vinculos = (
      tx.produtoGrupo.createMany.mock.calls[0][0] as {
        data: { produtoId: string; grupoId: string; ordem: number }[];
      }
    ).data;
    expect(vinculos.length).toBeGreaterThan(0);
    // Todo grupo vinculado veio do mapa de ids criado na mesma transação.
    for (const vinculo of vinculos) {
      expect(vinculo.grupoId).toMatch(/^g_/);
      expect(vinculo.produtoId).toMatch(/^p_/);
      expect(vinculo.ordem).toBeGreaterThanOrEqual(0);
    }

    const opcoesRemover = tx.opcao.createMany.mock.calls.flatMap(
      ([arg]) => (arg as { data: { nome: string; remove: boolean }[] }).data,
    );
    const removiveis = opcoesRemover.filter((o) => o.remove).map((o) => o.nome);
    expect(removiveis).toContain('Sem cebola');
    expect(removiveis).toContain('Sem orégano');
    // Açaí não tem "remoção" com preço.
    expect(opcoesRemover.every((o) => !o.remove || o.nome.startsWith('Sem '))).toBe(
      true,
    );
  });

  it('recusa tipo inválido', async () => {
    const { prisma, tx } = prismaVazio();
    await expect(
      servico(prisma).gerarCardapioModelo(DONO, 'loja', { tipo: 'sorvetes' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.categoria.create).not.toHaveBeenCalled();
  });

  it('recusa quando já existe categoria cadastrada', async () => {
    const { prisma, tx } = prismaVazio();
    vi.mocked(prisma.categoria.count).mockResolvedValue(3);

    await expect(
      servico(prisma).gerarCardapioModelo(DONO, 'loja', { tipo: 'pizzaria' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.grupoOpcoes.create).not.toHaveBeenCalled();
  });

  it('recusa quando já existe grupo de opções cadastrado', async () => {
    const { prisma, tx } = prismaVazio();
    vi.mocked(prisma.grupoOpcoes.count).mockResolvedValue(1);

    await expect(
      servico(prisma).gerarCardapioModelo(DONO, 'loja', { tipo: 'acai' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.categoria.create).not.toHaveBeenCalled();
  });

  it('404 para lanchonete de outro dono (não revela nada)', async () => {
    const { prisma, tx } = prismaVazio();
    vi.mocked(prisma.lanchonete.findUnique).mockResolvedValue({
      id: 'l2',
      donoId: 'outro',
    });

    await expect(
      servico(prisma).gerarCardapioModelo(DONO, 'loja', { tipo: 'lanches' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.categoria.create).not.toHaveBeenCalled();
  });
});
