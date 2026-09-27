import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { LojasService } from './lojas.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const LOJA = {
  id: 'lanchonete-1',
  nome: 'Duarte Burguers',
  logoUrl: null,
  fonte: null,
  corPrincipal: '#e8800c',
  tipo: 'lanches',
  whatsapp: '5511999990001',
  emailContato: 'contato@duarte.com.br',
  enderecoLoja: 'Av. Paulista, 1000 - Sao Paulo/SP',
  horarios: null,
  cobraTaxaEntrega: true,
  taxaEntrega: { toNumber: () => 5, toString: () => '5' },
  chavePix: '+5527995077806',
  nomePix: 'Duarte LTDA',
};

function criarServico(prisma: unknown) {
  return new LojasService(prisma as PrismaService);
}

function prismaParaConfig(lanchonete: unknown) {
  return {
    lanchonete: {
      findFirst: vi.fn().mockResolvedValue(lanchonete),
    },
  };
}

describe('LojasService.getConfig (endpoint publico)', () => {
  it('informa que aceita PIX quando a loja tem chave', async () => {
    const prisma = prismaParaConfig(LOJA);
    const config = await criarServico(prisma).getConfig('duarte-burguers');

    expect(config.aceitaPix).toBe(true);
    expect(config.taxaEntrega).toBe(5);
  });

  it('NUNCA expoe a chave PIX nem o nome do titular no endpoint publico', async () => {
    const prisma = prismaParaConfig(LOJA);
    const config = await criarServico(prisma).getConfig('duarte-burguers');

    expect(config).not.toHaveProperty('chavePix');
    expect(config).not.toHaveProperty('nomePix');
    expect(JSON.stringify(config)).not.toContain('27995077806');
    expect(JSON.stringify(config)).not.toContain('Duarte LTDA');
  });

  it('informa que NAO aceita PIX quando a loja nao tem chave', async () => {
    const prisma = prismaParaConfig({ ...LOJA, chavePix: null, nomePix: null });
    const config = await criarServico(prisma).getConfig('duarte-burguers');

    expect(config.aceitaPix).toBe(false);
  });

  it('trata chave vazia como loja sem PIX', async () => {
    const prisma = prismaParaConfig({ ...LOJA, chavePix: '' });
    const config = await criarServico(prisma).getConfig('duarte-burguers');

    expect(config.aceitaPix).toBe(false);
  });

  it('filtra por situacao ativa (nao expoe loja pendente/pausada)', async () => {
    const prisma = prismaParaConfig(null);
    await expect(
      criarServico(prisma).getConfig('duarte-burguers'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.lanchonete.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: 'duarte-burguers', situacao: 'ativa' },
      }),
    );
  });
});
