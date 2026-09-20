import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

function criarServico(
  prisma: unknown,
  gateway = { emitirStatusPedido: vi.fn() },
) {
  return new AdminService(prisma as PrismaService, gateway as never);
}

const DONO = '22222222-2222-2222-2222-222222222222';

function pedidoPrisma(status: string) {
  return {
    id: 'p1',
    numero: 42,
    status,
    justificativaCancelamento: null,
    subtotal: 32.9,
    total: 32.9,
    formaPagamento: 'pix',
    enderecoEntrega: null,
    observacao: null,
    createdAt: new Date(),
    lanchonete: { id: 'l1', nome: 'Loja', slug: 'loja', donoId: DONO },
    cliente: null,
    itens: [],
  };
}

function prismaCom(pedidoAtual: unknown) {
  return {
    pedido: {
      findUnique: vi.fn().mockResolvedValue(pedidoAtual),
      update: vi
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            ...(pedidoAtual as object),
            ...pedidoAtual,
            itens: [],
            cliente: null,
            status: data.status,
            justificativaCancelamento: data.justificativaCancelamento ?? null,
          }),
        ),
    },
  };
}

describe('AdminService.updatePedidoStatus', () => {
  it('avança uma etapa por vez no fluxo', async () => {
    const prisma = prismaCom(pedidoPrisma('recebido'));
    const gateway = { emitirStatusPedido: vi.fn() };
    const servico = criarServico(prisma, gateway);

    const resultado = await servico.updatePedidoStatus(DONO, 'p1', {
      status: 'aceito',
    });

    expect(resultado.status).toBe('aceito');
    expect(prisma.pedido.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'aceito' } }),
    );
    expect(gateway.emitirStatusPedido).toHaveBeenCalledWith('l1', {
      id: 'p1',
      numero: 42,
      status: 'aceito',
    });
  });

  it('rejeita pulo de etapa (recebido → enviado)', async () => {
    const servico = criarServico(prismaCom(pedidoPrisma('recebido')));
    await expect(
      servico.updatePedidoStatus(DONO, 'p1', { status: 'enviado' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita aplicar o mesmo status', async () => {
    const servico = criarServico(prismaCom(pedidoPrisma('entregue')));
    await expect(
      servico.updatePedidoStatus(DONO, 'p1', { status: 'entregue' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('status desconhecido é inválido', async () => {
    const servico = criarServico(prismaCom(pedidoPrisma('recebido')));
    await expect(
      servico.updatePedidoStatus(DONO, 'p1', { status: 'queimado' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cancelado exige justificativa', async () => {
    const servico = criarServico(prismaCom(pedidoPrisma('aceito')));
    await expect(
      servico.updatePedidoStatus(DONO, 'p1', { status: 'cancelado' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cancelado armazena a justificativa', async () => {
    const prisma = prismaCom(pedidoPrisma('aceito'));
    const servico = criarServico(prisma);

    const resultado = await servico.updatePedidoStatus(DONO, 'p1', {
      status: 'cancelado',
      justificativa: '  Cliente desistiu  ',
    });

    expect(resultado.status).toBe('cancelado');
    expect(resultado.justificativaCancelamento).toBe('Cliente desistiu');
    expect(prisma.pedido.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: 'cancelado',
          justificativaCancelamento: 'Cliente desistiu',
        },
      }),
    );
  });

  it('cancelado impossível depois de enviado', async () => {
    const servico = criarServico(prismaCom(pedidoPrisma('enviado')));
    await expect(
      servico.updatePedidoStatus(DONO, 'p1', {
        status: 'cancelado',
        justificativa: 'motivo qualquer',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404 quando o pedido não pertence ao dono', async () => {
    const prisma = prismaCom(pedidoPrisma('recebido'));
    const servico = criarServico(prisma);
    await expect(
      servico.updatePedidoStatus('outro-dono', 'p1', { status: 'aceito' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
