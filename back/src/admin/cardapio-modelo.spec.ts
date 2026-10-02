import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CHAVES_IMAGEM_GALERIA,
  ROTULOS_MODELO,
  TIPOS_MODELO,
  chavesDeImagem,
  ehTipoModelo,
  modeloDoTipo,
  modeloSugerido,
  resumoDoModelo,
  type CardapioModelo,
} from './cardapio-modelo.js';

const DONO = '33333333-3333-3333-3333-333333333333';

// ---------------------------------------------------------------- Modelos

const MODELOS: CardapioModelo[] = TIPOS_MODELO.map((tipo) =>
  modeloDoTipo(tipo),
);

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

  it('nomes de produto são únicos (o vínculo em lote monta os ids por nome)', () => {
    for (const modelo of MODELOS) {
      const chaves = modelo.categorias.flatMap((c) =>
        c.produtos.map((p) => `${c.nome}|${p.nome}`),
      );
      expect(new Set(chaves).size, modelo.tipo).toBe(chaves.length);
    }
  });

  it('nenhuma categoria fica vazia e todo preço é válido', () => {
    for (const modelo of MODELOS) {
      expect(modelo.categorias.length, modelo.tipo).toBeGreaterThan(0);
      for (const categoria of modelo.categorias) {
        expect(
          categoria.produtos.length,
          `${modelo.tipo}/${categoria.nome}`,
        ).toBeGreaterThan(0);
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
          expect(
            grupo.minSelecoes,
            `${modelo.tipo}/${grupo.nome}`,
          ).toBeGreaterThan(0);
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

  it('toda imagem de produto usa uma chave que o seed garante', () => {
    for (const modelo of MODELOS) {
      for (const categoria of modelo.categorias) {
        for (const produto of categoria.produtos) {
          if (!produto.imagem) continue;
          expect(
            CHAVES_IMAGEM_GALERIA as readonly string[],
            `${modelo.tipo}/${produto.nome}`,
          ).toContain(produto.imagem);
        }
      }
    }
  });

  it('imagem cobre os produtos com foto natural e some nos complementos avulsos', () => {
    // Lanchonete e pizzaria: todo produto tem imagem.
    for (const tipo of ['lanches', 'pizzaria'] as const) {
      const modelo = modeloDoTipo(tipo);
      const semImagem = modelo.categorias
        .flatMap((c) => c.produtos)
        .filter((p) => !p.imagem);
      expect(semImagem, tipo).toEqual([]);
    }

    // Açaíteria: açaí, cremes, frutas e bebidas têm imagem; os 14
    // "complementos" (paçoca, granola, caldas…) ficam sem foto de propósito.
    const acai = modeloDoTipo('acai');
    const porCategoria = acai.categorias.map((c) => ({
      nome: c.nome,
      comImagem: c.produtos.filter((p) => p.imagem).length,
      total: c.produtos.length,
    }));
    expect(porCategoria).toEqual([
      { nome: 'Açaí', comImagem: 5, total: 5 },
      { nome: 'Cremes', comImagem: 4, total: 4 },
      { nome: 'Frutas', comImagem: 5, total: 5 },
      { nome: 'Complementos', comImagem: 0, total: 14 },
      { nome: 'Bebidas', comImagem: 4, total: 4 },
    ]);
    expect(resumoDoModelo(acai).comImagem).toBe(18);
  });

  it('chavesDeImagem devolve as chaves sem repetir', () => {
    const chaves = chavesDeImagem(modeloDoTipo('lanches'));
    expect(new Set(chaves).size).toBe(chaves.length);
    expect(chaves).toContain('hamburguer');
    expect(chaves).toContain('hot dog');
    expect(chaves).toContain('lata-refrigerante');
    expect(
      chavesDeImagem({ ...modeloDoTipo('lanches'), categorias: [] }),
    ).toEqual([]);
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

function prismaVazio(galeria: { url: string; keywords: string[] }[] = []) {
  // A implementação grava tudo em lote (`createMany` + uma leitura por
  // entidade), então o fake precisa devolver os ids criados para o vínculo
  // produto↔grupo ser montado por nome — igual ao banco de verdade.
  const estado = {
    grupos: [] as { id: string; nome: string }[],
    categorias: [] as { id: string; nome: string }[],
    produtos: [] as { id: string; categoriaId: string; nome: string }[],
  };
  const tx = {
    grupoOpcoes: {
      createMany: vi.fn(({ data }: { data: { nome: string }[] }) => {
        for (const grupo of data) {
          estado.grupos.push({ id: `g_${grupo.nome}`, nome: grupo.nome });
        }
        return Promise.resolve({ count: data.length });
      }),
      findMany: vi.fn(() =>
        Promise.resolve(estado.grupos.map((grupo) => ({ ...grupo }))),
      ),
    },
    opcao: {
      createMany: vi.fn(({ data }: { data: unknown[] }) =>
        Promise.resolve({ count: data.length }),
      ),
    },
    categoria: {
      createMany: vi.fn(({ data }: { data: { nome: string }[] }) => {
        for (const categoria of data) {
          estado.categorias.push({
            id: `c_${categoria.nome}`,
            nome: categoria.nome,
          });
        }
        return Promise.resolve({ count: data.length });
      }),
      findMany: vi.fn(() =>
        Promise.resolve(
          estado.categorias.map((categoria) => ({ ...categoria })),
        ),
      ),
    },
    produto: {
      createMany: vi.fn(
        ({ data }: { data: { categoriaId: string; nome: string }[] }) => {
          for (const produto of data) {
            estado.produtos.push({
              id: `p_${produto.categoriaId}|${produto.nome}`,
              categoriaId: produto.categoriaId,
              nome: produto.nome,
            });
          }
          return Promise.resolve({ count: data.length });
        },
      ),
      findMany: vi.fn(
        ({ where }: { where: { categoriaId: { in: string[] } } }) =>
          Promise.resolve(
            estado.produtos
              .filter((produto) =>
                where.categoriaId.in.includes(produto.categoriaId),
              )
              .map((produto) => ({ ...produto })),
          ),
      ),
    },
    produtoGrupo: {
      createMany: vi.fn(({ data }: { data: unknown[] }) =>
        Promise.resolve({ count: data.length }),
      ),
    },
  };
  let opcoesTransacao: unknown;
  return {
    tx,
    opcoesDaTransacao: () => opcoesTransacao,
    prisma: {
      lanchonete: {
        findUnique: vi.fn().mockResolvedValue({ id: 'l1', donoId: DONO }),
      },
      categoria: { count: vi.fn().mockResolvedValue(0) },
      grupoOpcoes: { count: vi.fn().mockResolvedValue(0) },
      galeriaImagem: { findMany: vi.fn().mockResolvedValue(galeria) },
      $transaction: vi.fn(
        (
          cb: (t: typeof tx) => unknown,
          opcoes?: { maxWait?: number; timeout?: number },
        ) => {
          opcoesTransacao = opcoes;
          return cb(tx);
        },
      ),
    },
  };
}

function servico(prisma: unknown) {
  return new AdminService(
    prisma as PrismaService,
    {
      emitirStatusPedido: vi.fn(),
    } as never,
  );
}

/** Total de queries enviadas ao banco dentro da transação. */
function queriesNaTransacao(
  tx: Record<string, Record<string, { mock: { calls: unknown[] } }>>,
) {
  return Object.values(tx)
    .flatMap((modelo) => Object.values(modelo))
    .reduce((total, metodo) => total + metodo.mock.calls.length, 0);
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
      imagens: 0,
      vinculos: modelo.categorias
        .flatMap((c) => c.produtos)
        .reduce((acc, p) => acc + (p.grupos?.length ?? 0), 0),
    });

    // Uma chamada por entidade (lote), não uma por item.
    expect(tx.grupoOpcoes.createMany).toHaveBeenCalledTimes(1);
    expect(tx.categoria.createMany).toHaveBeenCalledTimes(1);
    expect(tx.produto.createMany).toHaveBeenCalledTimes(1);
    expect(tx.opcao.createMany).toHaveBeenCalledTimes(1);
    expect(tx.produtoGrupo.createMany).toHaveBeenCalledTimes(1);
  });

  it('grava tudo em lote dentro de uma transação com timeout folgado', async () => {
    // Regressão do bug de produção: com um `create` por produto a transação
    // interativa estourava o timeout padrão (5s) no deploy e o Prisma devolvia
    // "Transaction not found" (500) sem gravar nada. Latência alta de rede.
    const { prisma, tx, opcoesDaTransacao } = prismaVazio();

    await servico(prisma).gerarCardapioModelo(DONO, 'loja', {
      tipo: 'lanches',
    });

    expect(queriesNaTransacao(tx)).toBeLessThanOrEqual(10);
    expect(opcoesDaTransacao()).toEqual({
      maxWait: expect.any(Number),
      timeout: expect.any(Number),
    });
    const { timeout, maxWait } = opcoesDaTransacao() as {
      timeout: number;
      maxWait: number;
    };
    expect(timeout).toBeGreaterThanOrEqual(30000);
    expect(maxWait).toBeGreaterThanOrEqual(5000);
  });

  it('cria categorias na ordem do modelo e produtos com preço/descrição', async () => {
    const { prisma, tx } = prismaVazio();
    await servico(prisma).gerarCardapioModelo(DONO, 'loja', { tipo: 'acai' });

    const posicoes = (
      tx.categoria.createMany.mock.calls[0][0] as {
        data: { nome: string; posicao: number }[];
      }
    ).data.map((categoria) => categoria.posicao);
    expect(posicoes).toEqual([0, 1, 2, 3, 4]);

    const primeiro = (
      tx.produto.createMany.mock.calls[0][0] as {
        data: { nome: string; preco: number; descricao: string | null }[];
      }
    ).data[0];
    expect(primeiro.nome).toBe('Açaí Tradicional');
    expect(primeiro.preco).toBe(16);
    expect(primeiro.descricao).toContain('Açaí puro');
  });

  it('vincula só grupos que existem e marca "remover" nas removíveis', async () => {
    const { prisma, tx } = prismaVazio();
    await servico(prisma).gerarCardapioModelo(DONO, 'loja', {
      tipo: 'pizzaria',
    });

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
    expect(
      opcoesRemover.every((o) => !o.remove || o.nome.startsWith('Sem ')),
    ).toBe(true);
  });

  it('coloca todas as opções do modelo (nenhum grupo fica sem as suas)', async () => {
    const { prisma, tx } = prismaVazio();
    await servico(prisma).gerarCardapioModelo(DONO, 'loja', {
      tipo: 'lanches',
    });

    const opcoes = (
      tx.opcao.createMany.mock.calls[0][0] as { data: { grupoId: string }[] }
    ).data;
    expect(opcoes.length).toBe(
      modeloDoTipo('lanches').grupos.reduce(
        (acc, g) => acc + g.opcoes.length,
        0,
      ),
    );
  });

  // ------------------------------------------------------------------ Imagens

  it('joga a imagem da galeria no produto e conta quantos ficaram com foto', async () => {
    const { prisma, tx } = prismaVazio([
      { url: 'foto-hamburguer-1', keywords: ['hamburguer', 'burger'] },
      { url: 'foto-hamburguer-2', keywords: ['hamburguer', 'burger'] },
      { url: 'foto-hotdog-1', keywords: ['hot dog', 'cachorro-quente'] },
      { url: 'foto-lata-1', keywords: ['refrigerante', 'lata-refrigerante'] },
    ]);

    const resultado = await servico(prisma).gerarCardapioModelo(DONO, 'loja', {
      tipo: 'lanches',
    });

    const criados = (
      tx.produto.createMany.mock.calls[0][0] as {
        data: { nome: string; imagemUrl: string | null }[];
      }
    ).data;
    const fotoDe = (nome: string) =>
      criados.find((p) => p.nome === nome)?.imagemUrl ?? null;

    // Foto vinda da galeria, nunca inventada — e alternando dentro da chave.
    expect(fotoDe('Hambúrguer Artesanal')).toBe('foto-hamburguer-1');
    expect(fotoDe('X-Salada')).toBe('foto-hamburguer-2');
    expect(fotoDe('X-Bacon')).toBe('foto-hamburguer-1');
    expect(fotoDe('X-Tudo')).toBe('foto-hamburguer-2');
    expect(fotoDe('X-Frango')).toBe('foto-hamburguer-1');
    // Chave de outra categoria pega só as fotos dela.
    expect(fotoDe('Cachorro-Quente')).toBe('foto-hotdog-1');
    expect(fotoDe('Cachorro-Quente Especial')).toBe('foto-hotdog-1');
    expect(fotoDe('Coca-Cola lata')).toBe('foto-lata-1');
    expect(fotoDe('Guaraná lata')).toBe('foto-lata-1');
    // Sem foto na galeria para essa chave: produto sem imagem (não quebra).
    expect(fotoDe('Batata Frita P')).toBeNull();
    expect(fotoDe('Calabresa Acebolada')).toBeNull();
    expect(fotoDe('Combo X-Salada')).toBeNull();
    // Toda URL usada existe na galeria devolvida.
    const daGaleria = [
      'foto-hamburguer-1',
      'foto-hamburguer-2',
      'foto-hotdog-1',
      'foto-lata-1',
    ];
    expect(
      criados.every(
        (p) => p.imagemUrl === null || daGaleria.includes(p.imagemUrl),
      ),
    ).toBe(true);

    expect(resultado.imagens).toBe(criados.filter((p) => p.imagemUrl).length);
    // 5 burgers (chave hamburguer) + 2 hot-dogs + 2 latas.
    expect(resultado.imagens).toBe(9);
    expect(resultado.imagens).toBeLessThanOrEqual(resultado.produtos);
  });

  it('busca a galeria só pelas chaves do modelo', async () => {
    const { prisma } = prismaVazio([]);
    await servico(prisma).gerarCardapioModelo(DONO, 'loja', { tipo: 'acai' });

    const [arg] = vi.mocked(prisma.galeriaImagem.findMany).mock.calls[0] as [
      {
        where: { keywords: { hasSome: string[] } };
        orderBy: unknown;
        select: unknown;
      },
    ];
    expect(arg.where.keywords.hasSome.sort()).toEqual(
      [...chavesDeImagem(modeloDoTipo('acai'))].sort(),
    );
    expect(arg.select).toEqual({ url: true, keywords: true });
  });

  it('galeria vazia não impede a criação do cardápio', async () => {
    const { prisma, tx } = prismaVazio([]);
    const resultado = await servico(prisma).gerarCardapioModelo(DONO, 'loja', {
      tipo: 'pizzaria',
    });
    expect(resultado.imagens).toBe(0);
    expect(
      (
        tx.produto.createMany.mock.calls[0][0] as {
          data: { imagemUrl: string | null }[];
        }
      ).data.every((produto) => produto.imagemUrl === null),
    ).toBe(true);
  });

  it('recusa tipo inválido', async () => {
    const { prisma, tx } = prismaVazio();
    await expect(
      servico(prisma).gerarCardapioModelo(DONO, 'loja', { tipo: 'sorvetes' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.categoria.createMany).not.toHaveBeenCalled();
  });

  it('recusa quando já existe categoria cadastrada', async () => {
    const { prisma, tx } = prismaVazio();
    vi.mocked(prisma.categoria.count).mockResolvedValue(3);

    await expect(
      servico(prisma).gerarCardapioModelo(DONO, 'loja', { tipo: 'pizzaria' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.grupoOpcoes.createMany).not.toHaveBeenCalled();
  });

  it('recusa quando já existe grupo de opções cadastrado', async () => {
    const { prisma, tx } = prismaVazio();
    vi.mocked(prisma.grupoOpcoes.count).mockResolvedValue(1);

    await expect(
      servico(prisma).gerarCardapioModelo(DONO, 'loja', { tipo: 'acai' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.categoria.createMany).not.toHaveBeenCalled();
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
    expect(tx.categoria.createMany).not.toHaveBeenCalled();
  });
});
