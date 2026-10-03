/**
 * Biblioteca de smoke da API. Reutilizavel por qualquer script em `scripts/`.
 *
 * Existe por causa do "dance" da auth, que ja custou varias rodadas de tentativa e
 * erro: o browser nao consegue o JWT da Neon (o `/get-session` manda o EdDSA so no
 * header `set-auth-jwt`, escondido por CORS). O caminho funcional e:
 *
 *   1. sign-in na Neon Auth, **com header `Origin`** (sem isso a Neon rejeita)
 *   2. pegar `dados.token`, que e o token **opaco** do cookie HttpOnly (nao e JWT)
 *   3. `POST /auth/exchange` no back com `{ token: opaco }` -> devolve o Bearer
 *
 * Uso tipico:
 *   import { login, api, criarPedido, limparPedidosTeste } from './lib.mjs';
 *   const cli = await login('cliente.teste@teste.dev', 'Teste1234');
 *   const cardapio = await api('/l/lanchonete-duarte-burguers/cardapio');   // publico
 *   const eu = await api('/me', { token: cli.token });
 */

const API = process.env.API_URL ?? 'http://localhost:3000';
const ISSUER = process.env.NEON_AUTH_ISSUER ?? '';
const ORIGIN = process.env.FRONT_URL?.trim() || 'http://localhost:4200';

export const CONTAS = {
  cliente: { email: 'cliente.teste@teste.dev', senha: 'Teste1234' },
  duarte: { email: 'lojista.duarte@teste.dev', senha: 'Teste1234' },
  nonna: { email: 'lojista.nonna@teste.dev', senha: 'Teste1234' },
};

function exigeIssuer() {
  if (!ISSUER) {
    throw new Error(
      'NEON_AUTH_ISSUER ausente. Rode com --env-file=.env ou exporte a variavel.',
    );
  }
}

/** Chamada crua na API. Devolve `{ status, corpo }` e nunca lanca em erro HTTP. */
export async function bruto(caminho, { method = 'GET', body, token, headers = {} } = {}) {
  const h = { ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  const r = await fetch(`${API}${caminho}`, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const texto = await r.text();
  let corpo;
  try {
    corpo = texto ? JSON.parse(texto) : null;
  } catch {
    corpo = texto;
  }
  return { status: r.status, corpo, ok: r.ok };
}

/** Igual `bruto`, mas lanca se a resposta nao for 2xx. Use para o caminho feliz. */
export async function api(caminho, opts = {}) {
  const r = await bruto(caminho, opts);
  if (!r.ok) {
    throw new Error(`${opts.method ?? 'GET'} ${caminho} -> ${r.status}: ${JSON.stringify(r.corpo)}`);
  }
  return r.corpo;
}

/**
 * Login completo (Neon Auth -> /auth/exchange). Devolve `{ email, token }`.
 * `token` ja e o Bearer HS256 pronto para `api()`.
 */
export async function login(email, senha) {
  exigeIssuer();
  const r = await fetch(`${ISSUER}/neondb/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email, password: senha }),
  });
  const dados = await r.json();
  if (!dados?.token) {
    throw new Error(
      `sign-in falhou (${r.status}): ${JSON.stringify(dados)} — o Origin precisa ser FRONT_URL`,
    );
  }
  const trocado = await bruto('/auth/exchange', { method: 'POST', body: { token: dados.token } });
  if (!trocado.ok) {
    throw new Error(`/auth/exchange -> ${trocado.status}: ${JSON.stringify(trocado.corpo)}`);
  }
  return { email, token: trocado.corpo.token };
}

/** Login por papel, usando as contas do `seed:teste`. */
export async function loginComo(papel) {
  const c = CONTAS[papel];
  if (!c) throw new Error(`papel desconhecido: ${papel} (use ${Object.keys(CONTAS).join('|')})`);
  return login(c.email, c.senha);
}

/** Cria um pedido REAL. Use apenas com consentimento explicito. */
export async function criarPedido({ token, slug, tipo = 'entrega', itens, endereco, pagamento = 'pix' }) {
  return api(`/l/${slug}/pedidos`, {
    method: 'POST',
    token,
    body: { tipo, itens, endereco, pagamento },
  });
}

/** Le o cardapio publico de uma loja. */
export async function cardapio(slug) {
  return api(`/l/${slug}/cardapio`);
}

/** Health do back. */
export async function health() {
  return bruto('/health');
}

/**
 * Apaga os pedidos de uma conta de teste e reporta antes/depois.
 * Requer DATABASE_URL (Prisma). Filtra **por clienteId**, nunca por faixa de numero.
 * Nao imprime PII: so numero, status e data.
 */
export async function limparPedidosTeste(email = CONTAS.cliente.email, { confirmar } = {}) {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const users = await prisma.$queryRawUnsafe(
      `SELECT id FROM neon_auth."user" WHERE LOWER(email) = LOWER($1)`,
      email,
    );
    if (!users.length) return { removidos: 0, motivo: 'conta de teste nao encontrada' };
    const clienteId = users[0].id;
    const alvos = await prisma.pedido.findMany({
      where: { clienteId },
      select: { id: true, numero: true, status: true, createdAt: true },
    });
    if (!alvos.length) return { removidos: 0, motivo: 'nenhum pedido do cliente de teste' };
    if (!confirmar) {
      return {
        removidos: 0,
        pedido: alvos.length,
        numeros: alvos.map((p) => p.numero).sort((a, b) => a - b),
        motivo: 'passar { confirmar: true } para apagar de verdade',
      };
    }
    const r = await prisma.pedido.deleteMany({
      where: { id: { in: alvos.map((p) => p.id) } },
    });
    const restam = await prisma.pedido.count({ where: { clienteId } });
    const orfaos = await prisma.pedidoItem.count({
      where: { pedidoId: { in: alvos.map((p) => p.id) } },
    });
    return { removidos: r.count, restantes: restam, orfaos, motivo: 'apagado' };
  } finally {
    await prisma.$disconnect();
  }
}

export { API, ISSUER, ORIGIN };