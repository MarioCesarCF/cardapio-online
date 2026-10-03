import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { gerarBrCode } from './pix.js';
import { montaPrecoUnit } from './preco.js';
import { formataPedido } from './pedidos.types.js';
import { estaDentroDoHorario, type HorarioDia } from './horarios.js';
import { calculaTaxaEntrega, calculaTotalPedido } from './taxa-entrega.js';
import { PedidosGateway } from './pedidos.gateway.js';
import { WhatsAppService } from '../whatsapp/whatsapp.service.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';

interface OpcaoPedidoInput {
  opcaoId: string;
}

interface ItemPedidoInput {
  produtoId: string;
  qtd: number;
  opcoes?: OpcaoPedidoInput[];
}

interface ItemPedidoValidado {
  produtoId: string;
  qtd: number;
  opcoes: OpcaoPedidoInput[];
}

interface EnderecoInput {
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep?: string;
  apelido?: string;
}

// A corrida do número do pedido: `MAX(numero)+1` é lido FORA da transação, então
// dois checkouts no mesmo instante na mesma loja podem calcular o mesmo número —
// o `@@unique([lanchoneteId, numero])` recusa o segundo (P2002). Em vez de deixar
// virar 500, tenta de novo com o número recalculado. Espera um número aleatório
// curto entre as tentativas para as duas requisições não ficarem em lockstep.
const TENTATIVAS_NUMERO = 5;
const ESPERA_BASE_MS = 20;

interface ItemMontado {
  produtoId: string;
  nome: string;
  qtd: number;
  precoUnit: number;
  opcoes: {
    opcaoId: string;
    nome: string;
    precoAdicional: number;
    remove: boolean;
  }[];
}

interface DadosNovoPedido {
  lanchoneteId: string;
  clienteId: string;
  tipoEntrega: 'entrega' | 'retirar' | 'consumir';
  subtotal: number;
  taxaEntrega: number;
  total: number;
  formaPagamento: 'pix' | 'cartao' | 'dinheiro';
  brCodePix: string | null;
  clienteTelefone: string | null;
  enderecoEntrega: unknown;
  observacao: string | null;
  pagamentoInfo: string | null;
  itensMontados: ItemMontado[];
}

  export interface CriaPedidoInput {
  itens: ItemPedidoInput[];
  enderecoId?: string;
  endereco?: EnderecoInput;
  observacao?: string;
  pagamentoInfo?: string;
  telefone?: string;
  formaPagamento?: 'pix' | 'cartao' | 'dinheiro';
  tipoEntrega?: 'entrega' | 'retirar' | 'consumir';
}

@Injectable()
export class PedidosService {
  private readonly logger = new Logger(PedidosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PedidosGateway,
    private readonly whatsapp: WhatsAppService,
  ) {}

