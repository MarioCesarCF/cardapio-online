import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { NOME_REGEX } from '../common/texto.js';
import { formataPedido } from '../pedidos/pedidos.types.js';

export const SITUACOES_LANCHONETE = ['pendente', 'ativa', 'pausada'] as const;
export type SituacaoLanchonete = (typeof SITUACOES_LANCHONETE)[number];

export interface AdminSistemaDados {
  id: string;
  nome: string | null;
  email: string;
  funcao: string;
  createdAt: Date;
}

@Injectable()
export class AdminSistemaService implements OnModuleInit {
  private readonly logger = new Logger(AdminSistemaService.name);
  private readonly issuer: string;
  private readonly frontUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.issuer = config.get<string>('NEON_AUTH_ISSUER', '');
    this.frontUrl = config.get<string>('FRONT_URL', 'http://localhost:4200');
  }

  async onModuleInit(): Promise<void> {
    const email = process.env.ADMIN_SISTEMA_EMAIL;
    if (!email) return;

    const rows = await this.prisma.$queryRaw<
      { id: string; name: string | null }[]
    >`
      SELECT id, name FROM neon_auth."user" WHERE email = ${email} LIMIT 1
    `;
    const row = rows[0];
    if (!row) {
      this.logger.log(
        `ADMIN_SISTEMA_EMAIL configurado, mas nenhum usuário com e-mail ${email} ainda.`,
      );
      return;
    }
    await this.prisma.adminSistema.upsert({
      where: { id: row.id },
      create: { id: row.id, nome: row.name, email, funcao: 'super' },
      update: { funcao: 'super', nome: row.name ?? undefined },
    });
    this.logger.log(`Administrador raiz promovido: ${email}`);
  }

  // ---------- Lanchonetes ----------

  async listarLanchonetes() {
    const lanchonetes = await this.prisma.lanchonete.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nome: true,
        slug: true,
        tipo: true,
        logoUrl: true,
        situacao: true,
        donoId: true,
        createdAt: true,
        _count: { select: { categorias: true, pedidos: true } },
      },
    });

    const donoIds = [...new Set(lanchonetes.map((l) => l.donoId))];
    const [donos, produtosPorLanchonete] = await Promise.all([
      this.prisma.$queryRaw<
        { id: string; nome: string | null; email: string | null }[]
      >`
        SELECT id::text AS id, name AS nome, email
        FROM neon_auth."user"
        WHERE id = ANY(${donoIds}::uuid[])
      `,
      this.prisma.$queryRaw<{ lanchoneteId: string; produtos: number }[]>`
        SELECT c."lanchoneteId", COUNT(p.id)::int AS produtos
        FROM categorias c
        LEFT JOIN produtos p ON p."categoriaId" = c.id
        WHERE c."lanchoneteId" = ANY(${lanchonetes.map((l) => l.id)}::varchar[])
        GROUP BY c."lanchoneteId"
      `,
    ]);

    const donoPorId = new Map(donos.map((d) => [d.id, d]));
    const produtosPorId = new Map(
      produtosPorLanchonete.map((p) => [p.lanchoneteId, p.produtos]),
    );

    return lanchonetes.map((l) => {
      const dono = donoPorId.get(l.donoId);
      return {
        id: l.id,
        nome: l.nome,
        slug: l.slug,
        tipo: l.tipo,
        logoUrl: l.logoUrl,
        situacao: l.situacao,
        createdAt: l.createdAt,
        donoNome: dono?.nome ?? null,
        donoEmail: dono?.email ?? null,
        totalCategorias: l._count.categorias,
        totalProdutos: produtosPorId.get(l.id) ?? 0,
        totalPedidos: l._count.pedidos,
      };
    });
  }

  async alterarSituacao(
    id: string,
    body: Record<string, unknown>,
    user: AuthenticatedUser,
  ) {
    const atual = await this.prisma.lanchonete.findUnique({ where: { id } });
    if (!atual) throw new NotFoundException('Lanchonete não encontrada.');

    const situacao = this.situacaoValida(body.situacao);
    if (situacao === atual.situacao) {
      throw new BadRequestException(
        `A lanchonete já está ${this.rotuloSituacao(situacao)}.`,
      );
    }

    const atualizada = await this.prisma.lanchonete.update({
      where: { id },
      data: { situacao },
      select: { id: true, nome: true, slug: true, tipo: true, situacao: true },
    });

    await this.registrarLog(
      user,
      'info',
      'acao',
      'Situação da lanchonete alterada',
      {
        lanchoneteId: atual.id,
        lanchoneteNome: atual.nome,
        situacaoAnterior: atual.situacao,
        situacaoNova: situacao,
      },
    );

    return atualizada;
  }

  async removerLanchonete(id: string, user: AuthenticatedUser) {
    await this.requerSuper(user);
    const atual = await this.prisma.lanchonete.findUnique({ where: { id } });
    if (!atual) throw new NotFoundException('Lanchonete não encontrada.');

    const qtdePedidos = await this.prisma.pedido.count({
      where: { lanchoneteId: id },
    });
    if (qtdePedidos > 0) {
      throw new BadRequestException(
        'A lanchonete possui pedidos e não pode ser excluída. Pause-a para desativar.',
      );
    }

    await this.prisma.lanchonete.delete({ where: { id } });

    await this.registrarLog(user, 'info', 'acao', 'Lanchonete excluída', {
      lanchoneteId: atual.id,
      lanchoneteNome: atual.nome,
      slug: atual.slug,
    });

    return { ok: true };
  }

  async consultarLanchonete(id: string) {
    const lanchonete = await this.prisma.lanchonete.findUnique({
      where: { id },
    });
    if (!lanchonete) throw new NotFoundException('Lanchonete não encontrada.');

    const donos = await this.prisma.$queryRaw<
      { id: string; nome: string | null; email: string | null }[]
    >`
      SELECT id::text AS id, name AS nome, email
      FROM neon_auth."user"
      WHERE id = ${lanchonete.donoId}::uuid
    `;
    const dono = donos[0];

    return {
      id: lanchonete.id,
      nome: lanchonete.nome,
      slug: lanchonete.slug,
      tipo: lanchonete.tipo,
      logoUrl: lanchonete.logoUrl,
      fonte: lanchonete.fonte,
      corPrincipal: lanchonete.corPrincipal,
      chavePix: lanchonete.chavePix,
      nomePix: lanchonete.nomePix,
      whatsapp: lanchonete.whatsapp,
      emailContato: lanchonete.emailContato,
      enderecoLoja: lanchonete.enderecoLoja,
      notifPainel: lanchonete.notifPainel,
      notifWhatsapp: lanchonete.notifWhatsapp,
      notifEmail: lanchonete.notifEmail,
      situacao: lanchonete.situacao,
      createdAt: lanchonete.createdAt,
      updatedAt: lanchonete.updatedAt,
      donoNome: dono?.nome ?? null,
      donoEmail: dono?.email ?? null,
    };
  }

  async consultarCardapio(id: string) {
    const lanchonete = await this.prisma.lanchonete.findUnique({
      where: { id },
      include: {
        categorias: {
          orderBy: [{ posicao: 'asc' }, { nome: 'asc' }],
          include: {
            produtos: {
              orderBy: [{ destaque: 'desc' }, { nome: 'asc' }],
              include: {
                grupos: {
                  orderBy: { ordem: 'asc' },
                  include: {
                    grupo: {
                      include: { opcoes: { orderBy: { nome: 'asc' } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!lanchonete) throw new NotFoundException('Lanchonete não encontrada.');

    return {
      lanchonete: {
        id: lanchonete.id,
        nome: lanchonete.nome,
        slug: lanchonete.slug,
        logoUrl: lanchonete.logoUrl,
        tipo: lanchonete.tipo,
        situacao: lanchonete.situacao,
      },
      categorias: lanchonete.categorias.map((categoria) => ({
        id: categoria.id,
        nome: categoria.nome,
        posicao: categoria.posicao,
        imagemUrl: categoria.imagemUrl,
        ativa: categoria.ativa,
        produtos: categoria.produtos.map((produto) => ({
          id: produto.id,
          nome: produto.nome,
          descricao: produto.descricao,
          preco: produto.preco.toNumber(),
          imagemUrl: produto.imagemUrl,
          destaque: produto.destaque,
          ativo: produto.ativo,
          grupoIds: produto.grupos.map((pg) => pg.grupoId),
          grupos: produto.grupos.map((pg) => ({
            id: pg.grupo.id,
            nome: pg.grupo.nome,
            tipo: pg.grupo.tipo,
            obrigatorio: pg.grupo.obrigatorio,
            minSelecoes: pg.grupo.minSelecoes,
            maxSelecoes: pg.grupo.maxSelecoes,
            opcoes: pg.grupo.opcoes.map((opcao) => ({
              id: opcao.id,
              nome: opcao.nome,
              precoAdicional: opcao.precoAdicional.toNumber(),
              remove: opcao.remove,
              ativa: opcao.ativa,
            })),
          })),
        })),
      })),
    };
  }

  async consultarPedidos(id: string, status?: string) {
    const lanchonete = await this.prisma.lanchonete.findUnique({
      where: { id },
    });
    if (!lanchonete) throw new NotFoundException('Lanchonete não encontrada.');
    if (status !== undefined && !this.statusPedidoValido(status)) {
      throw new BadRequestException('Status inválido');
    }

    const pedidos = await this.prisma.pedido.findMany({
      where: { lanchoneteId: lanchonete.id, ...(status ? { status } : {}) },
      orderBy: { numero: 'desc' },
      include: {
        itens: { include: { opcoes: true } },
        cliente: { select: { id: true, nome: true, telefone: true } },
      },
    });

    return pedidos.map((pedido) =>
      formataPedido({
        ...pedido,
        lanchonete: {
          id: lanchonete.id,
          nome: lanchonete.nome,
          slug: lanchonete.slug,
        },
      }),
    );
  }

  // ---------- Logs ----------

  async listarLogs(opts: {
    nivel?: string;
    categoria?: string;
    limite?: number;
  }) {
    const where: Prisma.LogSistemaWhereInput = {};
    if (opts.nivel === 'info' || opts.nivel === 'erro')
      where.nivel = opts.nivel;
    if (opts.categoria === 'acao' || opts.categoria === 'erro')
      where.categoria = opts.categoria;

    const logs = await this.prisma.logSistema.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(opts.limite ?? 100, 500),
    });

    const usuarioIds = [
      ...new Set(
        logs
          .map((log) => log.usuarioId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const usuarios = usuarioIds.length
      ? await this.prisma.$queryRaw<
          { id: string; nome: string | null; email: string | null }[]
        >`
          SELECT id::text AS id, name AS nome, email
          FROM neon_auth."user"
          WHERE id = ANY(${usuarioIds}::uuid[])
        `
      : [];

    const usuarioPorId = new Map(usuarios.map((u) => [u.id, u]));
    return logs.map((log) => ({
      id: log.id,
      nivel: log.nivel,
      categoria: log.categoria,
      mensagem: log.mensagem,
      detalhes: log.detalhes as Record<string, unknown> | null,
      createdAt: log.createdAt,
      usuarioNome:
        (log.usuarioId && usuarioPorId.get(log.usuarioId)?.nome) ?? null,
      usuarioEmail:
        (log.usuarioId && usuarioPorId.get(log.usuarioId)?.email) ?? null,
    }));
  }

  private async registrarLog(
    user: AuthenticatedUser | null,
    nivel: 'info' | 'erro',
    categoria: 'acao' | 'erro',
    mensagem: string,
    detalhes?: Record<string, unknown>,
  ) {
    await this.prisma.logSistema.create({
      data: {
        nivel,
        categoria,
        mensagem,
        detalhes: (detalhes as Prisma.InputJsonValue) ?? undefined,
        usuarioId: user?.id ?? null,
      },
    });
  }

  // ---------- Administradores ----------

  async listarAdmins(): Promise<AdminSistemaDados[]> {
    return this.prisma.adminSistema.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        nome: true,
        email: true,
        funcao: true,
        createdAt: true,
      },
    });
  }

  async criarAdmin(
    user: AuthenticatedUser,
    body: Record<string, unknown>,
  ): Promise<AdminSistemaDados> {
    const nome = this.nomeValido(body.nome);
    const email = this.emailValido(body.email);
    const senha = this.senhaValida(body.senha);

    const conta = await this.criarContaNeon(nome, email, senha);
    const admin = await this.prisma.adminSistema.create({
      data: { id: conta.id, nome, email, funcao: 'admin' },
      select: {
        id: true,
        nome: true,
        email: true,
        funcao: true,
        createdAt: true,
      },
    });

    await this.registrarLog(user, 'info', 'acao', 'Administrador criado', {
      adminId: admin.id,
      adminEmail: admin.email,
      adminNome: admin.nome,
    });

    return admin;
  }

  async removerAdmin(adminId: string, user: AuthenticatedUser) {
    const admin = await this.prisma.adminSistema.findUnique({
      where: { id: adminId },
    });
    if (!admin) throw new NotFoundException('Administrador não encontrado.');
    if (admin.funcao === 'super') {
      throw new BadRequestException(
        'O administrador raiz não pode ser removido.',
      );
    }
    if (admin.id === user.id) {
      throw new BadRequestException('Você não pode remover o próprio acesso.');
    }
    await this.prisma.adminSistema.delete({ where: { id: admin.id } });

    await this.registrarLog(user, 'info', 'acao', 'Administrador removido', {
      adminId: admin.id,
      adminEmail: admin.email,
    });

    return { ok: true };
  }

  async registrarErro(
    usuarioId: string | null,
    mensagem: string,
    detalhes?: Record<string, unknown>,
  ) {
    await this.registrarLog(
      usuarioId ? ({ id: usuarioId } as AuthenticatedUser) : null,
      'erro',
      'erro',
      mensagem,
      detalhes,
    );
  }

  // ---------- Helpers ----------

  private async requerSuper(user: AuthenticatedUser): Promise<void> {
    const admin = await this.prisma.adminSistema.findUnique({
      where: { id: user.id },
      select: { funcao: true },
    });
    if (!admin || admin.funcao !== 'super') {
      throw new ForbiddenException(
        'Somente o administrador raiz pode executar esta ação.',
      );
    }
  }

  private situacaoValida(value: unknown): SituacaoLanchonete {
    if (
      typeof value !== 'string' ||
      !SITUACOES_LANCHONETE.includes(value as SituacaoLanchonete)
    ) {
      throw new BadRequestException('Situação inválida.');
    }
    return value as SituacaoLanchonete;
  }

  private rotuloSituacao(situacao: SituacaoLanchonete): string {
    const rotulos: Record<SituacaoLanchonete, string> = {
      pendente: 'pendente',
      ativa: 'ativa',
      pausada: 'pausada',
    };
    return rotulos[situacao];
  }

  private statusPedidoValido(value: string): boolean {
    return [
      'recebido',
      'em_preparo',
      'saiu_para_entrega',
      'entregue',
      'cancelado',
    ].includes(value);
  }

  private async criarContaNeon(
    nome: string,
    email: string,
    senha: string,
  ): Promise<{ id: string }> {
    const base = this.issuer.replace(/\/+$/, '');
    if (!base) {
      throw new BadRequestException('Neon Auth não está configurado.');
    }

    const res = await fetch(`${base}/neondb/auth/sign-up/email`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        origin: this.frontUrl,
      },
      body: JSON.stringify({ name: nome, email, password: senha }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      user?: { id?: string };
      data?: { user?: { id?: string } };
      message?: string;
    };

    const id = json.user?.id ?? json.data?.user?.id;
    if (!res.ok || !id) {
      const msg = json.message ?? 'Não foi possível criar a conta.';
      if (/already exists|already registered|já existe|exists/i.test(msg)) {
        throw new ConflictException('Já existe uma conta com esse e-mail.');
      }
      throw new BadRequestException(msg);
    }
    return { id };
  }

  private nomeValido(value: unknown): string {
    if (
      typeof value !== 'string' ||
      value.trim().length < 2 ||
      value.trim().length > 80 ||
      !NOME_REGEX.test(value.trim())
    ) {
      throw new BadRequestException(
        'O nome só pode conter letras, números e espaços.',
      );
    }
    return value.trim().replace(/\s+/g, ' ');
  }

  private emailValido(value: unknown): string {
    const email = typeof value === 'string' ? value.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) {
      throw new BadRequestException('E-mail inválido.');
    }
    return email;
  }

  private senhaValida(value: unknown): string {
    if (typeof value !== 'string' || value.length < 8 || value.length > 72) {
      throw new BadRequestException(
        'A senha deve ter entre 8 e 72 caracteres.',
      );
    }
    return value;
  }
}
