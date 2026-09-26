/**
 * Formatação monetária em pt-BR: vírgula como separador decimal (o banco guarda ponto).
 * Use `formatarMoeda` quando não houver o `CurrencyPipe` (ex.: template inline antigo)
 * e `formatarValor` quando o símbolo "R$" já está no texto (ex.: "+R$ 1,50").
 */

export function formatarMoeda(valor: number | null | undefined): string {
  return Number(valor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarValor(valor: number | null | undefined): string {
  return Number(valor ?? 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