  async criaPedido(
    slug: string,
    user: AuthenticatedUser,
    body: CriaPedidoInput,
  ) {
    const itens = this.validaItens(body.itens);
    const observacao = this.opcional(body.observacao, 300);
    const pagamentoInfo = this.opcional(body.pagamentoInfo, 100);
    const telefone = this.validaTelefone(body.telefone);
    const formaPagamento = this.validaFormaPagamento(body.formaPagamento);
    const tipoEntrega = this.validaTipoEntrega(body.tipoEntrega);

    const lanchonete = await this.prisma.lanchonete.findFirst({
      where: { slug, situacao: 'ativa' },
    });
    if (!lanchonete) throw new NotFoundException('Cardápio não encontrado.');

    if (
      !estaDentroDoHorario(
        lanchonete.horarios as HorarioDia[] | null,
        new Date(),
      )
    ) {
      throw new BadRequestException(
        'Lanchonete fora do horário de funcionamento.',
      );
    }

    if (
      lanchonete.plano === 'trial' &&
      lanchonete.planoExpira !== null &&
      lanchonete.planoExpira < new Date()
    ) {
      throw new BadRequestException(
        'O período de teste desta lanchonete expirou. Entre em contato para assinar um plano.',
      );
    }

    const enderecoEntrega =
      tipoEntrega === 'entrega' ? await this.resolveEndereco(user, body) : null;
    const produtos = await this.carregaProdutos(itens, lanchonete.id);
    const { itensMontados, subtotal } = this.montaItens(itens, produtos);

    // Taxa de entrega: só vale para pedidos com entrega, quando a lanchonete
    // configura a cobrança. Snapshot no pedido (mudanças futuras da taxa não
    // alteram pedidos já criados).
    const taxaEntrega = calculaTaxaEntrega(
      tipoEntrega,
      lanchonete.cobraTaxaEntrega,
      Number(lanchonete.taxaEntrega),
    );
    const total = calculaTotalPedido(subtotal, taxaEntrega);

    await this.ensureCliente(user, telefone);

    const brCodePix =
      formaPagamento === 'pix' ? this.geraPix(lanchonete, total) : null;

    const pedido = await this.criaPedidoComRetry({
      lanchoneteId: lanchonete.id,
      clienteId: user.id,
      tipoEntrega,
      subtotal,
      taxaEntrega,
      total,
      formaPagamento,
      brCodePix,
      clienteTelefone: telefone,
      enderecoEntrega: enderecoEntrega as Prisma.InputJsonValue,
      observacao,
      pagamentoInfo,
      itensMontados,
    });

    this.gateway.emitirNovoPedido(
      lanchonete.id,
      formataPedido({
        ...pedido,
        lanchonete: {
          id: lanchonete.id,
          nome: lanchonete.nome,
          slug: lanchonete.slug,
        },
        cliente: { id: user.id, nome: user.name, telefone },
      }),
    );

    // Notificação WhatsApp ao dono quando o canal está ativo (nunca derruba o
    // pedido: falha de envio é apenas logada).
    try {
      await this.notificaWhatsApp(lanchonete, pedido);
    } catch (error) {
      this.logger.warn(
        `WhatsApp indisponível (loja ${lanchonete.id}): ${
          error instanceof Error ? error.message : 'erro desconhecido'
        }`,
      );
    }

    // A 1ª lanchonete cujo pedido o cliente finaliza vira favorita (silencioso).
    try {
      await this.prisma.lanchoneteFavorita.upsert({
        where: {
          clienteId_lanchoneteId: {
            clienteId: user.id,
            lanchoneteId: lanchonete.id,
          },
        },
        create: { clienteId: user.id, lanchoneteId: lanchonete.id },
        update: {},
      });
    } catch (error) {
      this.logger.warn(
        `Não foi possível favoritar ${lanchonete.id} para ${user.id}: ${
          error instanceof Error ? error.message : 'erro desconhecido'
        }`,
      );
    }

    return {
      id: pedido.id,
      numero: pedido.numero,
      status: pedido.status,
      tipoEntrega: pedido.tipoEntrega,
      formaPagamento: pedido.formaPagamento,
      pagamentoInfo: pedido.pagamentoInfo,
      pixConfirmado: pedido.pixConfirmado,
      subtotal: Number(pedido.subtotal),
      taxaEntrega: Number(pedido.taxaEntrega),
      total: Number(pedido.total),
      brCodePix: pedido.brCodePix,
    };
  }

  private validaItens(itens: unknown): ItemPedidoValidado[] {
    if (!Array.isArray(itens) || itens.length === 0 || itens.length > 50) {
      throw new BadRequestException('Informe ao menos um item no pedido.');
    }
    return itens.map((rawItem) => {
      const item = rawItem as ItemPedidoInput;
      const produtoId = this.obrigatoria(item.produtoId, 'produtoId', 30);
      const qtd = item.qtd;
      if (!Number.isInteger(qtd) || qtd < 1 || qtd > 99) {
        throw new BadRequestException('Quantidade inválida.');
      }
      const opcoes = Array.isArray(item.opcoes)
        ? item.opcoes.map((op) => ({
            opcaoId: this.obrigatoria(op.opcaoId, 'opcaoId', 30),
          }))
        : [];
      return { produtoId, qtd, opcoes };
    });
  }

