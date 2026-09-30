/**
 * Preço cobrado por um produto.
 *
 * A lanchonete pode cadastrar um preço promocional (`precoPromo`), que é sempre
 * menor que o preço normal — o back recusa gravar promoção maior/igual. Mas
 * como o dado é editável direto no banco e uma loja antiga pode ter ficado com
 * uma promoção inconsistente, a escolha do preço é defensiva: só usa a promoção
 * quando ela for realmente menor que o preço normal. Assim um dado sujo nunca
 * faz o cliente pagar mais caro do que o preço anunciado.
 *
 * Os adicionais das opções são somados à parte, em `montaPrecoUnit`.
 */
export function precoDoProduto(produto: {
  preco: unknown;
  precoPromo?: unknown;
}): number {
  const base = Number(produto.preco);
  const promo = produto.precoPromo == null ? null : Number(produto.precoPromo);
  if (promo === null || !Number.isFinite(promo) || promo < 0 || promo >= base) {
    return base;
  }
  return promo;
}

/**
 * Preço unitário final: preço do produto (promocional quando houver) mais os
 * acréscimos das opções. Opções de "remover" não acrescentam nada. Arredonda
 * para centavos, que é como o valor vai para o snapshot em `pedido_itens`.
 */
export function montaPrecoUnit(
  produto: { preco: unknown; precoPromo?: unknown },
  opcoes: ReadonlyArray<{ precoAdicional?: unknown; remove?: boolean }>,
): number {
  const extra = opcoes
    .filter((o) => !o.remove)
    .reduce((acc, o) => acc + Number(o.precoAdicional ?? 0), 0);
  return Math.round((precoDoProduto(produto) + extra) * 100) / 100;
}
