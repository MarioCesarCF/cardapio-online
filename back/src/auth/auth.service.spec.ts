import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

function criarServico(prisma: unknown) {
  const config = {
    get: (key: string) => {
      if (key === 'NEON_AUTH_ISSUER') return 'https://issuer.example.com';
      if (key === 'APP_JWT_SECRET') return 'segredo-de-teste';
      return undefined;
    },
  };
  return new AuthService(
    prisma as PrismaService,
    config as unknown as {
      get: (key: string) => string | undefined;
    },
  );
}

describe('AuthService.verificarEmailExistente', () => {
  it('retorna registrado=true quando existe usuário com o e-mail', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ existe: 1 }]),
    };
    const servico = criarServico(prisma);

    const resultado =
      await servico.verificarEmailExistente('Cliente@Teste.Dev');

    expect(resultado).toEqual({ registrado: true });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('retorna registrado=false quando não existe usuário', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
    };
    const servico = criarServico(prisma);

    const resultado =
      await servico.verificarEmailExistente('ninguem@teste.dev');

    expect(resultado).toEqual({ registrado: false });
  });

  it('rejeita e-mail inválido com 400', async () => {
    const prisma = {
      $queryRaw: vi.fn(),
    };
    const servico = criarServico(prisma);

    await expect(
      servico.verificarEmailExistente('nao-e-email'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('trata e-mail vazio como inválido', async () => {
    const prisma = {
      $queryRaw: vi.fn(),
    };
    const servico = criarServico(prisma);

    await expect(servico.verificarEmailExistente('')).rejects.toThrow(
      BadRequestException,
    );
  });
});
