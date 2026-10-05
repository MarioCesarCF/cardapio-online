// E2E do caminho de LGPD: questionário de encerramento com PII nos textos
// livres -> redação no banco -> DELETE /me/conta -> anonimização -> expurgo.
//
// Cria uma conta DESCARTÁVEL (e-mail único a cada execução) e apaga tudo no
// final: não toca nas contas de teste do `npm run seed:teste`.
// Rode com o back no ar:  npm run smoke:lgpd
//
// O que este smoke prova (o resto está em *.spec.ts):
//   1. `GET /me` de quem nunca aceitou devolve `termoAceite: null` (a tela de
//      consentimento do front é mostrada por causa disso).
//   2. `POST /me/encerramento` aceita PII no corpo e grava **redigido** — aqui
//      conferido no banco, não só no status HTTP.
//   3. `DELETE /me/conta` desvincula a resposta (vira estatística anônima).
//   4. A linha do smoke é removida no fim (mesmo caminho de
//      `limparPedidosTeste`: Prisma + DATABASE_URL).
import { bruto, login } from './lib.mjs';

const senha = 'Teste1234';
const email = `lgpd.smoke.${Date.now()}@teste.dev`;
const issuer = (process.env.NEON_AUTH_ISSUER ?? '').replace(/\/$/, '');
const MARCA = '[dado removido]';

// PII de propósito nos 3 campos de texto livre + no contato. O protocolo tem 16
// dígitos: é o caso que expunha resto de número na redação.
const corpo = {
  motivoPrincipal: 'nao_uso_mais',
  satisfacao: 2,
  voltaria: 'nao',
  melhorar: 'Melhorem o app. Meu e-mail e ana.silva@example.com e meu telefone (11) 98888-7777',
  paraContinuar: 'Seria bom um cupom. CPF 123.456.789-00',
  experiencia: 'Uso faz 2 anos, protocolo 9988776655443322',
  contatoLiberado: true,
  contato: 'ana.silva@example.com',
};

const novo = await fetch(`${issuer}/neondb/auth/sign-up/email`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: process.env.FRONT_URL ?? 'http://localhost:4200',
  },
  body: JSON.stringify({ email, password: senha, name: 'Fulano de Teste' }),
});
console.log('sign-up ->', novo.status, email);
if (!novo.ok) process.exit(1);

const { token } = await login(email, senha);
const me = await bruto('/me', { token });
console.log('GET /me ->', me.status, 'termoAceite:', JSON.stringify(me.corpo?.termoAceite));

const post = await bruto('/me/encerramento', { method: 'POST', token, body: corpo });
console.log('POST /me/encerramento ->', post.status, JSON.stringify(post.corpo));
const id = post.corpo?.id;
if (post.status !== 201 || !id) {
  console.log('FALHOU: questionnaire nao aceitou o corpo');
  process.exit(1);
}

// --- o que foi PARA O BANCO (redação conferida, não só o HTTP) --------------
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

const gravada = await prisma.respostaEncerramento.findUnique({ where: { id } });
const textoGravado = [gravada?.melhorar, gravada?.paraContinuar, gravada?.experiencia]
  .filter(Boolean)
  .join(' | ');
const vazou = /ana\.silva|123\.456\.789|99887/.test(textoGravado) || !textoGravado.includes(MARCA);
console.log('no banco  ->', JSON.stringify(textoGravado));
console.log(vazou ? 'FALHOU: PII no texto livre ou nada redigido' : 'redacao ok (PII virou "[dado removido]")');

// --- encerramento da conta: a linha tem de virar estatística anônima -------
const del = await bruto('/me/conta', { method: 'DELETE', token });
console.log('DELETE /me/conta ->', del.status, JSON.stringify(del.corpo));

const meDepois = await bruto('/me', { token });
console.log('GET /me depois ->', meDepois.status, '(401 = conta apagada)');

const depois = await prisma.respostaEncerramento.findUnique({ where: { id } });
const anonimizada =
  !!depois &&
  depois.usuarioId === null &&
  depois.lanchoneteId === null &&
  depois.contatoLiberado === false &&
  depois.contato === null &&
  depois.melhorar === null &&
  depois.paraContinuar === null &&
  depois.experiencia === null;
console.log(
  anonimizada
    ? 'anonimizacao ok (vinculo e textos livres zerados)'
    : 'FALHOU: resposta ainda ligada a pessoa',
);

// --- expurgo do proprio smoke ----------------------------------------------
await prisma.respostaEncerramento.deleteMany({ where: { id } });
const restou = await prisma.respostaEncerramento.count({ where: { id } });
console.log('linha do smoke removida ->', restou === 0 ? 'sim' : 'NAO, sobrou');
await prisma.$disconnect();

const ok =
  meDepois.status === 401 &&
  del.ok &&
  !vazou &&
  anonimizada &&
  restou === 0;
console.log(ok ? 'OK: redacao + anonimizacao + limpeza' : 'FALHOU: conferir encerramento');
process.exit(ok ? 0 : 1);