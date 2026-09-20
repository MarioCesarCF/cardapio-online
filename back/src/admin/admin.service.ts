import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { GrupoOpcoes, Lanchonete, Opcao } from '@prisma/client';
import { PedidosGateway } from '../pedidos/pedidos.gateway.js';
import { formataPedido } from '../pedidos/pedidos.types.js';
import { PrismaService } from '../prisma/prisma.service.js';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NOME_REGEX = /^[\p{L}\p{N} ]+$/u;
const NOME_MAX = 50;
const TIPOS_LANCHONETE = ['lanches', 'pizzaria', 'sorvetes', 'acai'] as const;
const PEDIDO_STATUSES = [
  'recebido',
  'em_preparo',
  'saiu_para_entrega',
  'entregue',
  'cancelado',
] as const;
const CONFIG_FIELDS = [
  'nome',
  'slug',
  'logoUrl',
  'fonte',
  'corPrincipal',
  'tipo',
  'chavePix',
  'nomePix',
  'whatsapp',
  'emailContato',
  'enderecoLoja',
  'notifPainel',
  'notifWhatsapp',
  'notifEmail',
] as const;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PedidosGateway,
  ) {}

  // ---------- Lanchonetes ----------

  async listMine(userId: string) {
    return this.prisma.lanchonete.findMany({
      where: { donoId: userId },
      select: {
        id: true,
        nome: true,
        slug: true,
        logoUrl: true,
        tipo: true,
        situacao: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, body: Record<string, unknown>) {
    const nome = this.requiredNome(body, 'nome');
    const slugFornecido = body.slug;
    const slug =
      slugFornecido === undefined ||
      slugFornecido === null ||
      slugFornecido === ''
        ? this.gerarSlug(nome)
        : this.requiredSlug(slugFornecido);
    const fonte = this.optionalString(body.fonte);
    const corPrincipal = this.optionalString(body.corPrincipal);
    const logoUrl = this.optionalString(body.logoUrl);
    const tipo = this.optionalTipo(body.tipo);

    const jaTem = await this.prisma.lanchonete.findFirst({
      where: { donoId: userId },
    });
    if (jaTem) {
      throw new BadRequestException(
        `Sua conta já tem uma lanchonete cadastrada (/${jaTem.slug}). Cada conta pode ter apenas uma lanchonete.`,
      );
    }

    const jaExiste = await this.prisma.lanchonete.findUnique({
      where: { slug },
    });
    if (jaExiste) {
      throw new ConflictException(this.msgNomeEmUso(nome, slug));
    }

    try {
      return await this.prisma.lanchonete.create({
        data: {
          donoId: userId,
          nome,
          slug,
          fonte,
          corPrincipal,
          logoUrl,
          tipo,
        },
        select: { id: true, nome: true, slug: true, logoUrl: true, tipo: true },
      });
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException(this.msgNomeEmUso(nome, slug));
      }
      throw error;
    }
  }

  async getConfig(userId: string, slug: string) {
    const lanchonete = await this.getLanchoneteOwned(userId, slug);
    return this.toConfig(lanchonete);
  }

  async updateConfig(
    userId: string,
    slug: string,
    body: Record<string, unknown>,
  ) {
    const lanchonete = await this.getLanchoneteOwned(userId, slug);

    const data: Prisma.LanchoneteUpdateInput = {};
    for (const field of CONFIG_FIELDS) {
      if (!(field in body)) {
        continue;
      }
      const value = body[field];
      if (field === 'slug') {
        data.slug = this.requiredSlug(value);
      } else if (field === 'nome') {
        data.nome = this.requiredNome(body, 'nome');
      } else if (field === 'tipo') {
        data.tipo = this.optionalTipo(value);
      } else {
        (data as unknown as Record<string, unknown>)[field] =
          value === '' ? null : value;
      }
    }

    try {
      return await this.prisma.lanchonete.update({
        where: { id: lanchonete.id },
        data,
        select: { id: true, nome: true, slug: true, logoUrl: true, tipo: true },
      });
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Slug já está em uso');
      }
      throw error;
    }
  }

  async remove(userId: string, slug: string) {
    const lanchonete = await this.getLanchoneteOwned(userId, slug);
    const qtdePedidos = await this.prisma.pedido.count({
      where: { lanchoneteId: lanchonete.id },
    });
    if (qtdePedidos > 0) {
      throw new BadRequestException(
        'Não é possível excluir uma lanchonete que já recebeu pedidos.',
      );
    }
    await this.prisma.lanchonete.delete({ where: { id: lanchonete.id } });
    return { ok: true };
  }

  async getCardapioAdmin(userId: string, slug: string) {
    const lanchonete = await this.getLanchoneteOwned(userId, slug);
    const result = await this.prisma.lanchonete.findUniqueOrThrow({
      where: { id: lanchonete.id },
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
        gruposOpcoes: {
          orderBy: { nome: 'asc' },
          include: { opcoes: { orderBy: { nome: 'asc' } } },
        },
      },
    });

    return {
      lanchonete: this.toConfig(result),
      grupos: result.gruposOpcoes.map((grupo) => this.toGrupo(grupo)),
      categorias: result.categorias.map((categoria) => ({
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
        })),
      })),
    };
  }

  // ---------- Categorias ----------

  async createCategoria(
    userId: string,
    slug: string,
    body: Record<string, unknown>,
  ) {
    const lanchonete = await this.getLanchoneteOwned(userId, slug);
    const nome = this.requiredString(body, 'nome', 1);
    const imagemUrl = this.optionalString(body.imagemUrl);
    const ativa = body.ativa === undefined ? true : Boolean(body.ativa);

    const last = await this.prisma.categoria.findMany({
      where: { lanchoneteId: lanchonete.id },
      orderBy: { posicao: 'desc' },
      take: 1,
      select: { posicao: true },
    });
    const posicao =
      typeof body.posicao === 'number'
        ? body.posicao
        : (last[0]?.posicao ?? -1) + 1;

    return this.prisma.categoria.create({
      data: { lanchoneteId: lanchonete.id, nome, posicao, imagemUrl, ativa },
      select: {
        id: true,
        nome: true,
        posicao: true,
        imagemUrl: true,
        ativa: true,
      },
    });
  }

  async updateCategoria(
    userId: string,
    idCat: string,
    body: Record<string, unknown>,
  ) {
    await this.assureCategoria(userId, idCat);
    const data: Prisma.CategoriaUpdateInput = {};
    if ('nome' in body) data.nome = this.requiredString(body, 'nome', 1);
    if ('posicao' in body) data.posicao = this.integer(body.posicao, 'posicao');
    if ('imagemUrl' in body)
      data.imagemUrl = this.nullableString(body.imagemUrl);
    if ('ativa' in body) data.ativa = Boolean(body.ativa);

    return this.prisma.categoria.update({
      where: { id: idCat },
      data,
      select: {
        id: true,
        nome: true,
        posicao: true,
        imagemUrl: true,
        ativa: true,
      },
    });
  }

  async removeCategoria(userId: string, idCat: string) {
    await this.assureCategoria(userId, idCat);
    await this.prisma.categoria.delete({ where: { id: idCat } });
    return { ok: true };
  }

  async createProduto(
    userId: string,
    idCat: string,
    body: Record<string, unknown>,
  ) {
    const categoria = await this.assureCategoria(userId, idCat);
    const nome = this.requiredString(body, 'nome', 1);
    const preco = this.requiredDecimal(body.preco, 'preco');
    const descricao = this.optionalString(body.descricao);
    const imagemUrl = this.optionalString(body.imagemUrl);
    const destaque =
      body.destaque === undefined ? false : Boolean(body.destaque);
    const ativo = body.ativo === undefined ? true : Boolean(body.ativo);

    return this.prisma.produto.create({
      data: {
        categoriaId: categoria.id,
        nome,
        preco,
        descricao,
        imagemUrl,
        destaque,
        ativo,
      },
      select: {
        id: true,
        nome: true,
        preco: true,
        descricao: true,
        imagemUrl: true,
        destaque: true,
        ativo: true,
      },
    });
  }

  async updateProduto(
    userId: string,
    idProd: string,
    body: Record<string, unknown>,
  ) {
    const produto = await this.assureProduto(userId, idProd);
    const data: Prisma.ProdutoUpdateInput = {};
    if ('nome' in body) data.nome = this.requiredString(body, 'nome', 1);
    if ('preco' in body) data.preco = this.requiredDecimal(body.preco, 'preco');
    if ('descricao' in body)
      data.descricao = this.nullableString(body.descricao);
    if ('imagemUrl' in body)
      data.imagemUrl = this.nullableString(body.imagemUrl);
    if ('destaque' in body) data.destaque = Boolean(body.destaque);
    if ('ativo' in body) data.ativo = Boolean(body.ativo);

    return this.prisma.produto.update({
      where: { id: produto.id },
      data,
      select: {
        id: true,
        nome: true,
        preco: true,
        descricao: true,
        imagemUrl: true,
        destaque: true,
        ativo: true,
      },
    });
  }

  async removeProduto(userId: string, idProd: string) {
    const produto = await this.assureProduto(userId, idProd);
    await this.prisma.produto.delete({ where: { id: produto.id } });
    return { ok: true };
  }

  async setProdutoGrupos(
    userId: string,
    idProd: string,
    body: Record<string, unknown>,
  ) {
    const produto = await this.assureProduto(userId, idProd);
    const grupoIds = this.stringArray(body.grupoIds, 'grupoIds');

    const validos = await this.prisma.grupoOpcoes.count({
      where: {
        id: { in: grupoIds },
        lanchoneteId: produto.categoria.lanchoneteId,
      },
    });
    if (validos !== grupoIds.length) {
      throw new BadRequestException(
        'Um ou mais grupos não pertencem a esta lanchonete',
      );
    }

    await this.prisma.$transaction([
      this.prisma.produtoGrupo.deleteMany({ where: { produtoId: produto.id } }),
      this.prisma.produtoGrupo.createMany({
        data: grupoIds.map((grupoId, ordem) => ({
          produtoId: produto.id,
          grupoId,
          ordem,
        })),
      }),
    ]);

    return { ok: true };
  }

  // ---------- Pedidos (painel) ----------

  async listPedidos(userId: string, slug: string, status?: string) {
    const lanchonete = await this.getLanchoneteOwned(userId, slug);
    if (
      status !== undefined &&
      !(PEDIDO_STATUSES as readonly string[]).includes(status)
    ) {
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

  async updatePedidoStatus(
    userId: string,
    idPedido: string,
    body: Record<string, unknown>,
  ) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: idPedido },
      include: { lanchonete: true },
    });
    if (!pedido || pedido.lanchonete.donoId !== userId) {
      throw new NotFoundException('Pedido não encontrado');
    }
    const status = body.status;
    if (
      typeof status !== 'string' ||
      !(PEDIDO_STATUSES as readonly string[]).includes(status)
    ) {
      throw new BadRequestException('Status inválido');
    }
    const atualizado = await this.prisma.pedido.update({
      where: { id: pedido.id },
      data: { status },
      include: {
        itens: { include: { opcoes: true } },
        cliente: { select: { id: true, nome: true, telefone: true } },
      },
    });
    this.gateway.emitirStatusPedido(pedido.lanchonete.id, {
      id: atualizado.id,
      numero: atualizado.numero,
      status: atualizado.status,
    });
    return formataPedido({
      ...atualizado,
      lanchonete: {
        id: pedido.lanchonete.id,
        nome: pedido.lanchonete.nome,
        slug: pedido.lanchonete.slug,
      },
    });
  }

  // ---------- Grupos de opções ----------

  async createGrupo(
    userId: string,
    slug: string,
    body: Record<string, unknown>,
  ) {
    const lanchonete = await this.getLanchoneteOwned(userId, slug);
    const nome = this.requiredString(body, 'nome', 1);
    const tipo = this.optionalEnum(
      body.tipo,
      ['unica', 'multipla'],
      'multipla',
    );
    const obrigatorio =
      body.obrigatorio === undefined ? false : Boolean(body.obrigatorio);
    const minSelecoes =
      body.minSelecoes === undefined
        ? 0
        : this.integer(body.minSelecoes, 'minSelecoes');
    let maxSelecoes: number | null =
      body.maxSelecoes === undefined
        ? null
        : this.integer(body.maxSelecoes, 'maxSelecoes');
    if (maxSelecoes !== null && maxSelecoes < minSelecoes) {
      throw new BadRequestException(
        'maxSelecoes não pode ser menor que minSelecoes',
      );
    }

    return this.prisma.grupoOpcoes.create({
      data: {
        lanchoneteId: lanchonete.id,
        nome,
        tipo,
        obrigatorio,
        minSelecoes,
        maxSelecoes,
      },
      select: {
        id: true,
        nome: true,
        tipo: true,
        obrigatorio: true,
        minSelecoes: true,
        maxSelecoes: true,
      },
    });
  }

  async updateGrupo(
    userId: string,
    idGrupo: string,
    body: Record<string, unknown>,
  ) {
    await this.assureGrupo(userId, idGrupo);
    const data: Prisma.GrupoOpcoesUpdateInput = {};
    let minSelecoes = 0;
    if ('nome' in body) data.nome = this.requiredString(body, 'nome', 1);
    if ('tipo' in body)
      data.tipo = this.optionalEnum(
        body.tipo,
        ['unica', 'multipla'],
        'multipla',
      );
    if ('obrigatorio' in body) data.obrigatorio = Boolean(body.obrigatorio);
    if ('minSelecoes' in body) {
      minSelecoes = this.integer(body.minSelecoes, 'minSelecoes');
      data.minSelecoes = minSelecoes;
    }

    let maxSelecoes: number | null | undefined;
    if ('maxSelecoes' in body) {
      maxSelecoes =
        body.maxSelecoes === null
          ? null
          : this.integer(body.maxSelecoes, 'maxSelecoes');
      if (maxSelecoes !== null && maxSelecoes < minSelecoes) {
        throw new BadRequestException(
          'maxSelecoes não pode ser menor que minSelecoes',
        );
      }
    }
    if (maxSelecoes !== undefined) {
      data.maxSelecoes = maxSelecoes;
    }

    return this.prisma.grupoOpcoes.update({
      where: { id: idGrupo },
      data,
      select: {
        id: true,
        nome: true,
        tipo: true,
        obrigatorio: true,
        minSelecoes: true,
        maxSelecoes: true,
      },
    });
  }

  async removeGrupo(userId: string, idGrupo: string) {
    await this.assureGrupo(userId, idGrupo);
    await this.prisma.grupoOpcoes.delete({ where: { id: idGrupo } });
    return { ok: true };
  }

  async createOpcao(
    userId: string,
    idGrupo: string,
    body: Record<string, unknown>,
  ) {
    const grupo = await this.assureGrupo(userId, idGrupo);
    const nome = this.requiredString(body, 'nome', 1);
    const precoAdicional =
      body.precoAdicional === undefined
        ? 0
        : this.requiredDecimal(body.precoAdicional, 'precoAdicional');
    const remove = body.remove === undefined ? false : Boolean(body.remove);

    return this.prisma.opcao.create({
      data: { grupoId: grupo.id, nome, precoAdicional, remove },
      select: {
        id: true,
        nome: true,
        precoAdicional: true,
        remove: true,
        ativa: true,
      },
    });
  }

  async updateOpcao(
    userId: string,
    idOpcao: string,
    body: Record<string, unknown>,
  ) {
    await this.assureOpcao(userId, idOpcao);
    const data: Prisma.OpcaoUpdateInput = {};
    if ('nome' in body) data.nome = this.requiredString(body, 'nome', 1);
    if ('precoAdicional' in body) {
      data.precoAdicional = this.requiredDecimal(
        body.precoAdicional,
        'precoAdicional',
      );
    }
    if ('remove' in body) data.remove = Boolean(body.remove);
    if ('ativa' in body) data.ativa = Boolean(body.ativa);

    return this.prisma.opcao.update({
      where: { id: idOpcao },
      data,
      select: {
        id: true,
        nome: true,
        precoAdicional: true,
        remove: true,
        ativa: true,
      },
    });
  }

  async removeOpcao(userId: string, idOpcao: string) {
    await this.assureOpcao(userId, idOpcao);
    await this.prisma.opcao.delete({ where: { id: idOpcao } });
    return { ok: true };
  }

  // ---------- Dono / helpers de acesso ----------

  private async getLanchoneteOwned(userId: string, slug: string) {
    const lanchonete = await this.prisma.lanchonete.findUnique({
      where: { slug },
    });
    if (!lanchonete || lanchonete.donoId !== userId) {
      throw new NotFoundException('Lanchonete não encontrada');
    }
    return lanchonete;
  }

  private async assureCategoria(userId: string, idCat: string) {
    const categoria = await this.prisma.categoria.findUnique({
      where: { id: idCat },
      include: { lanchonete: true },
    });
    if (!categoria || categoria.lanchonete.donoId !== userId) {
      throw new NotFoundException('Categoria não encontrada');
    }
    return categoria;
  }

  private async assureProduto(userId: string, idProd: string) {
    const produto = await this.prisma.produto.findUnique({
      where: { id: idProd },
      include: { categoria: { include: { lanchonete: true } } },
    });
    if (!produto || produto.categoria.lanchonete.donoId !== userId) {
      throw new NotFoundException('Produto não encontrado');
    }
    return produto;
  }

  private async assureGrupo(userId: string, idGrupo: string) {
    const grupo = await this.prisma.grupoOpcoes.findUnique({
      where: { id: idGrupo },
      include: { lanchonete: true },
    });
    if (!grupo || grupo.lanchonete.donoId !== userId) {
      throw new NotFoundException('Grupo de opções não encontrado');
    }
    return grupo;
  }

  private async assureOpcao(userId: string, idOpcao: string) {
    const opcao = await this.prisma.opcao.findUnique({
      where: { id: idOpcao },
      include: { grupo: { include: { lanchonete: true } } },
    });
    if (!opcao || opcao.grupo.lanchonete.donoId !== userId) {
      throw new NotFoundException('Opção não encontrada');
    }
    return opcao;
  }

  // ---------- Validação ----------

  private requiredString(
    body: Record<string, unknown>,
    key: string,
    min: number,
  ): string {
    const value = body[key];
    if (typeof value !== 'string' || value.trim().length < min) {
      throw new BadRequestException(
        min > 1
          ? `${key} é obrigatório e deve ter pelo menos ${min} caracteres`
          : `${key} é obrigatório`,
      );
    }
    return value.trim();
  }

  private optionalString(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value !== 'string') {
      throw new BadRequestException('valor inválido');
    }
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }

  private nullableString(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value !== 'string') {
      throw new BadRequestException('valor inválido');
    }
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }

  private requiredNome(body: Record<string, unknown>, key: string): string {
    const raw = body[key];
    if (typeof raw !== 'string') {
      throw new BadRequestException(`${key} é obrigatório`);
    }
    const nome = raw.trim().replace(/\s+/g, ' ');
    if (nome.length < 2) {
      throw new BadRequestException('O nome deve ter pelo menos 2 caracteres');
    }
    if (nome.length > NOME_MAX) {
      throw new BadRequestException(
        `O nome deve ter no máximo ${NOME_MAX} caracteres`,
      );
    }
    if (!NOME_REGEX.test(nome)) {
      throw new BadRequestException(
        'O nome só pode conter letras, números e espaços',
      );
    }
    return nome;
  }

  private gerarSlug(nome: string): string {
    return nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  private optionalTipo(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    if (
      typeof value !== 'string' ||
      !(TIPOS_LANCHONETE as readonly string[]).includes(value)
    ) {
      throw new BadRequestException(
        'tipo inválido (use lanches, pizzaria, sorvetes ou acai)',
      );
    }
    return value;
  }

  private msgNomeEmUso(nome: string, slug: string): string {
    return `Já existe uma lanchonete com esse nome (endereço /${slug}). Escolha outro nome.`;
  }

  private requiredSlug(value: unknown): string {
    if (typeof value !== 'string' || !SLUG_REGEX.test(value)) {
      throw new BadRequestException(
        'slug deve conter apenas letras minúsculas, números e hífens (ex.: sabor-da-vila)',
      );
    }
    return value;
  }

  private requiredDecimal(value: unknown, key: string): number {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
      throw new BadRequestException(
        `${key} deve ser um número maior ou igual a zero`,
      );
    }
    return Math.round(number * 100) / 100;
  }

  private integer(value: unknown, key: string): number {
    if (!Number.isInteger(value)) {
      throw new BadRequestException(`${key} deve ser um número inteiro`);
    }
    return value as number;
  }

  private stringArray(value: unknown, key: string): string[] {
    if (
      !Array.isArray(value) ||
      value.some((item) => typeof item !== 'string')
    ) {
      throw new BadRequestException(`${key} deve ser uma lista de ids`);
    }
    return value as string[];
  }

  private optionalEnum(
    value: unknown,
    allowed: readonly string[],
    fallback: string,
  ): string {
    if (value === undefined || value === null) {
      return fallback;
    }
    if (typeof value !== 'string' || !allowed.includes(value)) {
      throw new BadRequestException(`valor inválido`);
    }
    return value;
  }

  private isUniqueError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private toConfig(lanchonete: Lanchonete): Record<string, unknown> {
    return {
      id: lanchonete.id,
      nome: lanchonete.nome,
      slug: lanchonete.slug,
      logoUrl: lanchonete.logoUrl,
      fonte: lanchonete.fonte,
      corPrincipal: lanchonete.corPrincipal,
      tipo: lanchonete.tipo,
      chavePix: lanchonete.chavePix,
      nomePix: lanchonete.nomePix,
      whatsapp: lanchonete.whatsapp,
      emailContato: lanchonete.emailContato,
      enderecoLoja: lanchonete.enderecoLoja,
      notifPainel: lanchonete.notifPainel,
      notifWhatsapp: lanchonete.notifWhatsapp,
      notifEmail: lanchonete.notifEmail,
      situacao: lanchonete.situacao,
      ativa: lanchonete.situacao === 'ativa',
    };
  }

  private toGrupo(
    grupo: GrupoOpcoes & { opcoes: Opcao[] },
  ): Record<string, unknown> {
    const opcoes = grupo.opcoes.map((opcao) => ({
      id: opcao.id,
      nome: opcao.nome,
      precoAdicional: opcao.precoAdicional.toNumber(),
      remove: opcao.remove,
      ativa: opcao.ativa,
    }));
    return {
      id: grupo.id,
      nome: grupo.nome,
      tipo: grupo.tipo,
      obrigatorio: grupo.obrigatorio,
      minSelecoes: grupo.minSelecoes,
      maxSelecoes: grupo.maxSelecoes,
      opcoes,
    };
  }
}
