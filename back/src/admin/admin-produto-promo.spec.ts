import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

function criarServico(prisma: unknown) {
  return new AdminService(prisma as PrismaService, {
    emitirStatusPedido: vi.fn(),
  } as never);
}

const DONO = '22222222-2222-2222-2222-222222222222';

function prismaCreate(capturado: { data?: Record<string, unknown> }) {
  return {
    categoria: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: 'cat1', lanchonete: { donoId: DONO } }),
    },
    produto: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        capturado.data = data;
        return Promise.resolve({ id: 'p1', ...data });
      }),
    },
  };
}

function prismaUpdate(
  atual: Record<string, unknown>,
  capturado: { data?: Record<string, unknown> },
) {
  return {
    produto: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'p1',
        ...atual,
        categoria: { lanchonete: { donoId: DONO } },
      }),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        capturado.data = data;
        return Promise.resolve({ id: 'p1', ...atual, ...data });
      }),
    },
  };
}

describe('AdminService.createProduto — preço promocional', () => {
  it('cria sem promoção quando o campo vem vazio', async () => {
    const cap: { data?: Record<string, unknown> } = {};
    const servico = criarServico(prismaCreate(cap));

    await servico.createProduto(DONO, 'cat1', { nome: 'X-Burguer', preco: 25 });

    expect(cap.data?.precoPromo).toBeNull();
  });

  it('cria com promoção quando ela é menor que o preço normal', async () => {
    const cap: { data?: Record<string, unknown> } = {};
    const servico = criarServico(prismaCreate(cap));

    await servico.createProduto(DONO, 'cat1', {
      nome: 'X-Burguer',
      preco: 25,
      precoPromo: 19.9,
    });

    expect(cap.data?.precoPromo).toBe(19.9);
  });

  it('arredonda a promoção para centavos', async () => {
    const cap: { data?: Record<string, unknown> } = {};
    const servico = criarServico(prismaCreate(cap));

    await servico.createProduto(DONO, 'cat1', {
      nome: 'X',
      preco: 25,
      precoPromo: 19.999,
    });

    expect(cap.data?.precoPromo).toBe(20);
  });

  it('recusa promoção igual ao preço normal', async () => {
    const servico = criarServico(prismaCreate({}));

    await expect(
      servico.createProduto(DONO, 'cat1', {
        nome: 'X',
        preco: 25,
        precoPromo: 25,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa promoção maior que o preço normal', async () => {
    const servico = criarServico(prismaCreate({}));

    await expect(
      servico.createProduto(DONO, 'cat1', {
        nome: 'X',
        preco: 25,
        precoPromo: 30,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa promoção negativa', async () => {
    const servico = criarServico(prismaCreate({}));

    await expect(
      servico.createProduto(DONO, 'cat1', {
        nome: 'X',
        preco: 25,
        precoPromo: -1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('AdminService.updateProduto — preço promocional', () => {
  it('atualiza a promoção informada', async () => {
    const cap: { data?: Record<string, unknown> } = {};
    const servico = criarServico(prismaUpdate({ preco: 25, precoPromo: null }, cap));

    await servico.updateProduto(DONO, 'p1', { precoPromo: 18 });

    expect(cap.data?.precoPromo).toBe(18);
  });

  it('remove a promoção quando vem null', async () => {
    const cap: { data?: Record<string, unknown> } = {};
    const servico = criarServico(
      prismaUpdate({ preco: 25, precoPromo: 18 }, cap),
    );

    await servico.updateProduto(DONO, 'p1', { precoPromo: null });

    expect(cap.data?.precoPromo).toBeNull();
  });

  it('revalida a promoção já existente quando só o preço base muda', async () => {
    const cap: { data?: Record<string, unknown> } = {};
    const servico = criarServico(
      prismaUpdate({ preco: 25, precoPromo: 24 }, cap),
    );

    // O dono baixa o preço para 20 e esquece a promoção de 24: agora ela é maior
    // que o preço normal, então o back recusa em vez de gravar algo sem sentido.
    await expect(
      servico.updateProduto(DONO, 'p1', { preco: 20 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('aceita a promoção existente quando ela continua menor que o preço', async () => {
    const cap: { data?: Record<string, unknown> } = {};
    const servico = criarServico(
      prismaUpdate({ preco: 25, precoPromo: 15 }, cap),
    );

    await servico.updateProduto(DONO, 'p1', { preco: 20 });

    expect(cap.data?.preco).toBe(20);
    expect(cap.data?.precoPromo).toBe(15);
  });

  it('não mexe na promoção quando o body não fala de preço', async () => {
    const cap: { data?: Record<string, unknown> } = {};
    const servico = criarServico(
      prismaUpdate({ preco: 25, precoPromo: 15 }, cap),
    );

    await servico.updateProduto(DONO, 'p1', { nome: 'Novo nome' });

    expect(cap.data).not.toHaveProperty('precoPromo');
  });

  it('recusa promoção igual ao novo preço base', async () => {
    const servico = criarServico(prismaUpdate({ preco: 25, precoPromo: null }, {}));

    await expect(
      servico.updateProduto(DONO, 'p1', { preco: 30, precoPromo: 30 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
