import { describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PedidosService } from './pedidos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';

const USUARIO = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'cliente@teste.dev',
  name: 'Cliente Teste',
} as unknown as AuthenticatedUser;

function conflitoNumero(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'teste',
    meta: { target: ['lanchoneteId', 'numero'] },
  });
}

function produtoBase() {
  return {
    id: 'prod1',
    nome: 'X-Burger',
    preco: 20,
    precoPromo: null,
    destaque: false,
    grupos: [
      {
        ordem: 0,
        grupo: {
          id: 'gr1',
          nome: 'Adicionais',
          tipo: 'multipla',
          obrigatorio: false,
          minSelecoes: 0,
          maxSelecoes: null,
          opcoes: [
            {
              id: 'op1',
              nome: 'Bacon',
              precoAdicional: 3,
              remove: false,
              ativa: true,
            },
          ],
        },
      },
    ],
  };
}

function lanchoneteBase() {
  return {
    id: 'l1',
    slug: 'loja',
    nome: 'Loja',
    situacao: 'ativa',
    horarios: null,
    plano: 'pago',
    planoExpira: null,
    cobraTaxaEntrega: false,
    taxaEntrega: 0,
    chavePix: 'pix@teste.dev',
    nomePix: 'Loja',
    notifWhatsapp: false,
    whatsapp: null,
  };
}

/**
 * Banco falso que reproduz os três mecanismos que importam aqui:
 *
 * 1. `@@unique([lanchoneteId, numero])` — dois pedidos com o mesmo número na
 *    mesma loja viram P2002, como o Postgres faria.
 * 2. `pg_advisory_xact_lock` — **serializa de verdade** a reserva por loja, com
 *    uma fila de promessas liberada no fim da transação. É o que o banco faz.
 * 3. `$queryRawUnsafe` do `MAX(numero)+1` — lê o que já está gravado, ou seja,
 *    enxerga o número do pedido anterior quando o lock está funcionando.
 */
function prismaComNumeroUnico() {
  const numeros = new Set<string>();
  const filas = new Map<string, Promise<void>>();
  const estado = {
    locks: 0,
    leiturasMax: 0,
    tentativas: 0,
    p2002: 0,
    sqls: [] as string[],
    opcoes: null as unknown,
  };

  /** Fila por loja: só uma transação por vez entra no trecho crítico. */
  function adquirir(loja: string): Promise<void> {
    const anterior = filas.get(loja) ?? Promise.resolve();
    let liberar!: () => void;
    const minha = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    filas.set(loja, anterior.then(() => minha));
    return anterior.then(() => liberar);
  }

  async function lerMax(loja: string) {
    estado.leiturasMax++;
    const usados = [...numeros].filter((k) => k.endsWith(`|${loja}`));
    const max = usados.reduce((acc, k) => Math.max(acc, Number(k.split('|')[0])), 0);
    return [{ next: BigInt(max + 1) }];
  }

  const prisma = {
    lanchonete: { findFirst: vi.fn().mockResolvedValue(lanchoneteBase()) },
    produto: { findMany: vi.fn().mockResolvedValue([produtoBase()]) },
    cliente: { upsert: vi.fn().mockResolvedValue({}) },
    lanchoneteFavorita: { upsert: vi.fn().mockResolvedValue({}) },
    $queryRawUnsafe: vi.fn((_sql: string, loja: string) => lerMax(loja)),
    $transaction: vi.fn(
      async (fn: (tx: unknown) => unknown, opcoes?: unknown) => {
        estado.tentativas++;
        estado.opcoes = opcoes;
        const liberados: Array<() => void> = [];
        const tx = {
          $queryRawUnsafe: vi.fn(async (sql: string, loja: string) => {
            estado.sqls.push(sql);
            if (sql.includes('pg_advisory_xact_lock')) {
              estado.locks++;
              liberados.push(await adquirir(loja));
              return [{ pg_advisory_xact_lock: null }];
            }
            return lerMax(loja);
          }),
          pedido: {
            create: vi.fn(async ({ data }: any) => {
              const chave = `${data.numero}|${data.lanchoneteId}`;
              if (numeros.has(chave)) {
                estado.p2002++;
                throw conflitoNumero();
              }
              numeros.add(chave);
              return {
                id: `ped${data.numero}`,
                numero: data.numero,
                status: data.status,
                tipoEntrega: data.tipoEntrega,
                formaPagamento: data.formaPagamento,
                pagamentoInfo: data.pagamentoInfo ?? null,
                pixConfirmado: false,
                subtotal: data.subtotal,
                taxaEntrega: data.taxaEntrega,
                total: data.total,
                brCodePix: data.brCodePix ?? null,
                arquivado: false,
                createdAt: new Date(),
                itens: [],
              };
            }),
          },
        };
        try {
          return await fn(tx);
        } finally {
          // COMMIT ou ROLLBACK: o lock de transação é liberado.
          liberados.reverse().forEach((liberar) => liberar());
        }
      },
    ),
  };

  return { prisma, estado, numeros };
}

