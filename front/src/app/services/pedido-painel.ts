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
  tipoEntrega: string;
  justificativaCancelamento: string | null;
  subtotal: number;
  taxaEntrega: number;
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
  pagamentoInfo: string | null;
  arquivado: boolean;
  createdAt: string;
  lanchonete: { id: string; nome: string; slug: string };
  cliente: { id: string; nome: string | null; telefone: string | null } | null;
  itens: PedidoItemPainel[];
}

export const PEDIDO_STATUSES = [
  'recebido',
  'em_preparo',
  'enviado',
  'entregue',
  'finalizado',
  'cancelado',
] as const;

export type PedidoStatus = (typeof PEDIDO_STATUSES)[number];

export const PEDIDO_STATUS_LABELS: Record<PedidoStatus, string> = {
  recebido: 'Recebido',
  em_preparo: 'Em preparo',
  enviado: 'Enviado',
  entregue: 'Entregue',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

export const PEDIDO_STATUS_SEVERIDADE: Record<PedidoStatus, string> = {
  recebido: 'info',
  em_preparo: 'warn',
  enviado: 'contrast',
  entregue: 'success',
  finalizado: 'success',
  cancelado: 'danger',
};

const FLUXO: readonly PedidoStatus[] = [
  'recebido',
  'em_preparo',
  'enviado',
  'entregue',
  'finalizado',
];

export const STATUS_CANCELAVEIS = new Set<PedidoStatus>(['recebido', 'em_preparo']);

// Status em que o cliente ainda pode/devem pagar via PIX (antes de entregue).
export const STATUS_COM_PIX = new Set<PedidoStatus>(['recebido', 'em_preparo', 'enviado']);

export function labelStatus(status: string): string {
  return PEDIDO_STATUS_LABELS[status as PedidoStatus] ?? status;
}

export function proximoStatus(status: string): PedidoStatus | null {
  const i = (FLUXO as readonly string[]).indexOf(status);
  return i >= 0 && i < FLUXO.length - 1 ? FLUXO[i + 1] : null;
}

export function podeCancelar(status: string): boolean {
  return STATUS_CANCELAVEIS.has(status as PedidoStatus);
}

const TIPO_ENTREGA_LABELS: Record<string, string> = {
  entrega: 'Entrega (Delivery)',
  retirar: 'Retirar no local',
  consumir: 'Consumir no local',
};

const TIPO_ENTREGA_LABELS_CURTO: Record<string, string> = {
  entrega: 'Entrega',
  retirar: 'Retirar',
  consumir: 'No local',
};

export function tipoEntregaLabel(tipo: string): string {
  return TIPO_ENTREGA_LABELS[tipo] ?? tipo;
}

export function tipoEntregaCurto(tipo: string): string {
  return TIPO_ENTREGA_LABELS_CURTO[tipo] ?? tipo;
}
