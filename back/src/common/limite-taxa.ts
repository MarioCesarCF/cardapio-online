import { jwtVerify } from 'jose';

const APP_ISSUER = 'cardapio-online';

/** Prefixos dos baldes: deixa explícito qual eixo está sendo contado. */
export const BALDE_USUARIO = 'u';
export const BALDE_IP = 'ip';

/**
 * Devolve o `sub` do JWT da aplicação **verificado**, ou `null`.
 *
 * A assinatura é conferida de verdade (HS256, mesmo segredo e mesmos
 * issuer/audience do `/auth/exchange`). Isso é o que torna seguro usar o `sub`
 * como chave do rate limit: um token forjado ou adulterado **não** gera um balde
 * novo — cai no balde de IP, igual viria sem essa função. Não há consulta ao
 * banco: o JWT da aplicação é autossuficiente, então o custo por requisição é o
 * de uma verificação HMAC.
 */
export async function usuarioDoToken(
  authorization: string | undefined,
  appKey: Uint8Array,
): Promise<string | null> {
  if (!authorization || !appKey.length) return null;
  const [, token] = authorization.split(' ');
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, appKey, {
      algorithms: ['HS256'],
      issuer: APP_ISSUER,
      audience: APP_ISSUER,
    });
    return typeof payload.sub === 'string' && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Chave do rate limit.
 *
 * Por que não só por IP: no Brasil boa parte dos acessos móveis 4G sai por
 * **CGNAT**, ou seja, centenas de assinantes compartilham um único IPv4
 * público. Com a chave por IP, um grupo de ~34 pessoas behind o mesmo NAT já
 * estoura o limite global de 100/min (o front consulta `GET /me/pedidos` a cada
 * 20s, 3 req/min por usuário) — e **todas** recebem 429 ao mesmo tempo, no
 * meio do pico de pedidos. O sintoma é intermitente e depende da operadora,
 * então é exatamente o tipo de bug que só aparece em produção.
 *
 * Aqui quem está autenticado tem balde próprio; o público continua por IP. Isso
 * também endurece o limite: derrubar um grupo inteiro de usuários na mesma rede
 * deixa de ser trivial com um for-loop.
 */
export function criarTracker(appSecret: string) {
  const appKey = new TextEncoder().encode(appSecret ?? '');
  // `Record<string, any>` é a assinatura que o `ThrottlerGetTrackerFunction`
  // espera — o guard entrega o request cru, já dentro de um ExecutionContext.
  return async (req: Record<string, any>): Promise<string> => {
    const sub = await usuarioDoToken(req.headers?.authorization, appKey);
    if (sub) return `${BALDE_USUARIO}:${sub}`;
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'desconhecido';
    return `${BALDE_IP}:${ip}`;
  };
}