function criarServico(prisma: unknown) {
  const gateway = { emitirNovoPedido: vi.fn(), emitirStatusPedido: vi.fn() };
  const whatsapp = { configured: false, enviarNovoPedido: vi.fn() };
  return new PedidosService(
    prisma as PrismaService,
    gateway as never,
    whatsapp as never,
  );
}

function pedidoSimples() {
  // `retirar` para não exigir endereço (o resto da validação não é alvo aqui).
  return {
    itens: [{ produtoId: 'prod1', qtd: 1 }],
    formaPagamento: 'dinheiro',
    tipoEntrega: 'retirar',
  };
}

/**
 * Simula outro processo gravando pedido por fora (sem passar pelo lock do
 * serviço): o `MAX` sempre aponta para um número já reservado e a gravação sempre
 * colide — é o pior caso, que precisa virar 503 e não 500.
 */
function colisaoPermanente(
  prisma: any,
  numeros: Set<string>,
  estado: { tentativas: number; p2002: number },
  loja = 'l1',
) {
  numeros.add(`7|${loja}`);
  prisma.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => {
    estado.tentativas++;
    return fn({
      $queryRawUnsafe: async () => [{ next: BigInt(7) }],
      pedido: {
        create: async () => {
          estado.p2002++;
          throw conflitoNumero();
        },
      },
    });
  });
}

