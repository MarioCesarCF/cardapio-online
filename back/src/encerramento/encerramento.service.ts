import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import {
  validaRespostaEncerramento,
  type PerfilEncerramento,
  type RespostaEncerramentoInput,
  type RespostaValidada,
} from './encerramento.types.js';

// Rótulos pt-BR dos slugs, para o painel não depender do front para ser lido.
const ROTULOS: Record<string, string> = {
  nao_uso_mais: 'Não uso mais o Peditto',
  nao_pedo_online: 'Não costumo fazer pedidos online',
  problema_pedido: 'Problema ao fazer um pedido',
  problema_lanchonete: 'Problema com uma lanchonete',
  dificuldade_uso: 'Dificuldade para usar a plataforma',
  notificacoes: 'Recebi muitas notificações',
  nao_quero_conta: 'Não quero manter uma conta',
  outra_forma: 'Prefiro outra forma de fazer pedidos',
  sem_pedidos: 'Não estou recebendo pedidos suficientes',
  preco: 'O Peditto ficou caro',
  outra_plataforma: 'Estou usando outra plataforma',
  falta_recurso: 'Está faltando alguma funcionalidade',
  problemas_tecnicos: 'Problemas técnicos',
  problemas_pagamento: 'Problemas com pagamentos',
  atendimento: 'Problemas com atendimento/suporte',
  fechei_lanchonete: 'Minha lanchonete encerrou ou mudou',
  nao_preciso: 'Não preciso mais de um sistema de pedidos',
  temporario: 'Estou apenas encerrando por enquanto',
  quantidade_pedidos: 'Quantidade de pedidos',
  facilidade_uso: 'Facilidade de uso',
  config_cardapio: 'Configuração do cardápio',
  recebimento_pedidos: 'Recebimento/gerenciamento dos pedidos',
  pagamentos: 'Pagamentos',
  entregas: 'Entregas',
  divulgacao: 'Divulgação para os clientes',
  relatorios: 'Relatórios e informações sobre vendas',
  personalizacao: 'Personalização da loja',
  recursos_faltantes: 'Recursos que estavam faltando',
  ajudou_bastante: 'Sim, bastante',
  ajudou_um_pouco: 'Sim, um pouco',
  sem_diferenca: 'Não fez diferença',
  nao_consegui: 'Não consegui receber pedidos',
  nao_usei_bem: 'Não cheguei a usar o suficiente para saber',
  ate_29: 'Até R$ 29,90',
  faixa_30_49: 'R$ 30 a R$ 49,90',
  faixa_50_69: 'R$ 50 a R$ 69,90',
  faixa_70_99: 'R$ 70 a R$ 99,90',
  cem_ou_mais: 'R$ 100 ou mais',
  nao_sei: 'Não sei',
  sim: 'Sim',
  talvez: 'Talvez',
  nao: 'Não',
  outro: 'Outro',
};

const rotulo = (slug: string): string => ROTULOS[slug] ?? slug;

const DIAS_MS = 86_400_000;

