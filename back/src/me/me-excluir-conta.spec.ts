import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { MeService } from './me.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';

const USUARIO = {
  id: '9f4a1b2c-d4e5-4f6a-8b1c-2d3e4f5a6b7c',
} as AuthenticatedUser;

function criarServico(prisma: unknown) {
  return new MeService(prisma as PrismaService);
}

function prismaParaExcluir(
  overrides: {
    lanchonetes?: number;
    pedidos?: number;
    emAndamento?: number;
    admin?: unknown;
    neonFalha?: boolean;
  } = {},
) {
  // O mesmo objeto é usado como client e como "tx" da transaction — por isso
  // o $executeRaw precisa estar nele (a conta Neon é apagada de dentro da tx).
  const conta = {
    lanchonete: {
      count: vi.fn().mockResolvedValue(overrides.lanchonetes ?? 0),
    },
    pedido: {
      // A primeira contagem é a de pedidos em andamento (bloqueio), a segunda a
      // do total (log/retorno).
      count: vi
        .fn()
        .mockResolvedValueOnce(overrides.emAndamento ?? 0)
        .mockResolvedValue(overrides.pedidos ?? 3),
      updateMany: vi.fn().mockResolvedValue({ count: 3 }),
    },
    adminSistema: {
      findUnique: vi.fn().mockResolvedValue(overrides.admin ?? null),
    },
    lanchoneteFavorita: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
    termoAceite: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    respostaEncerramento: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    cliente: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    logSistema: { create: vi.fn().mockResolvedValue({}) },
    $executeRaw: overrides.neonFalha
      ? vi.fn().mockRejectedValue(new Error('permissão negada'))
      : vi.fn().mockResolvedValue(1),
  };
  return {
    ...conta,
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(conta),
    ),
  };
}

describe('MeService.excluirConta', () => {
  it('anonimiza o cliente, desvincula os pedidos e apaga os dados que o identificam', async () => {
    const prisma = prismaParaExcluir();
    const resultado = await criarServico(prisma).excluirConta(USUARIO);

    expect(resultado).toEqual({ ok: true, pedidosDesvinculados: 3 });
    // lanchonetes_favoritas é ON DELETE RESTRICT: tem que sair antes da conta.
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.lanchoneteFavorita.deleteMany).toHaveBeenCalledWith({
      where: { clienteId: USUARIO.id },
    });
    // Telefone e endereço são snapshot com dado pessoal: o histórico do pedido
    // continua na lanchonete, mas sem identificar a pessoa.
    const { data } = prisma.pedido.updateMany.mock.calls[0][0];
    expect(data.clienteId).toBeNull();
    expect(data.clienteTelefone).toBeNull();
    expect(data.enderecoEntrega).toBe(Prisma.DbNull);
    expect(prisma.termoAceite.deleteMany).toHaveBeenCalledWith({
      where: { usuarioId: USUARIO.id },
    });
    // O questionário de encerramento continua utilizável como estatística, mas
    // sem vínculo com a pessoa e sem texto/contato.
    const resposta = prisma.respostaEncerramento.updateMany.mock.calls[0][0];
    expect(resposta.where).toEqual({ usuarioId: USUARIO.id });
    expect(resposta.data.usuarioId).toBeNull();
    expect(resposta.data.contato).toBeNull();
    expect(resposta.data.contatoLiberado).toBe(false);
    for (const campo of ['melhorar', 'paraContinuar', 'experiencia', 'funcionalidadeFaltante']) {
      expect(resposta.data[campo]).toBeNull();
    }
    expect(prisma.cliente.deleteMany).toHaveBeenCalledWith({
      where: { id: USUARIO.id },
    });
  });

  it('recusa o encerramento com pedido em andamento (a lanchonete ainda precisa do contato)', async () => {
    const prisma = prismaParaExcluir({ emAndamento: 2 });

    await expect(
      criarServico(prisma).excluirConta(USUARIO),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.cliente.deleteMany).not.toHaveBeenCalled();
    expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
  });

  it('apaga a conta no Neon Auth (sessão, credencial e usuário)', async () => {
    const prisma = prismaParaExcluir();
    await criarServico(prisma).excluirConta(USUARIO);

    const tabelas = prisma.$executeRaw.mock.calls.length;
    expect(tabelas).toBe(3);
    for (const chamada of prisma.$executeRaw.mock.calls) {
      // Tagged template: o 1º argumento é o array de trechos da query.
      // Cast text → uuid é sempre explícito (gotcha do Prisma $queryRaw).
      expect((chamada[0] as unknown as string[]).join(' ')).toContain('::uuid');
    }
  });

  it('registra a ação no log sem nome, e-mail ou telefone', async () => {
    const prisma = prismaParaExcluir();
    await criarServico(prisma).excluirConta(USUARIO);

    const log = prisma.logSistema.create.mock.calls[0][0].data;
    expect(log.mensagem).toBe('Conta do cliente encerrada');
    expect(JSON.stringify(log)).not.toMatch(/nome|email|telefone/i);
  });

  it('recusa o encerramento de conta de administrador da plataforma', async () => {
    const prisma = prismaParaExcluir({ admin: { id: USUARIO.id } });

    await expect(
      criarServico(prisma).excluirConta(USUARIO),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.cliente.deleteMany).not.toHaveBeenCalled();
  });

  it('recusa o encerramento de quem ainda tem lanchonete', async () => {
    const prisma = prismaParaExcluir({ lanchonetes: 1 });

    await expect(
      criarServico(prisma).excluirConta(USUARIO),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.cliente.deleteMany).not.toHaveBeenCalled();
  });

  it('conclui o encerramento mesmo se a Neon recusar apagar a conta', async () => {
    const prisma = prismaParaExcluir({ neonFalha: true });

    const resultado = await criarServico(prisma).excluirConta(USUARIO);

    expect(resultado.ok).toBe(true);
    expect(prisma.cliente.deleteMany).toHaveBeenCalled();
  });
});