describe('PedidosService — número do pedido sob acesso simultâneo', () => {
  it('grava o pedido em uma tentativa só quando não há disputa', async () => {
    const { prisma, estado } = prismaComNumeroUnico();
    const servico = criarServico(prisma);

    const pedido = await servico.criaPedido('loja', USUARIO, pedidoSimples());

    expect(pedido.numero).toBe(1);
    expect(estado.tentativas).toBe(1);
    expect(estado.leiturasMax).toBe(1);
    expect(estado.locks).toBe(1);
    expect(estado.p2002).toBe(0);
  });

  it('reserva o número dentro de um lock de transação por loja', async () => {
    const { prisma, estado } = prismaComNumeroUnico();
    const servico = criarServico(prisma);

    await servico.criaPedido('loja', USUARIO, pedidoSimples());

    // O lock é a garantia real: sem ele o `MAX` é lido sem proteção.
    expect(estado.sqls[0]).toContain('pg_advisory_xact_lock');
    expect(estado.sqls[1]).toContain('MAX(numero)');
    // O lock segura a transação na fila, então o default de 5s do Prisma não serve.
    expect(estado.opcoes).toMatchObject({ maxWait: 20000, timeout: 30000 });
  });

  it('numera em ordem quando os checkouts chegam um atrás do outro', async () => {
    const { prisma, estado } = prismaComNumeroUnico();
    const servico = criarServico(prisma);

    const primeiro = await servico.criaPedido('loja', USUARIO, pedidoSimples());
    const segundo = await servico.criaPedido('loja', USUARIO, pedidoSimples());

    expect(primeiro.numero).toBe(1);
    expect(segundo.numero).toBe(2);
    expect(estado.tentativas).toBe(2);
    expect(estado.p2002).toBe(0);
  });

  it('dois checkouts simultâneos saem com números diferentes, sem colidir', async () => {
    const { prisma, estado, numeros } = prismaComNumeroUnico();
    const servico = criarServico(prisma);

    const [a, b] = await Promise.all([
      servico.criaPedido('loja', USUARIO, pedidoSimples()),
      servico.criaPedido('loja', USUARIO, pedidoSimples()),
    ]);

    expect([a.numero, b.numero].sort()).toEqual([1, 2]);
    expect(numeros.size).toBe(2);
    // O lock faz o trabalho: sem precisar do retry.
    expect(estado.tentativas).toBe(2);
    expect(estado.p2002).toBe(0);
  });

  it('nove checkouts simultâneos saem com 1..9 sem colisão', async () => {
    const { prisma, estado, numeros } = prismaComNumeroUnico();
    const servico = criarServico(prisma);

    const pedidos = await Promise.all(
      Array.from({ length: 9 }, () =>
        servico.criaPedido('loja', USUARIO, pedidoSimples()),
      ),
    );

    expect(pedidos.map((p) => p.numero).sort((x, y) => x - y)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(numeros.size).toBe(9);
    expect(estado.p2002).toBe(0);
    expect(estado.tentativas).toBe(9);
  });

  it('vinte checkouts simultâneos não geram nenhum 503', async () => {
    // Regressão do teste de carga: com o retry sozinho, 20 checkouts na mesma
    // loja produziam ~32 respostas 503 em 8s (todos liam o mesmo MAX).
    const { prisma, estado, numeros } = prismaComNumeroUnico();
    const servico = criarServico(prisma);

    const pedidos = await Promise.all(
      Array.from({ length: 20 }, () =>
        servico.criaPedido('loja', USUARIO, pedidoSimples()),
      ),
    );

    expect(pedidos.map((p) => p.numero).sort((x, y) => x - y)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    expect(numeros.size).toBe(20);
    expect(estado.p2002).toBe(0);
  });

  it('devolve 503 (não 500) quando o conflito persiste em todas as tentativas', async () => {
    const { prisma, estado, numeros } = prismaComNumeroUnico();
    colisaoPermanente(prisma, numeros, estado);
    const servico = criarServico(prisma);

    await expect(
      servico.criaPedido('loja', USUARIO, pedidoSimples()),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(estado.tentativas).toBe(5);
    expect(estado.p2002).toBe(5);
  });

  it('não repete quando o erro é outro (não é P2002)', async () => {
    const { prisma, estado } = prismaComNumeroUnico();
    prisma.$transaction.mockImplementation(async () => {
      estado.tentativas++;
      throw new Error('conexão perdida com o banco');
    });
    const servico = criarServico(prisma);

    await expect(
      servico.criaPedido('loja', USUARIO, pedidoSimples()),
    ).rejects.toThrow('conexão perdida com o banco');
    expect(estado.tentativas).toBe(1);
  });

  it('libera o lock quando a gravação falha (próximo checkout consegue)', async () => {
    const { prisma, estado } = prismaComNumeroUnico();
    prisma.$transaction
      .mockImplementationOnce(async () => {
        estado.tentativas++;
        throw new Error('banco caiu no meio');
      });
    const servico = criarServico(prisma);

    await expect(
      servico.criaPedido('loja', USUARIO, pedidoSimples()),
    ).rejects.toThrow('banco caiu no meio');

    // Sem fila travada, o pedido seguinte entra normalmente.
    const pedido = await servico.criaPedido('loja', USUARIO, pedidoSimples());
    expect(pedido.numero).toBe(1);
  });

  it('não grava pedido nenhum quando o número não pode ser reservado', async () => {
    const { prisma, estado, numeros } = prismaComNumeroUnico();
    colisaoPermanente(prisma, numeros, estado);
    const servico = criarServico(prisma);

    await expect(
      servico.criaPedido('loja', USUARIO, pedidoSimples()),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(numeros.size).toBe(1); // só o número que já estava ocupado
  });
});