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

function pedidoPrisma(pixConfirmado: boolean, formaPagamento = 'pix') {
  return {
    id: 'p1',
    numero: 42,
    status: 'recebido',
    formaPagamento,
    pixConfirmado,
    pixConfirmadoEm: pixConfirmado ? new Date() : null,
    clienteTelefone: '27995077806',
    subtotal: 32.9,
    taxaEntrega: 0,
    total: 32.9,
    enderecoEntrega: null,
    observacao: null,
    pagamentoInfo: null,
    arquivado: false,
    createdAt: new Date(),
    lanchonete: { id: 'l1', nome: 'Loja', slug: 'loja', donoId: DONO },
    cliente: { id: 'c1', nome: 'Duda', telefone: '27999998888' },
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
            itens: [],
            pixConfirmado: data.pixConfirmado,
            pixConfirmadoEm: data.pixConfirmadoEm,
          }),
        ),
    },
  };
}

describe('AdminService.confirmarPagamento', () => {
  it('confirma o recebimento e carimba a data', async () => {
    const prisma = prismaCom(pedidoPrisma(false));
    const gateway = { emitirStatusPedido: vi.fn() };
    const servico = criarServico(prisma, gateway);

    const resultado = await servico.confirmarPagamento(DONO, 'p1', {
      confirmado: true,
    });

    expect(resultado.pixConfirmado).toBe(true);
    expect(prisma.pedido.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { pixConfirmado: true, pixConfirmadoEm: expect.any(Date) },
      }),
    );
    expect(gateway.emitirStatusPedido).toHaveBeenCalledWith('l1', {
      id: 'p1',
      numero: 42,
      status: 'recebido',
    });
  });

  it('desfaz a confirmação (limpa a data)', async () => {
    const prisma = prismaCom(pedidoPrisma(true));
    const servico = criarServico(prisma);

    const resultado = await servico.confirmarPagamento(DONO, 'p1', {
      confirmado: false,
    });

    expect(resultado.pixConfirmado).toBe(false);
    expect(resultado.pixConfirmadoEm).toBeNull();
  });

  it('exige "confirmado" booleano', async () => {
    const servico = criarServico(prismaCom(pedidoPrisma(false)));
    await expect(
      servico.confirmarPagamento(DONO, 'p1', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      servico.confirmarPagamento(DONO, 'p1', { confirmado: 'sim' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita confirmar duas vezes', async () => {
    const servico = criarServico(prismaCom(pedidoPrisma(true)));
    await expect(
      servico.confirmarPagamento(DONO, 'p1', { confirmado: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita desfazer o que não foi confirmado', async () => {
    const servico = criarServico(prismaCom(pedidoPrisma(false)));
    await expect(
      servico.confirmarPagamento(DONO, 'p1', { confirmado: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404 quando o pedido não pertence ao dono', async () => {
    const servico = criarServico(prismaCom(pedidoPrisma(false)));
    await expect(
      servico.confirmarPagamento('outro-dono', 'p1', { confirmado: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404 quando o pedido não existe', async () => {
    const servico = criarServico(prismaCom(null));
    await expect(
      servico.confirmarPagamento(DONO, 'p1', { confirmado: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('expõe o WhatsApp do pedido (snapshot antes do perfil)', async () => {
    const servico = criarServico(prismaCom(pedidoPrisma(false)));
    const resultado = await servico.confirmarPagamento(DONO, 'p1', {
      confirmado: true,
    });
    expect(resultado.clienteTelefone).toBe('27995077806');
  });

  it('só permite confirmar pagamento de pedido PIX', async () => {
    for (const forma of ['cartao', 'dinheiro']) {
      const prisma = prismaCom(pedidoPrisma(false, forma));
      const servico = criarServico(prisma);
      await expect(
        servico.confirmarPagamento(DONO, 'p1', { confirmado: true }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.pedido.update).not.toHaveBeenCalled();
    }
  });
});