  private async resolveEndereco(
    user: AuthenticatedUser,
    body: CriaPedidoInput,
  ): Promise<Record<string, string | null>> {
    if (body.enderecoId) {
      const endereco = await this.prisma.endereco.findFirst({
        where: {
          id: this.obrigatoria(body.enderecoId, 'enderecoId', 30),
          clienteId: user.id,
        },
      });
      if (!endereco) throw new NotFoundException('Endereço não encontrado.');
      return {
        rua: endereco.rua,
        numero: endereco.numero,
        complemento: endereco.complemento,
        bairro: endereco.bairro,
        cidade: endereco.cidade,
        uf: endereco.uf,
        cep: endereco.cep,
      };
    }

    if (body.endereco) {
      const e = body.endereco;
      const uf = this.obrigatoria(e.uf, 'uf', 2).toUpperCase();
      if (!/^[A-Z]{2}$/.test(uf)) throw new BadRequestException('UF inválida.');
      return {
        rua: this.obrigatoria(e.rua, 'rua', 120),
        numero: this.obrigatoria(e.numero, 'numero', 20),
        complemento: this.opcional(e.complemento, 80),
        bairro: this.obrigatoria(e.bairro, 'bairro', 80),
        cidade: this.obrigatoria(e.cidade, 'cidade', 80),
        uf,
        cep: this.opcional(e.cep, 9),
      };
    }

    throw new BadRequestException('Informe um endereço de entrega.');
  }

  private async carregaProdutos(
    itens: ItemPedidoInput[],
    lanchoneteId: string,
  ) {
    const ids = itens.map((i) => i.produtoId);
    return this.prisma.produto.findMany({
      where: {
        id: { in: ids },
        ativo: true,
        categoria: { lanchoneteId, ativa: true },
      },
      include: {
        grupos: {
          include: {
            grupo: { include: { opcoes: { where: { ativa: true } } } },
          },
        },
      },
    });
  }

  private montaItens(
    itens: ItemPedidoValidado[],
    produtos: Awaited<ReturnType<PedidosService['carregaProdutos']>>,
  ): { itensMontados: ItemMontado[]; subtotal: number } {
    const porId = new Map(produtos.map((p) => [p.id, p]));
    const itensMontados = itens.map((item) => {
      const produto = porId.get(item.produtoId);
      if (!produto)
        throw new BadRequestException('Há itens indisponíveis no pedido.');

      const grupos = produto.grupos.map((g) => g.grupo);
      const opcoesPorGrupo = new Map<
        string,
        (typeof grupos)[number]['opcoes'][number][]
      >();
      for (const grupo of grupos) opcoesPorGrupo.set(grupo.id, []);

      for (const op of item.opcoes) {
        const grupo = grupos.find((gr) =>
          gr.opcoes.some((o) => o.id === op.opcaoId),
        );
        const opcao = grupo?.opcoes.find((o) => o.id === op.opcaoId);
        if (!opcao)
          throw new BadRequestException('Opção inválida para o produto.');
        opcoesPorGrupo.get(grupo!.id)!.push(opcao);
      }

      for (const grupo of grupos) {
        const selecionadas = opcoesPorGrupo.get(grupo.id) ?? [];
        const quantas = selecionadas.length;
        if (grupo.tipo === 'unica' && quantas > 1) {
          throw new BadRequestException(
            `Escolha apenas uma opção em "${grupo.nome}".`,
          );
        }
        const removeSelecionada = selecionadas.some((o) => o.remove);
        if (removeSelecionada && quantas > 1) {
          throw new BadRequestException(
            `A opção "remover" de "${grupo.nome}" não combina com acréscimos.`,
          );
        }
        const minimo = grupo.obrigatorio
          ? Math.max(grupo.minSelecoes, 1)
          : grupo.minSelecoes;
        if (quantas < minimo) {
          throw new BadRequestException(
            `Selecione ao menos ${minimo} opção(ões) em "${grupo.nome}".`,
          );
        }
        if (grupo.maxSelecoes != null && quantas > grupo.maxSelecoes) {
          throw new BadRequestException(
            `Máximo de ${grupo.maxSelecoes} seleção(ões) em "${grupo.nome}".`,
          );
        }
      }

      // Promoção: o `precoDoProduto` devolve o `precoPromo` quando ele existe e
      // é menor que o preço normal (ver `preco.ts`). Os acréscimos das opções
      // somam por cima. O snapshot em `pedido_itens.precoUnit` grava o valor
      // realmente cobrado, então o pedido não muda se a lanchonete mexer na
      // promoção depois.
      const todasOpcoes = gruposFlat(produto, item.opcoes);
      const precoUnit = montaPrecoUnit(produto, todasOpcoes);
      return {
        produtoId: produto.id,
        nome: produto.nome,
        qtd: item.qtd,
        precoUnit,
        opcoes: todasOpcoes.map((o) => ({
          opcaoId: o.id,
          nome: o.nome,
          precoAdicional: Number(o.precoAdicional),
          remove: o.remove,
        })),
      };
    });

    const subtotal = itensMontados.reduce(
      (acc, i) => acc + i.precoUnit * i.qtd,
      0,
    );
    return { itensMontados, subtotal };
  }

