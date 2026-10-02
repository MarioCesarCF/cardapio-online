import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { GrupoOpcoes, Lanchonete, Opcao } from '@prisma/client';
import { PedidosGateway } from '../pedidos/pedidos.gateway.js';
import { normalizarChavePix } from '../pedidos/pix.js';
import { formataPedido } from '../pedidos/pedidos.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ehTipoModelo,
  modeloDoTipo,
  resumoDoModelo,
  chavesDeImagem,
  type CardapioModelo,
} from './cardapio-modelo.js';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NOME_REGEX = /^[\p{L}\p{N} ]+$/u;
const NOME_MAX = 50;
const TIPOS_LANCHONETE = ['lanches', 'pizzaria', 'sorvetes', 'acai'] as const;
const PEDIDO_STATUSES = [
  'recebido',
  'em_preparo',
  'enviado',
  'entregue',
  'finalizado',
  'cancelado',
] as const;
// Transições permitidas: o dono avança uma etapa por vez; cancelamento é
// permitido antes de o pedido sair para entrega (com justificativa obrigatória).
const TRANSICOES_STATUS: Record<string, readonly string[]> = {
  recebido: ['em_preparo', 'cancelado'],
  em_preparo: ['enviado', 'cancelado'],
  enviado: ['entregue'],
  entregue: ['finalizado'],
  finalizado: [],
  cancelado: [],
};
const JUSTIFICATIVA_MAX = 300;
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
  'horarios',
  'cobraTaxaEntrega',
  'taxaEntrega',
] as const;

// Dia 0 = domingo (bate com Date.getDay()). dias fechados guardam inicio/fim null.
export interface HorarioDia {
  dia: number;
  aberto: boolean;
  inicio: string | null;
  fim: string | null;
}

