import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { EncerramentoService } from './encerramento.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';

const DONO = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'duarte@teste.dev',
} as AuthenticatedUser;

const ADMIN = {
  id: '22222222-2222-2222-2222-222222222222',
  email: 'raiz@cardapio.dev',
} as AuthenticatedUser;

const LOJA = {
  id: 'lanch-1',
  nome: 'Duarte Burguers',
  slug: 'duarte-burguers',
  createdAt: new Date('2026-09-01T10:00:00Z'),
};

const RESPOSTA_LOJA = {
  motivoPrincipal: 'sem_pedidos',
  motivosSecundarios: ['quantidade_pedidos', 'divulgacao'],
  ajudouPedidos: 'nao_consegui',
  satisfacao: 2,
  voltaria: 'nao',
};

function prismaMinimo(overrides: Record<string, unknown> = {}) {
  return {
    lanchonete: { findFirst: vi.fn() },
    cliente: { findUnique: vi.fn() },
    pedido: { count: vi.fn().mockResolvedValue(0) },
    respostaEncerramento: {
      create: vi.fn().mockResolvedValue({ id: 'resp-1' }),
    },
    adminSistema: { findUnique: vi.fn().mockResolvedValue(null) },
    ...overrides,
  };
}

function servico(prisma: unknown) {
  return new EncerramentoService(prisma as PrismaService);
}

function comLoja(overrides: Record<string, unknown> = {}) {
  return prismaMinimo({
    lanchonete: { findFirst: vi.fn().mockResolvedValue(LOJA) },
    ...overrides,
  });
}

function dadosGravados(
  prisma: {
    respostaEncerramento: {
      create: { mock: { calls: [{ data: Record<string, unknown> }] } };
    };
  },
  chamada = 0,
) {
  return prisma.respostaEncerramento.create.mock.calls[chamada][0].data;
}

