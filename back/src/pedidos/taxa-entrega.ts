// Calculo da taxa de entrega (F8.10). Funcoes puras (sem IO) para
// facilitar o teste -- mesmo padrao de horarios.ts / pix.ts.

/**
 * Taxa de entrega que entra no pedido.
 * So vale para pedidos do tipo 'entrega' quando a lanchonete cobra a taxa.
 * Valor arredondado para 2 casas decimais (mesma regra do subtotal/total).
 */
export function calculaTaxaEntrega(
  tipoEntrega: string,
  cobraTaxaEntrega: boolean,
  taxaEntrega: number,
): number {
  if (tipoEntrega !== 'entrega' || !cobraTaxaEntrega) return 0;
  return Math.round(Number(taxaEntrega || 0) * 100) / 100;
}

/**
 * Total do pedido = subtotal + taxa de entrega, arredondado para 2 casas.
 */
export function calculaTotalPedido(subtotal: number, taxaEntrega: number): number {
  return Math.round((subtotal + taxaEntrega) * 100) / 100;
}