  private geraPix(
    lanchonete: {
      chavePix: string | null;
      nomePix: string | null;
      nome: string;
    },
    valorTotal: number,
  ) {
    if (!lanchonete.chavePix) {
      throw new BadRequestException(
        'A lanchonete ainda não configurou a chave PIX.',
      );
    }
    return gerarBrCode({
      chavePix: lanchonete.chavePix,
      nomeTitular: lanchonete.nomePix ?? lanchonete.nome,
      valorTotal,
    });
  }

  /**
   * Grava o pedido com o número reservado sem corrida.
   *
   * O número é `MAX(numero)+1` por lanchonete, e esse `MAX` precisa ser lido
   * dentro da mesma transação que grava — senão dois checkouts simultâneos leem o
   * mesmo valor e o segundo leva P2002 do `@@unique([lanchoneteId, numero])`.
   *
   * Um lock aloneatório de transação por loja serializa a reserva: cada checkout
   * entra, lê o `MAX` já com o número do anterior gravado, grava e libera. O lock
   * é de escopo de transação (`_xact_`), então some sozinho no COMMIT/ROLLBACK e
   * é compatível com o pooler da Neon (PgBouncer em modo transação). Ele serializa
   * **por loja**, então duas lanchonetes diferentes não se atrapalham.
   *
   * O retry no P2002 continua como rede de segurança (outro processo escrevendo no
   * mesmo banco sem passar por aqui), com espera aleatória para as tentativas não
   * caírem em lockstep.
   */
  private async criaPedidoComRetry(dados: DadosNovoPedido) {
    for (let tentativa = 1; tentativa <= TENTATIVAS_NUMERO; tentativa++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            // `::text` é obrigatório: `pg_advisory_xact_lock` devolve `void` e o
            // Prisma falha ao desserializar (`P2010`) — o cast faz o SELECT
            // devolver um tipo que ele entende, sem mudar o efeito do lock.
            await tx.$queryRawUnsafe(
              'SELECT pg_advisory_xact_lock(hashtext($1)::bigint)::text AS travado',
              dados.lanchoneteId,
            );
            const numero = await this.proximoNumero(dados.lanchoneteId, tx);
            return tx.pedido.create({
              data: {
                numero,
                lanchoneteId: dados.lanchoneteId,
                clienteId: dados.clienteId,
                status: 'recebido',
                tipoEntrega: dados.tipoEntrega,
                subtotal: dados.subtotal,
                taxaEntrega: dados.taxaEntrega,
                total: dados.total,
                formaPagamento: dados.formaPagamento,
                brCodePix: dados.brCodePix,
                clienteTelefone: dados.clienteTelefone,
                enderecoEntrega: dados.enderecoEntrega as Prisma.InputJsonValue,
                observacao: dados.observacao,
                pagamentoInfo: dados.pagamentoInfo,
                itens: {
                  create: dados.itensMontados.map((item) => ({
                    produtoId: item.produtoId,
                    nomeSnapshot: item.nome,
                    precoUnit: item.precoUnit,
                    qtd: item.qtd,
                    opcoes: {
                      create: item.opcoes.map((op) => ({
                        opcaoId: op.opcaoId,
                        nomeSnapshot: op.nome,
                        precoAdicional: op.precoAdicional,
                        remove: op.remove,
                      })),
                    },
                  })),
                },
              },
              include: { itens: { include: { opcoes: true } } },
            });
          },
          // A serialização segura a transação na fila dos checkouts concorrentes:
          // o default do Prisma (5s) mataria o pedido no deploy lento.
          { maxWait: 20000, timeout: 30000 },
        );
      } catch (error) {
        if (!this.ehConflitoNumero(error)) throw error;
        this.logger.warn(
          `Número de pedido em conflito (loja ${dados.lanchoneteId}), tentativa ${tentativa}/${TENTATIVAS_NUMERO}.`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, ESPERA_BASE_MS * tentativa + Math.random() * 20),
        );
      }
    }

    this.logger.error(
      `Não foi possível reservar o número do pedido na loja ${dados.lanchoneteId} após ${TENTATIVAS_NUMERO} tentativas.`,
    );
    throw new ServiceUnavailableException(
      'Muitos pedidos ao mesmo tempo. Tente novamente em instantes.',
    );
  }

  private ehConflitoNumero(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private async proximoNumero(
    lanchoneteId: string,
    client: Pick<PrismaService, '$queryRawUnsafe'> = this.prisma,
  ): Promise<number> {
    const [next] = await client.$queryRawUnsafe<{ next: bigint }[]>(
      'SELECT COALESCE(MAX(numero), 0) + 1 AS next FROM pedidos WHERE "lanchoneteId" = $1',
      lanchoneteId,
    );
    return Number(next.next);
  }

  private async notificaWhatsApp(
    lanchonete: {
      nome: string;
      whatsapp: string | null;
      notifWhatsapp: boolean;
    },
    pedido: {
      numero: number;
      total: unknown;
      tipoEntrega: string;
      formaPagamento: string;
    },
  ): Promise<void> {
    if (!lanchonete.notifWhatsapp || !this.whatsapp.configured) {
      return;
    }
    await this.whatsapp.enviarNovoPedido(lanchonete, {
      numero: pedido.numero,
      total: Number(pedido.total),
      tipoEntrega: pedido.tipoEntrega,
      formaPagamento: pedido.formaPagamento,
    });
  }

  private async ensureCliente(
    user: AuthenticatedUser,
    telefone?: string | null,
  ): Promise<void> {
    await this.prisma.cliente.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        nome: user.name,
        email: user.email,
        telefone: telefone ?? null,
      },
      update: {
        nome: user.name ?? undefined,
        email: user.email ?? undefined,
        telefone: telefone ?? undefined,
      },
    });
  }

  private obrigatoria(value: unknown, campo: string, max: number): string {
    if (
      typeof value !== 'string' ||
      value.trim().length === 0 ||
      value.trim().length > max
    ) {
      throw new BadRequestException(`Campo "${campo}" inválido.`);
    }
    return value.trim();
  }

  private validaTelefone(value: unknown): string | null {
    if (value == null || String(value).trim().length === 0) {
      return null;
    }
    const digitos = String(value).replace(/\D/g, '');
    if (!/^\d{10,13}$/.test(digitos)) {
      throw new BadRequestException(
        'Informe um WhatsApp válido com DDD (ex.: 11999999999).',
      );
    }
    return digitos;
  }

  private validaFormaPagamento(value: unknown): 'pix' | 'cartao' | 'dinheiro' {
    if (value == null) return 'pix';
    const forma = String(value).toLowerCase();
    if (forma !== 'pix' && forma !== 'cartao' && forma !== 'dinheiro') {
      throw new BadRequestException('Forma de pagamento inválida.');
    }
    return forma;
  }

  private validaTipoEntrega(
    value: unknown,
  ): 'entrega' | 'retirar' | 'consumir' {
    if (value == null) return 'entrega';
    const tipo = String(value).toLowerCase();
    if (tipo !== 'entrega' && tipo !== 'retirar' && tipo !== 'consumir') {
      throw new BadRequestException('Tipo de pedido inválido.');
    }
    return tipo;
  }

  private opcional(value: unknown, max: number): string | null {
    if (value == null) return null;
    const texto = String(value).trim();
    return texto.length === 0 || texto.length > max ? null : texto;
  }
}

function gruposFlat(
  produto: {
    grupos: {
      grupo: {
        opcoes: {
          id: string;
          nome: string;
          precoAdicional: unknown;
          remove: boolean;
        }[];
      };
    }[];
  },
  escolhas: OpcaoPedidoInput[],
) {
  const mapa = new Map<
    string,
    { id: string; nome: string; precoAdicional: unknown; remove: boolean }
  >();
  for (const g of produto.grupos)
    for (const o of g.grupo.opcoes) mapa.set(o.id, o);
  return escolhas
    .map((c) => mapa.get(c.opcaoId))
    .filter((o): o is NonNullable<typeof o> => o != null);
}