describe('EncerramentoService.registrarLanchonete', () => {
  it('grava o motivo estruturado e o contexto de uso', async () => {
    const prisma = comLoja({ pedido: { count: vi.fn().mockResolvedValue(7) } });

    const resposta = await servico(prisma).registrarLanchonete(
      DONO,
      'duarte-burguers',
      RESPOSTA_LOJA,
    );

    expect(resposta).toEqual({ ok: true, id: 'resp-1' });
    const dados = dadosGravados(prisma);
    expect(dados).toMatchObject({
      perfil: 'lanchonete',
      usuarioId: DONO.id,
      lanchoneteId: 'lanch-1',
      lanchoneteNome: 'Duarte Burguers',
      lanchoneteSlug: 'duarte-burguers',
      motivoPrincipal: 'sem_pedidos',
      motivosSecundarios: ['quantidade_pedidos', 'divulgacao'],
      ajudouPedidos: 'nao_consegui',
      satisfacao: 2,
      voltaria: 'nao',
      pedidosRecebidos: 7,
    });
    expect(dados.diasAtivo as number).toBeGreaterThan(0);
  });

  it('404 para lanchonete de outro dono (não confirma a existência)', async () => {
    const prisma = prismaMinimo({
      lanchonete: { findFirst: vi.fn().mockResolvedValue(null) },
    });

    await expect(
      servico(prisma).registrarLanchonete(
        DONO,
        'cantina-da-nonna',
        RESPOSTA_LOJA,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejeita motivo fora do catálogo', async () => {
    await expect(
      servico(comLoja()).registrarLanchonete(DONO, 'duarte-burguers', {
        ...RESPOSTA_LOJA,
        motivoPrincipal: 'inventado',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exige a pergunta "o Peditto ajudou a receber pedidos?"', async () => {
    const { ajudouPedidos: _omitido, ...semResposta } = RESPOSTA_LOJA;

    await expect(
      servico(comLoja()).registrarLanchonete(
        DONO,
        'duarte-burguers',
        semResposta,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('limita os fatores secundários a 3', async () => {
    await expect(
      servico(comLoja()).registrarLanchonete(DONO, 'duarte-burguers', {
        ...RESPOSTA_LOJA,
        motivosSecundarios: ['preco', 'entregas', 'pagamentos', 'atendimento'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('salva a faixa de preço só quando o motivo é "preco"', async () => {
    const prisma = comLoja();

    await servico(prisma).registrarLanchonete(DONO, 'duarte-burguers', {
      ...RESPOSTA_LOJA,
      motivoPrincipal: 'preco',
      precoAdequado: 'faixa_30_49',
    });
    expect(dadosGravados(prisma, 0).precoAdequado).toBe('faixa_30_49');

    // A pergunta nem aparece no front quando o motivo não é preço; se vier
    // assim pela API, o dado é ignorado em vez de inventar resposta.
    await servico(prisma).registrarLanchonete(DONO, 'duarte-burguers', {
      ...RESPOSTA_LOJA,
      precoAdequado: 'ate_29',
    });
    expect(dadosGravados(prisma, 1).precoAdequado).toBeNull();
  });

  it('exige a faixa de preço quando o motivo é "preco"', async () => {
    await expect(
      servico(comLoja()).registrarLanchonete(DONO, 'duarte-burguers', {
        ...RESPOSTA_LOJA,
        motivoPrincipal: 'preco',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('guarda a funcionalidade que falta quando o motivo é "falta_recurso"', async () => {
    const prisma = comLoja();

    await servico(prisma).registrarLanchonete(DONO, 'duarte-burguers', {
      ...RESPOSTA_LOJA,
      motivoPrincipal: 'falta_recurso',
      funcionalidadeFaltante: 'integração com o Instagram',
    });

    expect(dadosGravados(prisma)).toMatchObject({
      motivoPrincipal: 'falta_recurso',
      funcionalidadeFaltante: 'integração com o Instagram',
    });
  });

  it('normaliza o contato autorizado e descarta o não autorizado', async () => {
    const prisma = comLoja();

    await servico(prisma).registrarLanchonete(DONO, 'duarte-burguers', {
      ...RESPOSTA_LOJA,
      contatoLiberado: true,
      contato: '(27) 99999-9999',
    });
    expect(dadosGravados(prisma, 0).contato).toBe('+5527999999999');

    await servico(prisma).registrarLanchonete(DONO, 'duarte-burguers', {
      ...RESPOSTA_LOJA,
      contatoLiberado: false,
      contato: 'dono@duarte.com.br',
    });
    expect(dadosGravados(prisma, 1)).toMatchObject({
      contatoLiberado: false,
      contato: null,
    });
  });

  it('rejeita contato que não é e-mail nem telefone', async () => {
    await expect(
      servico(comLoja()).registrarLanchonete(DONO, 'duarte-burguers', {
        ...RESPOSTA_LOJA,
        contatoLiberado: true,
        contato: 'me chama quando der',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('EncerramentoService.registrarCliente', () => {
  it('grava a resposta do cliente com o histórico de pedidos', async () => {
    const prisma = prismaMinimo({
      pedido: { count: vi.fn().mockResolvedValue(12) },
      cliente: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ createdAt: new Date('2026-08-01T00:00:00Z') }),
      },
    });

    await servico(prisma).registrarCliente(DONO, {
      motivoPrincipal: 'nao_uso_mais',
      satisfacao: 4,
      voltaria: 'sim',
      experiencia: 'Gostei de tudo',
    });

    expect(dadosGravados(prisma)).toMatchObject({
      perfil: 'cliente',
      motivoPrincipal: 'nao_uso_mais',
      satisfacao: 4,
      voltaria: 'sim',
      experiencia: 'Gostei de tudo',
      pedidosRecebidos: 12,
    });
    // Campos exclusivos da lanchonete ficam vazios no cliente.
    expect(dadosGravados(prisma)).toMatchObject({
      ajudouPedidos: null,
      motivosSecundarios: [],
    });
  });

  it('não aceita motivo exclusivo de lanchonete no perfil cliente', async () => {
    await expect(
      servico(prismaMinimo()).registrarCliente(DONO, {
        motivoPrincipal: 'sem_pedidos',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita avaliação fora de 1..5', async () => {
    for (const nota of [0, 6, 2.5, 'muito']) {
      await expect(
        servico(prismaMinimo()).registrarCliente(DONO, {
          motivoPrincipal: 'outro',
          satisfacao: nota,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('exige a nota de satisfação no cliente (o front marca como obrigatória)', async () => {
    await expect(
      servico(prismaMinimo()).registrarCliente(DONO, { motivoPrincipal: 'outro' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('a mensagem de erro de enum opcional não sai truncada nem duplicada', async () => {
    // Regressão: o rótulo já era uma frase completa e virava
    // "Resposta inválida. inválido." na tela.
    await expect(
      servico(prismaMinimo()).registrarCliente(DONO, {
        motivoPrincipal: 'outro',
        satisfacao: 3,
        voltaria: 'acho_que_sim',
      }),
    ).rejects.toThrow('Resposta inválida.');
  });

  it('na lanchonete a nota é opcional', async () => {
    const prisma = comLoja();
    await servico(prisma).registrarLanchonete(DONO, 'duarte-burguers', {
      motivoPrincipal: 'sem_pedidos',
      motivosSecundarios: ['quantidade_pedidos'],
      ajudouPedidos: 'ajudou_um_pouco',
    });
    expect(dadosGravados(prisma)).toMatchObject({ satisfacao: null });
  });

  it('exige o motivo principal', async () => {
    await expect(
      servico(prismaMinimo()).registrarCliente(DONO, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('EncerramentoService.resumo', () => {
  const CONTATOS = [
    {
      perfil: 'lanchonete',
      lanchoneteNome: 'Duarte Burguers',
      motivoPrincipal: 'preco',
      createdAt: new Date('2026-09-20'),
      contato: '+552799999999',
    },
  ];

  function prismaResumo(
    funcao: 'admin' | 'super',
    dados: Partial<{
      porPerfil: unknown[];
      motivos: unknown[];
      fatores: unknown[];
      voltaria: unknown[];
      precos: unknown[];
      satisfacao: unknown;
    }> = {},
  ) {
    return prismaMinimo({
      adminSistema: { findUnique: vi.fn().mockResolvedValue({ funcao }) },
      respostaEncerramento: {
        // groupBy é chamado nesta ordem: porPerfil, motivos, voltaria, precos.
        groupBy: vi
          .fn()
          .mockResolvedValueOnce(dados.porPerfil ?? [])
          .mockResolvedValueOnce(dados.motivos ?? [])
          .mockResolvedValueOnce(dados.voltaria ?? [])
          .mockResolvedValueOnce(dados.precos ?? []),
        // findByUnique nos três formatos: fatores, contatos, falas.
        findMany: vi
          .fn()
          .mockImplementation(
            (args: {
              select?: Record<string, unknown>;
              where?: Record<string, unknown>;
            }) => {
              if (args.select?.motivosSecundarios)
                return Promise.resolve(dados.fatores ?? []);
              if (args.where?.contatoLiberado) return Promise.resolve(CONTATOS);
              return Promise.resolve([]);
            },
          ),
        aggregate: vi
          .fn()
          .mockResolvedValue(
            dados.satisfacao ?? {
              _avg: { satisfacao: null },
              _count: { satisfacao: 0 },
            },
          ),
      },
    });
  }

  it('mascara o contato para admin humano e libera para o raiz', async () => {
    const humano = await servico(prismaResumo('admin')).resumo(ADMIN);
    expect(humano.contatos[0].contato).toBeNull();

    const raiz = await servico(prismaResumo('super')).resumo(ADMIN);
    expect(raiz.contatos[0].contato).toBe('+552799999999');
  });

  it('calcula o percentual de cada motivo e a média de satisfação', async () => {
    const prisma = prismaResumo('super', {
      porPerfil: [
        { perfil: 'lanchonete', _count: { _all: 5 } },
        { perfil: 'cliente', _count: { _all: 2 } },
      ],
      motivos: [
        {
          perfil: 'lanchonete',
          motivoPrincipal: 'sem_pedidos',
          _count: { _all: 3 },
        },
        { perfil: 'lanchonete', motivoPrincipal: 'preco', _count: { _all: 2 } },
        { perfil: 'cliente', motivoPrincipal: 'outro', _count: { _all: 2 } },
      ],
      fatores: [
        { motivosSecundarios: ['preco', 'divulgacao'] },
        { motivosSecundarios: ['preco'] },
      ],
      satisfacao: { _avg: { satisfacao: 3.5 }, _count: { satisfacao: 6 } },
    });

    const resumo = await servico(prisma).resumo(ADMIN);

    expect(resumo.total).toBe(7);
    expect(resumo.porPerfil).toEqual({ cliente: 2, lanchonete: 5 });
    const lanchonete = resumo.motivos.find((m) => m.perfil === 'lanchonete');
    expect(lanchonete?.motivos[0]).toEqual({
      motivo: 'sem_pedidos',
      rotulo: 'Não estou recebendo pedidos suficientes',
      quantidade: 3,
      percentual: 60,
    });
    expect(resumo.fatores[0]).toEqual({
      fator: 'preco',
      rotulo: 'O Peditto ficou caro',
      quantidade: 2,
    });
    expect(resumo.satisfacaoMedia).toBe(3.5);
    expect(resumo.avaliacoes).toBe(6);
  });

  it('aceita a janela pedida e trava em 365 dias', async () => {
    const resumo = await servico(prismaResumo('super')).resumo(ADMIN, 9999);
    expect(resumo.dias).toBe(365);
  });
});
