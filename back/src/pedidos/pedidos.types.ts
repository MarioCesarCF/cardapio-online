import type { Prisma } from '@prisma/client';

export interface PedidoItemPainel {
  id: string;
  nome: string;
  precoUnit: number;
  qtd: number;
  opcoes: {
    id: string;
    nome: string;
    precoAdicional: number;
    remove: boolean;
  }[];
}

export interface PedidoPainel {
  id: string;
  numero: number;
  status: string;
  tipoEntrega: string;
  justificativaCancelamento: string | null;
  subtotal: number;
  taxaEntrega: number;
  total: number;
  formaPagamento: string;
  enderecoEntrega: unknown;
  observacao: string | null;
  pagamentoInfo: string | null;
  arquivado: boolean;
  createdAt: string;
  lanchonete: { id: string; nome: string; slug: string };
  cliente: { id: string; nome: string | null; telefone: string | null } | null;
  itens: PedidoItemPainel[];
}

type PedidoComSnapshots = Prisma.PedidoGetPayload<{
  include: { itens: { include: { opcoes: true } } };
}> & {
  lanchonete?: { id: string; nome: string; slug: string };
  cliente?: { id: string; nome: string | null; telefone: string | null } | null;
};

export function formataPedido(p: PedidoComSnapshots): PedidoPainel {
  return {
    id: p.id,
    numero: p.numero,
    status: p.status,
    tipoEntrega: p.tipoEntrega,
    justificativaCancelamento: p.justificativaCancelamento ?? null,
    subtotal: Number(p.subtotal),
    taxaEntrega: Number(p.taxaEntrega),
    total: Number(p.total),
    formaPagamento: p.formaPagamento,
    enderecoEntrega: p.enderecoEntrega,
    observacao: p.observacao,
    pagamentoInfo: p.pagamentoInfo ?? null,
    arquivado: p.arquivado,
    createdAt: p.createdAt.toISOString(),
    lanchonete: p.lanchonete ?? { id: '', nome: '', slug: '' },
    cliente: p.cliente ?? null,
    itens: p.itens.map((item) => ({
      id: item.id,
      nome: item.nomeSnapshot,
      precoUnit: Number(item.precoUnit),
      qtd: item.qtd,
      opcoes: item.opcoes.map((op) => ({
        id: op.id,
        nome: op.nomeSnapshot,
        precoAdicional: Number(op.precoAdicional),
        remove: op.remove,
      })),
    })),
  };
}
