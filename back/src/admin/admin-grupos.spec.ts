import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const DONO = '22222222-2222-2222-2222-222222222222';

function criarServico(prisma: unknown) {
  return new AdminService(
    prisma as PrismaService,
    { emitirStatusPedido: vi.fn() } as never,
  );
}

function prismaCom() {
  const create = vi
    .fn()
    .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'g1', nome: data.nome, ...data }),
    );
  const prisma = {
    lanchonete: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: 'l1', donoId: DONO, slug: 'loja' }),
    },
    grupoOpcoes: { create },
  };
  return { prisma, create };
}

describe('AdminService.createGrupo', () => {
  it('aceita maxSelecoes null (grupo sem limite máximo)', async () => {
    const { prisma, create } = prismaCom();
    const servico = criarServico(prisma);

    const resultado = await servico.createGrupo(DONO, 'loja', {
      nome: 'Adicionais',
      maxSelecoes: null,
    });

    expect(resultado.maxSelecoes).toBeNull();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ maxSelecoes: null }),
      }),
    );
  });

  it('padrão de maxSelecoes é null quando ausente', async () => {
    const { prisma, create } = prismaCom();
    const servico = criarServico(prisma);

    const resultado = await servico.createGrupo(DONO, 'loja', {
      nome: 'Adicionais',
    });

    expect(resultado.maxSelecoes).toBeNull();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ maxSelecoes: null }),
      }),
    );
  });

  it('aceita maxSelecoes inteiro', async () => {
    const { prisma, create } = prismaCom();
    const servico = criarServico(prisma);

    const resultado = await servico.createGrupo(DONO, 'loja', {
      nome: 'Adicionais',
      maxSelecoes: 3,
    });

    expect(resultado.maxSelecoes).toBe(3);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ maxSelecoes: 3 }),
      }),
    );
  });

  it('rejeita maxSelecoes não inteiro', async () => {
    const { prisma } = prismaCom();
    const servico = criarServico(prisma);

    await expect(
      servico.createGrupo(DONO, 'loja', {
        nome: 'Adicionais',
        maxSelecoes: 'abc',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejeita maxSelecoes menor que minSelecoes', async () => {
    const { prisma } = prismaCom();
    const servico = criarServico(prisma);

    await expect(
      servico.createGrupo(DONO, 'loja', {
        nome: 'Adicionais',
        minSelecoes: 3,
        maxSelecoes: 1,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
