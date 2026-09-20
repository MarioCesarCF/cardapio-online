export interface PedidoItemPainel {
  id: string;
  nome: string;
  precoUnit: number;
  qtd: number;
  opcoes: { id: string; nome: string; precoAdicional: number; remove: boolean }[];
}

export interface PedidoPainel {
  id: string;
  numero: number;
  status: string;
  subtotal: number;
  total: number;
  formaPagamento: string;
  enderecoEntrega: {
    rua: string;
    numero: string;
    complemento: string | null;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string | null;
  } | null;
  observacao: string | null;
  createdAt: string;
  lanchonete: { id: string; nome: string; slug: string };
  cliente: { id: string; nome: string | null; telefone: string | null } | null;
  itens: PedidoItemPainel[];
}

export const PEDIDO_STATUSES = [
  'recebido',
  'em_preparo',
  'saiu_para_entrega',
  'entregue',
  'cancelado',
] as const;

export type PedidoStatus = (typeof PEDIDO_STATUSES)[number];

export const PEDIDO_STATUS_LABELS: Record<PedidoStatus, string> = {
  recebido: 'Recebido',
  em_preparo: 'Em preparo',
  saiu_para_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

const FLUXO = PEDIDO_STATUSES.slice(0, 4);

export function labelStatus(status: string): string {
  return PEDIDO_STATUS_LABELS[status as PedidoStatus] ?? status;
}

export function proximoStatus(status: string): PedidoStatus | null {
  const i = (FLUXO as readonly string[]).indexOf(status);
  return i >= 0 && i < FLUXO.length - 1 ? FLUXO[i + 1] : null;
}
