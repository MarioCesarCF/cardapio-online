import { describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AdminSistemaService } from './admin-sistema.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

function criarServico(prisma: unknown) {
  const config = {
    get: (key: string, fallback?: string) => {
      if (key === 'NEON_AUTH_ISSUER') return 'https://issuer.example.com';
      if (key === 'FRONT_URL') return fallback;
      return undefined;
    },
  };
  return new AdminSistemaService(
    prisma as PrismaService,
    config as unknown as {
      get: (key: string, fallback?: string) => string | undefined;
    },
  );
}

const USER_SUPER = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'super@x.com',
};
const USER_ADMIN = {
  id: '22222222-2222-2222-2222-222222222222',
  email: 'admin@x.com',
};

describe('AdminSistemaService', () => {
  describe('alterarSituacao', () => {
    it('valida a situação e registra log', async () => {
      const logCriado: unknown[] = [];
      const prisma = {
        lanchonete: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'l1',
            nome: 'Loja',
            situacao: 'pendente',
          }),
          update: vi.fn().mockResolvedValue({
            id: 'l1',
            nome: 'Loja',
            slug: 'loja',
            tipo: null,
            situacao: 'ativa',
          }),
        },
        logSistema: {
          create: vi.fn().mockImplementation((d) => {
            logCriado.push(d.data);
            return d.data;
          }),
        },
      };
      const servico = criarServico(prisma);

      const resultado = await servico.alterarSituacao(
        'l1',
        { situacao: 'ativa' },
        USER_SUPER,
      );

      expect(resultado.situacao).toBe('ativa');
      expect(prisma.lanchonete.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { situacao: 'ativa' } }),
      );
      expect(logCriado).toHaveLength(1);
      expect((logCriado[0] as { categoria: string }).categoria).toBe('acao');
      expect((logCriado[0] as { usuarioId: string }).usuarioId).toBe(
        USER_SUPER.id,
      );
    });

    it('rejeita situação inválida', async () => {
      const prisma = {
        lanchonete: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ id: 'l1', situacao: 'pendente' }),
        },
      };
      const servico = criarServico(prisma);
      await expect(
        servico.alterarSituacao('l1', { situacao: 'queimada' }, USER_SUPER),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejeita situação igual à atual', async () => {
      const prisma = {
        lanchonete: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ id: 'l1', situacao: 'ativa' }),
        },
      };
      const servico = criarServico(prisma);
      await expect(
        servico.alterarSituacao('l1', { situacao: 'ativa' }, USER_SUPER),
      ).rejects.toThrow(/já está ativa/);
    });

    it('404 quando a lanchonete não existe', async () => {
      const prisma = {
        lanchonete: { findUnique: vi.fn().mockResolvedValue(null) },
      };
      const servico = criarServico(prisma);
      await expect(
        servico.alterarSituacao('nada', { situacao: 'ativa' }, USER_SUPER),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('removerLanchonete', () => {
    it('somente o admin raiz pode excluir', async () => {
      const prisma = {
        adminSistema: {
          findUnique: vi.fn().mockResolvedValue({ funcao: 'admin' }),
        },
      };
      const servico = criarServico(prisma);
      await expect(
        servico.removerLanchonete('l1', USER_ADMIN),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('exclui lanchonete sem pedidos e registra log', async () => {
      const logCriado: unknown[] = [];
      const prisma = {
        adminSistema: {
          findUnique: vi.fn().mockResolvedValue({ funcao: 'super' }),
        },
        lanchonete: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ id: 'l1', nome: 'Loja', slug: 'loja' }),
          delete: vi.fn().mockResolvedValue({ id: 'l1' }),
        },
        pedido: { count: vi.fn().mockResolvedValue(0) },
        logSistema: {
          create: vi.fn().mockImplementation((d) => {
            logCriado.push(d.data);
            return d.data;
          }),
        },
      };
      const servico = criarServico(prisma);
      const resultado = await servico.removerLanchonete('l1', USER_SUPER);
      expect(resultado).toEqual({ ok: true });
      expect(logCriado).toHaveLength(1);
    });

    it('bloqueia exclusão de lanchonete com pedidos', async () => {
      const prisma = {
        adminSistema: {
          findUnique: vi.fn().mockResolvedValue({ funcao: 'super' }),
        },
        lanchonete: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ id: 'l1', nome: 'Loja', slug: 'loja' }),
        },
        pedido: { count: vi.fn().mockResolvedValue(3) },
      };
      const servico = criarServico(prisma);
      await expect(
        servico.removerLanchonete('l1', USER_SUPER),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.lanchonete.delete).toBeUndefined();
    });
  });

  describe('criarAdmin', () => {
    it('cria conta e registra log', async () => {
      const logCriado: unknown[] = [];
      const prisma = {
        adminSistema: {
          create: vi.fn().mockResolvedValue({
            id: '33333333-3333-3333-3333-333333333333',
            nome: 'Ana',
            email: 'ana@x.com',
            funcao: 'admin',
            createdAt: new Date(),
          }),
        },
        logSistema: {
          create: vi.fn().mockImplementation((d) => {
            logCriado.push(d.data);
            return d.data;
          }),
        },
      };
      const servico = criarServico(prisma);
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            user: { id: '33333333-3333-3333-3333-333333333333' },
          }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const admin = await servico.criarAdmin(USER_SUPER, {
        nome: 'Ana',
        email: 'ana@x.com',
        senha: 'senha1234',
      });
      expect(admin.email).toBe('ana@x.com');
      expect(logCriado).toHaveLength(1);
      vi.unstubAllGlobals();
    });

    it('conflito quando o e-mail já existe', async () => {
      const prisma = { adminSistema: { create: vi.fn() } };
      const servico = criarServico(prisma);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          json: () => Promise.resolve({ message: 'User already exists' }),
        }),
      );
      await expect(
        servico.criarAdmin(USER_SUPER, {
          nome: 'Ana',
          email: 'ana@x.com',
          senha: 'senha1234',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      vi.unstubAllGlobals();
    });
  });

  describe('plataforma', () => {
    it('retorna o e-mail de contato cadastrado', async () => {
      const prisma = {
        configPlataforma: {
          findUnique: vi
            .fn()
            .mockResolvedValue({
              id: 'global',
              emailLojista: 'contato@cardapio.com',
            }),
        },
      };
      const servico = criarServico(prisma);
      await expect(servico.getPlataforma()).resolves.toEqual({
        emailLojista: 'contato@cardapio.com',
      });
    });

    it('retorna nulo quando não há configuração', async () => {
      const prisma = {
        configPlataforma: { findUnique: vi.fn().mockResolvedValue(null) },
      };
      const servico = criarServico(prisma);
      await expect(servico.getPlataforma()).resolves.toEqual({
        emailLojista: null,
      });
    });

    it('atualiza o e-mail válido e registra log', async () => {
      const logCriado: unknown[] = [];
      const prisma = {
        configPlataforma: {
          upsert: vi.fn().mockResolvedValue({
            id: 'global',
            emailLojista: 'novo@cardapio.com',
          }),
        },
        logSistema: {
          create: vi.fn().mockImplementation((d) => {
            logCriado.push(d.data);
            return d.data;
          }),
        },
      };
      const servico = criarServico(prisma);
      const resultado = await servico.updatePlataforma(USER_SUPER, {
        emailLojista: 'novo@cardapio.com',
      });
      expect(resultado).toEqual({ emailLojista: 'novo@cardapio.com' });
      expect(prisma.configPlataforma.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'global' },
          create: { id: 'global', emailLojista: 'novo@cardapio.com' },
          update: { emailLojista: 'novo@cardapio.com' },
        }),
      );
      expect(logCriado).toHaveLength(1);
      expect((logCriado[0] as { mensagem: string }).mensagem).toBe(
        'E-mail de contato atualizado',
      );
    });

    it('limpa o e-mail quando o valor é vazio', async () => {
      const prisma = {
        configPlataforma: {
          upsert: vi
            .fn()
            .mockResolvedValue({ id: 'global', emailLojista: null }),
        },
        logSistema: { create: vi.fn().mockResolvedValue({}) },
      };
      const servico = criarServico(prisma);
      const resultado = await servico.updatePlataforma(USER_SUPER, {
        emailLojista: '',
      });
      expect(resultado).toEqual({ emailLojista: null });
    });

    it('rejeita e-mail malformado', async () => {
      const prisma = {
        configPlataforma: { upsert: vi.fn() },
        logSistema: { create: vi.fn() },
      };
      const servico = criarServico(prisma);
      await expect(
        servico.updatePlataforma(USER_SUPER, { emailLojista: 'nao-email' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.configPlataforma.upsert).not.toHaveBeenCalled();
    });
  });

  describe('listarLogs', () => {
    it('busca logs e enriquece com nome/e-mail do usuário via join', async () => {
      const prisma = {
        logSistema: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'lg1',
              nivel: 'erro',
              categoria: 'erro',
              mensagem: 'Erro interno',
              detalhes: { status: 500 },
              usuarioId: USER_SUPER.id,
              createdAt: new Date(),
            },
          ]),
        },
        $queryRaw: vi
          .fn()
          .mockResolvedValue([
            { id: USER_SUPER.id, nome: 'Raiz', email: 'super@x.com' },
          ]),
      };
      const servico = criarServico(prisma);

      const logs = await servico.listarLogs({});
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        usuarioNome: 'Raiz',
        usuarioEmail: 'super@x.com',
        nivel: 'erro',
      });
      expect(prisma.logSistema.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });
  });
});
