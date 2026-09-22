import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { MeService } from './me.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TERMO_VERSAO_ATUAL } from './termo.js';

const USUARIO = { id: '9f4a1b2c-d4e5-4f6a-8b1c-2d3e4f5a6b7c' };

function criarServico(prisma: unknown) {
  return new MeService(prisma as PrismaService);
}

function prismaParaGetMe(termoAceite: unknown) {
  return {
    cliente: {
      upsert: vi.fn().mockResolvedValue({ id: USUARIO.id }),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    lanchonete: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    endereco: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    adminSistema: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    termoAceite: {
      findFirst: vi.fn().mockResolvedValue(termoAceite),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ nome: null, email: null }]),
  };
}

describe('MeService.registrarConsentimento', () => {
  it('grava o aceite da versão atual e retorna a data do 1º consentimento', async () => {
    const data = new Date('2026-09-22T12:00:00Z');
    const prisma = {
      termoAceite: {
        upsert: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue({ aceitoEm: data }),
      },
    };
    const servico = criarServico(prisma);

    const resultado = await servico.registrarConsentimento(USUARIO, {
      versao: TERMO_VERSAO_ATUAL,
    });

    expect(resultado).toEqual({
      ok: true,
      versao: TERMO_VERSAO_ATUAL,
      aceitoEm: data,
    });
    expect(prisma.termoAceite.upsert).toHaveBeenCalledWith({
      where: {
        usuarioId_versao: { usuarioId: USUARIO.id, versao: TERMO_VERSAO_ATUAL },
      },
      create: { usuarioId: USUARIO.id, versao: TERMO_VERSAO_ATUAL },
      update: {},
    });
  });

  it('aceite repetido da mesma versão usa update vazio (data do 1º aceite preservada)', async () => {
    const prisma = {
      termoAceite: {
        upsert: vi.fn().mockResolvedValue({}),
        findUnique: vi
          .fn()
          .mockResolvedValue({ aceitoEm: new Date('2026-09-01T10:00:00Z') }),
      },
    };
    const servico = criarServico(prisma);

    const resultado = await servico.registrarConsentimento(USUARIO, {
      versao: TERMO_VERSAO_ATUAL,
    });

    expect(resultado.aceitoEm).toEqual(new Date('2026-09-01T10:00:00Z'));
    expect(prisma.termoAceite.upsert.mock.calls[0][0].update).toEqual({});
  });

  it('rejeita versão ausente com 400 e não grava nada', async () => {
    const upsert = vi.fn();
    const servico = criarServico({ termoAceite: { upsert } });

    await expect(servico.registrarConsentimento(USUARIO, {})).rejects.toThrow(
      BadRequestException,
    );
    expect(upsert).not.toHaveBeenCalled();
  });

  it('rejeita versão desconhecida/antiga com 400', async () => {
    const upsert = vi.fn();
    const servico = criarServico({ termoAceite: { upsert } });

    await expect(
      servico.registrarConsentimento(USUARIO, { versao: '0.9' }),
    ).rejects.toThrow(BadRequestException);
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe('MeService.getMe termoAceite', () => {
  it('retorna o aceite mais recente quando existe', async () => {
    const aceitoEm = new Date('2026-09-22T12:00:00Z');
    const servico = criarServico(
      prismaParaGetMe({
        usuarioId: USUARIO.id,
        versao: TERMO_VERSAO_ATUAL,
        aceitoEm,
      }),
    );

    const me = await servico.getMe(USUARIO);

    expect(me.termoAceite).toEqual({ versao: TERMO_VERSAO_ATUAL, aceitoEm });
  });

  it('retorna termoAceite null quando o usuário nunca aceitou', async () => {
    const servico = criarServico(prismaParaGetMe(null));

    const me = await servico.getMe(USUARIO);

    expect(me.termoAceite).toBeNull();
  });
});