@Injectable()
export class EncerramentoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Registro do questionário do cliente (perfil "cliente"). */
  async registrarCliente(
    user: AuthenticatedUser,
    body: RespostaEncerramentoInput,
  ) {
    const dados = this.valida('cliente', body);

    // Contexto: quantos pedidos a pessoa já fez (a loja continua com o pedido,
    // só o vínculo com o cliente é desfeito no encerramento da conta).
    const [pedidosRecebidos, criado] = await Promise.all([
      this.prisma.pedido.count({ where: { clienteId: user.id } }),
      this.prisma.cliente.findUnique({
        where: { id: user.id },
        select: { createdAt: true },
      }),
    ]);

    const resposta = await this.prisma.respostaEncerramento.create({
      data: {
        perfil: 'cliente',
        usuarioId: user.id,
        ...this.dadosPrisma(dados),
        pedidosRecebidos,
        diasAtivo: this.diasAtivo(criado?.createdAt),
      },
    });
    return { ok: true, id: resposta.id };
  }

  /** Registro do questionário da lanchonete (perfil "lanchonete"). */
  async registrarLanchonete(
    user: AuthenticatedUser,
    slug: string,
    body: RespostaEncerramentoInput,
  ) {
    const lanchonete = await this.prisma.lanchonete.findFirst({
      where: { slug, donoId: user.id },
      select: { id: true, nome: true, slug: true, createdAt: true },
    });
    // Loja de outro dono = 404 (não vazamos a existência da loja).
    if (!lanchonete) throw new NotFoundException('Lanchonete não encontrada.');

    const dados = this.valida('lanchonete', body);
    const pedidosRecebidos = await this.prisma.pedido.count({
      where: { lanchoneteId: lanchonete.id },
    });

    const resposta = await this.prisma.respostaEncerramento.create({
      data: {
        perfil: 'lanchonete',
        usuarioId: user.id,
        lanchoneteId: lanchonete.id,
        lanchoneteNome: lanchonete.nome,
        lanchoneteSlug: lanchonete.slug,
        ...this.dadosPrisma(dados),
        pedidosRecebidos,
        diasAtivo: this.diasAtivo(lanchonete.createdAt),
      },
    });
    return { ok: true, id: resposta.id };
  }

  /**
   * Resumo para o painel da plataforma: motivos (com %), fatores secundários
   * mais citados, satisfaction média, intenção de retorno e quem autorizou
   * contato. O `contato` é dado pessoal — só o admin raiz enxerga.
   */
  async resumo(user: AuthenticatedUser, dias = 90) {
    const superAdmin = await this.eSuper(user);
    const janela = Math.min(Math.max(dias, 1), 365);
    const desde = new Date(Date.now() - janela * DIAS_MS);

    const [
      porPerfil,
      motivos,
      fatoresBrutos,
      satisfacoes,
      voltaria,
      contatos,
      texts,
      precos,
    ] = await Promise.all([
      this.prisma.respostaEncerramento.groupBy({
        by: ['perfil'],
        where: { createdAt: { gte: desde } },
        _count: { _all: true },
      }),
      this.prisma.respostaEncerramento.groupBy({
        by: ['perfil', 'motivoPrincipal'],
        where: { createdAt: { gte: desde } },
        _count: { _all: true },
      }),
      this.prisma.respostaEncerramento.findMany({
        where: { createdAt: { gte: desde } },
        select: { motivosSecundarios: true },
      }),
      this.prisma.respostaEncerramento.aggregate({
        where: { createdAt: { gte: desde } },
        _avg: { satisfacao: true },
        _count: { satisfacao: true },
      }),
      this.prisma.respostaEncerramento.groupBy({
        by: ['voltaria'],
        where: { createdAt: { gte: desde }, voltaria: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.respostaEncerramento.findMany({
        where: { createdAt: { gte: desde }, contatoLiberado: true },
        orderBy: { createdAt: 'desc' },
        select: {
          perfil: true,
          lanchoneteNome: true,
          motivoPrincipal: true,
          createdAt: true,
          contato: true,
        },
      }),
      this.prisma.respostaEncerramento.findMany({
        where: {
          createdAt: { gte: desde },
          OR: [{ melhorar: { not: null } }, { experiencia: { not: null } }],
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          perfil: true,
          lanchoneteNome: true,
          motivoPrincipal: true,
          melhorar: true,
          experiencia: true,
          createdAt: true,
        },
      }),
      this.prisma.respostaEncerramento.groupBy({
        by: ['precoAdequado'],
        where: { createdAt: { gte: desde }, precoAdequado: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const total = porPerfil.reduce((soma, p) => soma + p._count._all, 0);

    const motivosPorPerfil = (['cliente', 'lanchonete'] as const).map(
      (perfil) => {
        const itens = motivos
          .filter((m) => m.perfil === perfil)
          .map((m) => ({
            motivo: m.motivoPrincipal,
            rotulo: rotulo(m.motivoPrincipal),
            quantidade: m._count._all,
          }))
          .sort((a, b) => b.quantidade - a.quantidade);
        const somaPerfil = itens.reduce((soma, m) => soma + m.quantidade, 0);
        return {
          perfil,
          total: somaPerfil,
          motivos: itens.map((m) => ({
            ...m,
            percentual: somaPerfil
              ? Math.round((m.quantidade / somaPerfil) * 100)
              : 0,
          })),
        };
      },
    );

    const contagemFatores = new Map<string, number>();
    for (const linha of fatoresBrutos) {
      for (const fator of linha.motivosSecundarios) {
        contagemFatores.set(fator, (contagemFatores.get(fator) ?? 0) + 1);
      }
    }

    const totalAvaliacoes = satisfacoes._count.satisfacao ?? 0;

    return {
      dias: janela,
      total,
      porPerfil: {
        cliente:
          porPerfil.find((p) => p.perfil === 'cliente')?._count._all ?? 0,
        lanchonete:
          porPerfil.find((p) => p.perfil === 'lanchonete')?._count._all ?? 0,
      },
      motivos: motivosPorPerfil,
      fatores: [...contagemFatores.entries()]
        .map(([fator, quantidade]) => ({
          fator,
          rotulo: rotulo(fator),
          quantidade,
        }))
        .sort((a, b) => b.quantidade - a.quantidade),
      satisfacaoMedia:
        totalAvaliacoes && satisfacoes._avg.satisfacao
          ? Number((satisfacoes._avg.satisfacao as number).toFixed(2))
          : null,
      avaliacoes: totalAvaliacoes,
      voltaria: voltaria
        .map((v) => ({
          resposta: v.voltaria,
          rotulo: rotulo(v.voltaria ?? ''),
          quantidade: v._count._all,
        }))
        .sort((a, b) => b.quantidade - a.quantidade),
      precoAdequado: precos
        .map((p) => ({
          faixa: p.precoAdequado,
          rotulo: rotulo(p.precoAdequado ?? ''),
          quantidade: p._count._all,
        }))
        .sort((a, b) => b.quantidade - a.quantidade),
      // Dado pessoal: só o raiz vê o contato; admins humanos recebem null.
      contatos: superAdmin
        ? contatos.map((c) => ({ ...c, contato: c.contato ?? '—' }))
        : contatos.map((c) => ({ ...c, contato: null })),
      falas: texts,
    };
  }

  private valida(perfil: PerfilEncerramento, body: RespostaEncerramentoInput) {
    try {
      return validaRespostaEncerramento(perfil, body);
    } catch (erro) {
      throw new BadRequestException(
        erro instanceof Error
          ? erro.message
          : 'Resposta do questionário inválida.',
      );
    }
  }

  private dadosPrisma(dados: RespostaValidada) {
    return {
      motivoPrincipal: dados.motivoPrincipal,
      motivosSecundarios: dados.motivosSecundarios,
      ajudouPedidos: dados.ajudouPedidos,
      precoAdequado: dados.precoAdequado,
      funcionalidadeFaltante: dados.funcionalidadeFaltante,
      satisfacao: dados.satisfacao,
      voltaria: dados.voltaria,
      contatoLiberado: dados.contatoLiberado,
      contato: dados.contato,
      melhorar: dados.melhorar,
      paraContinuar: dados.paraContinuar,
      experiencia: dados.experiencia,
    };
  }

  private diasAtivo(createdAt: Date | undefined | null): number {
    if (!createdAt) return 0;
    const dias = Math.ceil((Date.now() - createdAt.getTime()) / DIAS_MS);
    return Math.max(dias, 0);
  }

  private async eSuper(user: AuthenticatedUser): Promise<boolean> {
    const admin = await this.prisma.adminSistema.findUnique({
      where: { id: user.id },
      select: { funcao: true },
    });
    return admin?.funcao === 'super';
  }
}
