/**
 * Versão vigente do aceite. **Manter em sincronia** com
 * `front/src/app/services/termos.ts` (que traz também a data em texto).
 *
 * O Peditto ainda não está em produção, então o texto é revisado dentro da
 * mesma versão 1.0 (decisão de 2026-09-27): assim ninguém precisa aceitar de
 * novo o que é só ajuste de redação. Só suba a versão na virada para produção.
 *
 * Ao subir a versão, toda conta existente vê a tela de aceite no próximo login
 * (o `termoAceite` anterior continua gravado com a data original).
 */
export const TERMO_VERSAO_ATUAL = '1.0';
