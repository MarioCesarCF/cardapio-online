import { describe, expect, it, vi } from 'vitest';
import { LogAcessoService, type LinhaAcesso } from './log-acesso.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EncerramentoMaintService } from '../encerramento/encerramento-maint.service.js';

function prismaMock(overrides: Record<string, unknown> = {}) {
  return {
    logAcesso: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    respostaEncerramento: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    ...overrides,
  } as unknown as PrismaService & {
    logAcesso: { createMany: ReturnType<typeof vi.fn> };
  };
}

function linha(extra: Partial<LinhaAcesso> = {}): LinhaAcesso {
  return {
    ip: '203.0.113.9',
    metodo: 'GET',
    rota: '/l/cardapio',
    status: 200,
    usuarioId: null,
    createdAt: new Date('2026-10-05T12:00:00Z'),
    ...extra,
  };
}

describe('LogAcessoService', () => {
  it('agrupa em lote e grava com createMany (uma ida ao banco, não uma por requisição)', async () => {
    const prisma = prismaMock();
    const servico = new LogAcessoService(prisma);

    servico.registra(linha({ rota: '/l/a' }));
    servico.registra(linha({ rota: '/l/b' }));
    await servico.descarregar();

    expect(prisma.logAcesso.createMany).toHaveBeenCalledTimes(1);
    const { data } = prisma.logAcesso.createMany.mock.calls[0][0] as {
      data: LinhaAcesso[];
    };
    expect(data.map((l) => l.rota)).toEqual(['/l/a', '/l/b']);
  });

  it('dispara o lote sozinho ao encher, sem esperar o timer', async () => {
    const prisma = prismaMock();
    const servico = new LogAcessoService(prisma);

    for (let i = 0; i < 200; i += 1) servico.registra(linha({ status: i }));
    await vi.waitFor(() =>
      expect(prisma.logAcesso.createMany).toHaveBeenCalledTimes(1),
    );
  });

  it('mantém o lote em 200 linhas mesmo sob rajada', async () => {
    const prisma = prismaMock();
    const servico = new LogAcessoService(prisma);

    for (let i = 0; i < 1200; i += 1) servico.registra(linha({ status: i }));
    await servico.descarregar();

    const lotes = prisma.logAcesso.createMany.mock.calls.map((c) => c[0].data.length);
    expect(lotes.every((n) => n <= 200)).toBe(true);
    // Nada se perde dentro do teto e nada cresce sem limite: 1200 em 200 = 6.
    expect(lotes.reduce((a, b) => a + b, 0)).toBe(1200);
  });

  it('não joga a exceção na cara do chamador se o banco estiver fora', async () => {
    const prisma = prismaMock({
      logAcesso: {
        createMany: vi.fn().mockRejectedValue(new Error('timeout')),
        deleteMany: vi.fn(),
      },
    });
    const servico = new LogAcessoService(prisma);

    expect(() => servico.registra(linha())).not.toThrow();
    await expect(servico.descarregar()).resolves.toBeUndefined();
  });

  it('devolve o lote ao buffer quando a gravação falha (registro de acesso é obrigação legal)', async () => {
    const createMany = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue({ count: 2 });
    const prisma = prismaMock({ logAcesso: { createMany, deleteMany: vi.fn() } });
    const servico = new LogAcessoService(prisma);

    servico.registra(linha({ rota: '/l/a' }));
    servico.registra(linha({ rota: '/l/b' }));
    await servico.descarregar();
    await servico.descarregar();

    const tentativas = createMany.mock.calls.map((c) =>
      (c[0].data as LinhaAcesso[]).map((l) => l.rota),
    );
    // 1a tentativa falhou e devolveu as duas linhas; a 2a gravou as mesmas.
    expect(tentativas).toEqual([['/l/a', '/l/b'], ['/l/a', '/l/b']]);
  });

  it('expurga o que passou de 180 dias (prazo do art. 15 é mínimo de 6 meses)', async () => {
    const prisma = prismaMock();
    await new LogAcessoService(prisma).expurgar();

    const where = prisma.logAcesso.deleteMany.mock.calls[0][0].where as {
      createdAt: { lt: Date };
    };
    const limite = Date.now() - where.createdAt.lt.getTime();
    const dias = limite / (24 * 60 * 60 * 1000);
    expect(dias).toBeGreaterThan(179);
    expect(dias).toBeLessThan(181);
  });

  it('a retenção roda sozinha: expurga no boot e de hora em hora', async () => {
    vi.useFakeTimers();
    try {
      const prisma = prismaMock();
      const servico = new LogAcessoService(prisma);

      servico.onApplicationBootstrap();
      expect(prisma.logAcesso.deleteMany).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
      expect(prisma.logAcesso.deleteMany).toHaveBeenCalledTimes(2);

      servico.onModuleDestroy();
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
      expect(prisma.logAcesso.deleteMany).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('grava o resto do buffer no shutdown do deploy (SIGTERM do Render)', async () => {
    const prisma = prismaMock();
    const servico = new LogAcessoService(prisma);

    servico.registra(linha({ rota: '/l/ultima' }));
    await servico.beforeApplicationShutdown();

    expect(prisma.logAcesso.createMany).toHaveBeenCalledTimes(1);
  });
});

describe('EncerramentoMaintService', () => {
  it('expurga o questionário inteiro depois de 24 meses', async () => {
    const prisma = prismaMock();
    await new EncerramentoMaintService(prisma).rodar();

    const where = prisma.respostaEncerramento.deleteMany.mock.calls[0][0]
      .where as { createdAt: { lt: Date } };
    const meses = (Date.now() - where.createdAt.lt.getTime()) / (30 * 24 * 60 * 60 * 1000);
    expect(meses).toBeGreaterThan(23);
    expect(meses).toBeLessThan(25);
  });

  it('falha de manutenção não derruba o boot', async () => {
    const prisma = prismaMock({
      respostaEncerramento: {
        deleteMany: vi.fn().mockRejectedValue(new Error('timeout')),
      },
    });
    await expect(new EncerramentoMaintService(prisma).rodar()).resolves.toBeUndefined();
  });
});