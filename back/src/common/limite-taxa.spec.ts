import { describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { BALDE_IP, BALDE_USUARIO, criarTracker, usuarioDoToken } from './limite-taxa.js';

const SEGREDO = 'segredo-de-teste-bem-comprido-para-hs256-ok';
const appKey = new TextEncoder().encode(SEGREDO);

async function token(sub: string, segredo = SEGREDO) {
  return new SignJWT({ sub })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('cardapio-online')
    .setAudience('cardapio-online')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(segredo));
}

function req(authorization?: string, ip = '203.0.113.7') {
  return {
    headers: authorization ? { authorization } : {},
    ip,
    socket: { remoteAddress: ip },
  } as never;
}

describe('rate limit — chave do balde', () => {
  it('usa o sub do JWT quando o token é válido', async () => {
    const t = await token('usuario-abc');
    expect(await usuarioDoToken(`Bearer ${t}`, appKey)).toBe('usuario-abc');
  });

  it('devolve null para token sem Bearer, vazio ou de assinatura errada', async () => {
    expect(await usuarioDoToken(undefined, appKey)).toBeNull();
    expect(await usuarioDoToken('Bearer', appKey)).toBeNull();
    expect(await usuarioDoToken('Basic xyz', appKey)).toBeNull();
    const falso = await token('ataque', 'outro-segredo-comprido-para-hs256-xx');
    expect(await usuarioDoToken(`Bearer ${falso}`, appKey)).toBeNull();
  });

  it('NÃO aceita token expirado', async () => {
    const vencido = await new SignJWT({ sub: 'velho' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('cardapio-online')
      .setAudience('cardapio-online')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(appKey);
    expect(await usuarioDoToken(`Bearer ${vencido}`, appKey)).toBeNull();
  });

  it('NÃO aceita token de issuer/audience errados', async () => {
    const errado = await new SignJWT({ sub: 'x' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('outro-servidor')
      .setAudience('cardapio-online')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(appKey);
    expect(await usuarioDoToken(`Bearer ${errado}`, appKey)).toBeNull();
  });

  it('token forjado não cria balde novo: cai no balde de IP', async () => {
    // É o que impede um atacante de escapar do limite inventando um `sub` por
    // requisição — o pior jeito de quebrar um rate limit.
    const tracker = criarTracker(SEGREDO);
    const forjado = 'a.b.c';
    expect(await tracker(req(`Bearer ${forjado}`))).toBe(`${BALDE_IP}:203.0.113.7`);
  });

  it('dois usuários no mesmo IP recebem baldes separados', async () => {
    // O cenário do CGNAT: 80 pessoas atrás de um único IPv4 público.
    const tracker = criarTracker(SEGREDO);
    const a = await tracker(req(`Bearer ${await token('ana')}`, '198.51.100.9'));
    const b = await tracker(req(`Bearer ${await token('bruno')}`, '198.51.100.9'));
    expect(a).toBe(`${BALDE_USUARIO}:ana`);
    expect(b).toBe(`${BALDE_USUARIO}:bruno`);
    expect(a).not.toBe(b);
  });

  it('visitantes anônimos continuam shareando o balde do IP', async () => {
    const tracker = criarTracker(SEGREDO);
    const um = await tracker(req(undefined, '198.51.100.9'));
    const dois = await tracker(req(undefined, '198.51.100.9'));
    const outroIp = await tracker(req(undefined, '198.51.100.10'));
    expect(um).toBe(dois);
    expect(um).not.toBe(outroIp);
  });

  it('sem APP_JWT_SECRET configurado, tudo cai no balde de IP (não quebra)', async () => {
    const tracker = criarTracker('');
    expect(await tracker(req(`Bearer ${await token('ana')}`))).toBe(
      `${BALDE_IP}:203.0.113.7`,
    );
  });
});