// HH:MM de verdade (00-23 / 00-59). Ancorada nas duas pontas e com classes de
// caractere limitadas: sem quantificador aninhado, o backtracking é linear —
// seguro para ReDoS mesmo com entrada do cliente.
const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const QUANTIDADE_DIAS = 7;

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
          plano: 'trial',
          planoExpira: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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
        data.tipo = this.requiredTipo(value);
      } else if (field === 'horarios') {
        data.horarios = this.validaHorarios(
          value,
        ) as unknown as Prisma.LanchoneteUpdateInput['horarios'];
      } else if (field === 'chavePix') {
        data.chavePix = this.validaChavePix(value);
      } else if (field === 'cobraTaxaEntrega') {
        data.cobraTaxaEntrega = Boolean(value);
      } else if (field === 'taxaEntrega') {
        data.taxaEntrega = this.requiredDecimal(value, 'taxaEntrega');
      } else {
        (data as unknown as Record<string, unknown>)[field] =
          value === '' ? null : value;
      }
    }

    // Invariante: a lanchonete nunca fica sem nome, tipo ou slug (sem tipo ela
    // não tem logo padrão e sem slug não existe página pública). Campos que não
    // vieram no corpo mantêm o valor atual — se esse valor estiver vazio, o save
    // é recusado mesmo assim. É o que fecha a loja criada pelo onboarding sem
    // tipo: ela só passa a ser editável depois de o dono escolher um.
    this.requiredNome(
      { nome: 'nome' in data ? data.nome : lanchonete.nome },
      'nome',
    );
    this.requiredTipo('tipo' in data ? data.tipo : lanchonete.tipo);
    this.requiredSlug('slug' in data ? data.slug : lanchonete.slug);

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
          precoPromo: produto.precoPromo?.toNumber() ?? null,
          imagemUrl: produto.imagemUrl,
          destaque: produto.destaque,
          ativo: produto.ativo,
          grupoIds: produto.grupos.map((pg) => pg.grupoId),
        })),
      })),
    };
  }

  // ---------- Cadastro automático (cardápio modelo) ----------

  /**
   * Cria um cardápio completo de exemplo conforme o tipo escolhido
   * (lanches | pizzaria | acai). Só funciona em cardápio vazio: se a
   * lanchonete já tem categorias ou grupos, o dono precisa usar o CRUD normal
   * (evita duplicar/misturar o cardápio com o que ele já montou).
   *
   * Os produtos também saem com imagem: cada um tem uma palavra-chave
   * (`ProdutoModelo.imagem`) que é trocada por uma foto da galeria. Galeria
   * vazia não quebra nada — o produto é criado sem imagem.
   */
  async gerarCardapioModelo(
    userId: string,
    slug: string,
    body: Record<string, unknown>,
  ) {
    const lanchonete = await this.getLanchoneteOwned(userId, slug);
    const tipo = body.tipo;
    if (!ehTipoModelo(tipo)) {
      throw new BadRequestException(
        'Escolha o tipo do cardápio: lanches, pizzaria ou acai.',
      );
    }
    const modelo = modeloDoTipo(tipo);

    const [qtdeCategorias, qtdeGrupos] = await Promise.all([
      this.prisma.categoria.count({ where: { lanchoneteId: lanchonete.id } }),
      this.prisma.grupoOpcoes.count({ where: { lanchoneteId: lanchonete.id } }),
    ]);
    if (qtdeCategorias > 0 || qtdeGrupos > 0) {
      throw new BadRequestException(
        'Esta lanchonete já tem categorias ou grupos cadastrados. O cardápio de exemplo só pode ser criado em um cardápio vazio.',
      );
    }

    // Fora da transação de propósito: as fotos já existentes não mudam.
    const proximaImagem = await this.imagensDaGaleria(modelo);
    let produtosComImagem = 0;
    let vinculos = 0;

    // Tudo em lote (`createMany` + uma leitura por entidade) em vez de um
    // `create` por item: a transação interativa do Prisma tem timeout de 5s e
    // o deploy (Render → Neon, outra região) leva ~40 queries a mais que o
    // local. Com uma query por produto a transação morria no meio e o Prisma
    // devolvia "Transaction not found" (500) sem gravar nada. Os ids saem das
    // leituras: o cardápio está vazio, então tudo que existe na lanchonete
    // acabou de ser criado aqui. O vínculo produto↔grupo é montado por
    // `categoriaId|nome` e `nome`, então os nomes precisam ser únicos dentro
    // da lanchonete (garantido pelo modelo e conferido em `cardapio-modelo.spec.ts`).
    const nomesProdutosUnicos = new Set<string>();
    for (const categoria of modelo.categorias) {
      for (const produto of categoria.produtos) {
        const chave = `${categoria.nome}|${produto.nome}`;
        if (nomesProdutosUnicos.has(chave)) {
          throw new Error(
            `Cardápio modelo inconsistente: produto "${produto.nome}" repetido em "${categoria.nome}".`,
          );
        }
        nomesProdutosUnicos.add(chave);
      }
    }

    await this.prisma.$transaction(
      async (tx) => {
        // 1) Grupos (1 query) + ids (1 query)
        await tx.grupoOpcoes.createMany({
          data: modelo.grupos.map((grupo) => ({
            lanchoneteId: lanchonete.id,
            nome: grupo.nome,
            tipo: grupo.tipo,
            obrigatorio: grupo.obrigatorio,
            minSelecoes: grupo.minSelecoes,
            maxSelecoes: grupo.maxSelecoes,
          })),
        });
        const gruposCriados = await tx.grupoOpcoes.findMany({
          where: { lanchoneteId: lanchonete.id },
          select: { id: true, nome: true },
        });
        const idGrupos = new Map(gruposCriados.map((g) => [g.nome, g.id]));

        // 2) Todas as opções de todos os grupos em 1 query
        const opcoes = modelo.grupos.flatMap((grupo) => {
          const grupoId = idGrupos.get(grupo.nome);
          if (!grupoId) return [];
          return grupo.opcoes.map((opcao) => ({
            grupoId,
            nome: opcao.nome,
            precoAdicional: opcao.precoAdicional,
            remove: opcao.remove === true,
          }));
        });
        if (opcoes.length > 0) await tx.opcao.createMany({ data: opcoes });

        // 3) Categorias (1 query) + ids (1 query)
        await tx.categoria.createMany({
          data: modelo.categorias.map((categoria, posicao) => ({
            lanchoneteId: lanchonete.id,
            nome: categoria.nome,
            posicao,
          })),
        });
        const categoriasCriadas = await tx.categoria.findMany({
          where: { lanchoneteId: lanchonete.id },
          select: { id: true, nome: true },
        });
        const idCategorias = new Map(
          categoriasCriadas.map((c) => [c.nome, c.id]),
        );

        // 4) Todos os produtos em 1 query (imagem da galeria já decidida)
        const produtos = modelo.categorias.flatMap((categoria) => {
          const categoriaId = idCategorias.get(categoria.nome);
          if (!categoriaId) return [];
          return categoria.produtos.map((produto) => {
            const imagemUrl = produto.imagem
              ? proximaImagem(produto.imagem)
              : undefined;
            if (imagemUrl) produtosComImagem += 1;
            return {
              categoriaId,
              nome: produto.nome,
              preco: produto.preco,
              descricao: produto.descricao ?? null,
              destaque: produto.destaque === true,
              imagemUrl: imagemUrl ?? null,
            };
          });
        });
        if (produtos.length > 0)
          await tx.produto.createMany({ data: produtos });

        // 5) Vínculos produto ↔ grupo (1 query)
        const produtosCriados = await tx.produto.findMany({
          where: { categoriaId: { in: categoriasCriadas.map((c) => c.id) } },
          select: { id: true, categoriaId: true, nome: true },
        });
        const idProdutos = new Map(
          produtosCriados.map((p) => [`${p.categoriaId}|${p.nome}`, p.id]),
        );
        const vinculosProduto = modelo.categorias.flatMap((categoria) => {
          const categoriaId = idCategorias.get(categoria.nome);
          return categoria.produtos.flatMap((produto) => {
            const produtoId = idProdutos.get(`${categoriaId}|${produto.nome}`);
            if (!produtoId) return [];
            // `ordem` = posição do grupo na lista do produto (o painel usa para
            // ordenar os grupos na tela do cardápio).
            return (produto.grupos ?? []).flatMap((nomeGrupo, ordem) => {
              const grupoId = idGrupos.get(nomeGrupo);
              return grupoId ? [{ produtoId, grupoId, ordem }] : [];
            });
          });
        });
        if (vinculosProduto.length > 0) {
          await tx.produtoGrupo.createMany({ data: vinculosProduto });
        }
        vinculos = vinculosProduto.length;
      },
      // Margem folgada: o lote acima faz ~10 queries, então qualquer rede
      // decente fica muito abaixo disso. Sem o timeout explícito valeria o
      // padrão de 5s, que é o que quebrava em produção.
      { maxWait: 20000, timeout: 120000 },
    );

    return {
      ok: true,
      tipo,
      rotulo: modelo.rotulo,
      ...resumoDoModelo(modelo),
      imagens: produtosComImagem,
      vinculos,
    };
  }

  /**
   * Monta o "sorteador" de imagens da galeria: uma foto por palavra-chave e,
   * dentro da mesma chave, as fotos vão se alternando (dois X-Salada não saem
   * com a mesma foto enquanto houver outras na galeria).
   */
  private async imagensDaGaleria(
    modelo: CardapioModelo,
  ): Promise<(chave: string) => string | undefined> {
    const chaves = chavesDeImagem(modelo);
    if (chaves.length === 0) return () => undefined;

    const imagens = await this.prisma.galeriaImagem.findMany({
      where: { keywords: { hasSome: chaves } },
      select: { url: true, keywords: true },
      orderBy: { createdAt: 'asc' },
    });

    const porChave = new Map<string, string[]>();
    for (const chave of chaves) porChave.set(chave, []);
    for (const imagem of imagens) {
      for (const chave of chaves) {
        if (imagem.keywords.includes(chave))
          porChave.get(chave)!.push(imagem.url);
      }
    }

    const posicao = new Map<string, number>();
    return (chave: string) => {
      const urls = porChave.get(chave);
      if (!urls || urls.length === 0) return undefined;
      const atual = posicao.get(chave) ?? 0;
      posicao.set(chave, atual + 1);
      return urls[atual % urls.length];
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
    const precoPromo = this.optionalPrecoPromo(body.precoPromo, preco);
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
        precoPromo,
        descricao,
        imagemUrl,
        destaque,
        ativo,
      },
      select: {
        id: true,
        nome: true,
        preco: true,
        precoPromo: true,
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
    if ('precoPromo' in body || 'preco' in body) {
      // A promoção é validada contra o preço resultante: se o dono baixar o
      // preço base e esquecer de ajustar a promoção, ela deixa de valer.
      const precoBase =
        'preco' in body
          ? this.requiredDecimal(body.preco, 'preco')
          : Number(produto.preco);
      const bruto = 'precoPromo' in body ? body.precoPromo : produto.precoPromo;
      data.precoPromo = this.optionalPrecoPromo(bruto, precoBase);
    }
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
        precoPromo: true,
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

  async listPedidos(
    userId: string,
    slug: string,
    status?: string,
    historico = false,
  ) {
    const lanchonete = await this.getLanchoneteOwned(userId, slug);
    if (
      status !== undefined &&
      !(PEDIDO_STATUSES as readonly string[]).includes(status)
    ) {
      throw new BadRequestException('Status inválido');
    }
    const pedidos = await this.prisma.pedido.findMany({
      where: {
        lanchoneteId: lanchonete.id,
        ...(status ? { status } : {}),
        arquivado: historico,
      },
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
    if (status === pedido.status) {
      throw new BadRequestException(
        `O pedido #${pedido.numero} já está ${this.rotulaStatus(status)}.`,
      );
    }
    const permitidos = TRANSICOES_STATUS[pedido.status] ?? [];
    if (!permitidos.includes(status)) {
      throw new BadRequestException(
        `Transição inválida de "${pedido.status}" para "${status}".`,
      );
    }
    let justificativaCancelamento: string | null = null;
    if (status === 'cancelado') {
      const raw = body.justificativa;
      if (typeof raw !== 'string' || raw.trim().length < 2) {
        throw new BadRequestException(
          'Informe o motivo do cancelamento (mínimo de 2 caracteres).',
        );
      }
      justificativaCancelamento = raw.trim();
      if (justificativaCancelamento.length > JUSTIFICATIVA_MAX) {
        throw new BadRequestException(
          `O motivo do cancelamento deve ter no máximo ${JUSTIFICATIVA_MAX} caracteres.`,
        );
      }
    }
    const atualizado = await this.prisma.pedido.update({
      where: { id: pedido.id },
      data: {
        status,
        ...(justificativaCancelamento != null
          ? { justificativaCancelamento }
          : {}),
      },
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

  // Confirmação manual do recebimento do PIX pelo dono. Enquanto false, o
  // cliente continua vendo o QR Code; confirmar esconde o QR (desfazer volta).
  async confirmarPagamento(
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
    if (typeof body.confirmado !== 'boolean') {
      throw new BadRequestException('Informe "confirmado" como true ou false.');
    }
    if (pedido.formaPagamento !== 'pix') {
      throw new BadRequestException(
        `O pedido #${pedido.numero} não tem pagamento por PIX.`,
      );
    }
    const confirmado = body.confirmado;
    if (confirmado && pedido.pixConfirmado) {
      throw new BadRequestException(
        `O pagamento do pedido #${pedido.numero} já está confirmado.`,
      );
    }
    if (!confirmado && !pedido.pixConfirmado) {
      throw new BadRequestException(
        `O pagamento do pedido #${pedido.numero} ainda não foi confirmado.`,
      );
    }
    const atualizado = await this.prisma.pedido.update({
      where: { id: pedido.id },
      data: {
        pixConfirmado: confirmado,
        pixConfirmadoEm: confirmado ? new Date() : null,
      },
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
      body.maxSelecoes === undefined || body.maxSelecoes === null
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

  private rotulaStatus(status: string): string {
    const rotulos: Record<string, string> = {
      recebido: 'recebido',
      em_preparo: 'em preparo',
      enviado: 'enviado',
      entregue: 'entregue',
      finalizado: 'finalizado',
      cancelado: 'cancelado',
    };
    return rotulos[status] ?? status;
  }

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
    return this.requiredTipo(value);
  }

  /**
   * Nome, tipo e slug são obrigatórios para a lanchonete ter página pública
   * (o tipo define a logo padrão e o slug é a rota `/<slug>`). Por isso os três
   * não podem ser salvos vazios/ausentes.
   */
  private requiredTipo(value: unknown): string {
    if (value === undefined || value === null || value === '') {
      throw new BadRequestException(
        'tipo é obrigatório (use lanches, pizzaria, sorvetes ou acai)',
      );
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

  /**
   * Preço promocional: vazio/ausente remove a promoção. Tem de ser menor que o
   * preço base — um valor igual ou maior não é promoção, é erro de digitação.
   */
  private optionalPrecoPromo(value: unknown, precoBase: number): number | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
      throw new BadRequestException(
        'precoPromo deve ser um número maior ou igual a zero',
      );
    }
    const promo = Math.round(number * 100) / 100;
    if (promo >= precoBase) {
      throw new BadRequestException(
        'O preço da promoção precisa ser menor que o preço normal.',
      );
    }
    return promo;
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

  // Horários: array de 7 itens, um por dia (0 = domingo). Dias abertos exigem
  // inicio/fim "HH:MM" válidos e fim depois do início (00:00 = meia-noite). Dias
  // fechados são normalizados com inicio/fim null.
  private validaHorarios(value: unknown): HorarioDia[] | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (!Array.isArray(value) || value.length !== QUANTIDADE_DIAS) {
      throw new BadRequestException(
        'Os horários devem cobrir os 7 dias da semana.',
      );
    }
    const dias = new Set<number>();
    const resultado: HorarioDia[] = [];
    for (const raw of value) {
      if (typeof raw !== 'object' || raw === null) {
        throw new BadRequestException(
          'Cada dia da semana deve ter um período.',
        );
      }
      const item = raw as Record<string, unknown>;
      const dia = item.dia;
      if (
        typeof dia !== 'number' ||
        !Number.isInteger(dia) ||
        dia < 0 ||
        dia > 6 ||
        dias.has(dia)
      ) {
        throw new BadRequestException(
          'Cada dia da semana deve aparecer uma única vez (0 a 6).',
        );
      }
      dias.add(dia);
      const aberto = Boolean(item.aberto);
      const inicio = aberto
        ? this.obrigatoriaHorario(item.inicio, 'início')
        : null;
      const fim = aberto ? this.obrigatoriaHorario(item.fim, 'fim') : null;
      if (inicio !== null && fim !== null && !this.horarioValido(inicio, fim)) {
        throw new BadRequestException(
          'O horário de fim deve ser depois do horário de início.',
        );
      }
      resultado.push({ dia, aberto, inicio, fim });
    }
    return resultado.sort((a, b) => a.dia - b.dia);
  }

  private horaNoFormato(valor: unknown): valor is string {
    return typeof valor === 'string' && HORA_REGEX.test(valor.trim());
  }

  private obrigatoriaHorario(value: unknown, rotulo: string): string {
    if (!this.horaNoFormato(value)) {
      throw new BadRequestException(
        `Preencha o horário de ${rotulo} no formato HH:MM.`,
      );
    }
    return value.trim();
  }

  private horarioValido(inicio: string, fim: string): boolean {
    const ini = this.toMinutos(inicio);
    const fimMin = this.toMinutos(fim);
    // fim 00:00 = meia-noite (vira o dia, ex.: 22h–00h).
    return fimMin > ini || (fimMin === 0 && ini > 0);
  }

  private toMinutos(horario: string): number {
    const [h, m] = horario.split(':').map(Number);
    return h * 60 + m;
  }

  // Chave PIX: normaliza para o formato do BR Code (telefone +55, CPF/CNPJ só
  // dígitos, e-mail minúsculo, aleatória trim). Vazio limpa a chave.
  private validaChavePix(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value !== 'string') {
      throw new BadRequestException('Chave PIX inválida.');
    }
    const normalizada = normalizarChavePix(value);
    return normalizada === '' ? null : normalizada;
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
      horarios: lanchonete.horarios,
      cobraTaxaEntrega: lanchonete.cobraTaxaEntrega,
      taxaEntrega: Number(lanchonete.taxaEntrega),
      situacao: lanchonete.situacao,
      ativa: lanchonete.situacao === 'ativa',
      plano: lanchonete.plano,
      planoExpira: lanchonete.planoExpira,
      // Venceu = tem data e a data já passou (vale para trial e pago).
      planoExpirado:
        lanchonete.planoExpira !== null && lanchonete.planoExpira < new Date(),
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
