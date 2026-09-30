import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const DONO = '33333333-3333-3333-3333-333333333333';

function criarServico(prisma: unknown) {
  return new AdminService(
    prisma as PrismaService,
    { emitirStatusPedido: vi.fn() } as never,
  );
}

function prismaCom(atual: Record<string, unknown> = {}) {
  const update = vi
    .fn()
    .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'l1', nome: 'Loja', slug: 'loja', ...data }),
    );
  const prisma = {
    lanchonete: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'l1',
        donoId: DONO,
        slug: 'loja',
        nome: 'Loja',
        tipo: 'lanches',
        ...atual,
      }),
      update,
    },
  };
  return { prisma, update };
}

/** Campos válidos de uma config completa: só o que o teste muda é omitido. */
function configValida(over: Record<string, unknown> = {}) {
  return { nome: 'Duarte Burguers', tipo: 'lanches', slug: 'duarte-burguers', ...over };
}

describe('AdminService.updateConfig - nome, tipo e slug obrigatórios', () => {
  it('salva quando os três campos vêm preenchidos', async () => {
    const { prisma, update } = prismaCom();
    const servico = criarServico(prisma);

    const resultado = await servico.updateConfig(DONO, 'loja', configValida());

    expect(resultado.tipo).toBe('lanches');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nome: 'Duarte Burguers',
          tipo: 'lanches',
          slug: 'duarte-burguers',
        }),
      }),
    );
  });

  it('mantém o tipo já salvo quando o corpo não traz o campo', async () => {
    const { prisma, update } = prismaCom();
    const servico = criarServico(prisma);

    const resultado = await servico.updateConfig(DONO, 'loja', {
      nome: 'Loja',
      slug: 'loja',
    });

    expect(resultado.nome).toBe('Loja');
    // `tipo` não foi enviado: o update não mexe no campo.
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { nome: 'Loja', slug: 'loja' } }),
    );
  });

  it('recusa tipo null', async () => {
    const { prisma, update } = prismaCom();
    const servico = criarServico(prisma);

    await expect(
      servico.updateConfig(DONO, 'loja', configValida({ tipo: null })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('recusa tipo vazio', async () => {
    const { prisma, update } = prismaCom();
    const servico = criarServico(prisma);

    await expect(
      servico.updateConfig(DONO, 'loja', configValida({ tipo: '' })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('recusa tipo fora da lista', async () => {
    const { prisma, update } = prismaCom();
    const servico = criarServico(prisma);

    await expect(
      servico.updateConfig(DONO, 'loja', configValida({ tipo: 'bar' })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('recusa salvar uma lanchonete que já está sem tipo, mesmo sem mexer no campo', async () => {
    // Loja criada pelo onboarding sem tipo: o corpo não traz `tipo`, mas o
    // invariant exige que ela não saia do save assim.
    const { prisma, update } = prismaCom({ tipo: null });
    const servico = criarServico(prisma);

    await expect(
      servico.updateConfig(DONO, 'loja', { nome: 'Loja', slug: 'loja' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('deixa salvar quando o corpo não traz tipo mas a loja já tem um', async () => {
    const { prisma, update } = prismaCom({ tipo: 'acai' });
    const servico = criarServico(prisma);

    const resultado = await servico.updateConfig(DONO, 'loja', {
      nome: 'Loja',
      slug: 'loja',
    });

    expect(resultado.slug).toBe('loja');
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('recusa nome vazio', async () => {
    const { prisma, update } = prismaCom();
    const servico = criarServico(prisma);

    await expect(
      servico.updateConfig(DONO, 'loja', configValida({ nome: '  ' })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('recusa slug vazio', async () => {
    const { prisma, update } = prismaCom();
    const servico = criarServico(prisma);

    await expect(
      servico.updateConfig(DONO, 'loja', configValida({ slug: '' })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });
});
