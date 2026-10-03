import { login, loginComo, api, cardapio, health, bruto } from './lib.mjs';

const h = await health();
console.log(`health            ${h.status} ${JSON.stringify(h.corpo)}`);

const cli = await login('cliente.teste@teste.dev', 'Teste1234');
const duarte = await loginComo('duarte');
console.log(`login             ok (Bearer de ${cli.token.length} chars)`);

const card = await cardapio('lanchonete-duarte-burguers');
console.log(`cardapio publico  ${card.categorias?.length ?? '?'} categoria(s)`);

const eu = await api('/me', { token: cli.token });
console.log(`/me               chaves: ${Object.keys(eu).join(', ')}`);

// Autorizacao: o cliente tem que ver lista vazia e NAO abrir a loja do duarte.
const listaCli = await bruto('/admin/lanchonetes', { token: cli.token });
const lojaCli = await bruto('/admin/lanchonetes/lanchonete-duarte-burguers', { token: cli.token });
const lojaDuarte = await bruto('/admin/lanchonetes/lanchonete-duarte-burguers', { token: duarte.token });

console.log(`/admin/lanchonetes (cliente)      -> ${listaCli.status} ${JSON.stringify(listaCli.corpo)}`);
console.log(`/admin/.../duarte (cliente)       -> ${lojaCli.status} ${JSON.stringify(lojaCli.corpo).slice(0, 90)}`);
console.log(`/admin/.../duarte (dono)          -> ${lojaDuarte.status} ${lojaDuarte.ok ? '(acesso normal)' : ''}`);

const semAuth = await bruto('/me');
console.log(`/me sem token                      -> ${semAuth.status}`);

const checks = [
  ['cliente ve lista vazia', listaCli.ok && Array.isArray(listaCli.corpo) && listaCli.corpo.length === 0],
  ['cliente NAO abre loja do duarte', [401, 403, 404].includes(lojaCli.status)],
  ['dono abre a propria loja', lojaDuarte.ok],
  ['/me sem token = 401', semAuth.status === 401],
];

console.log('');
let falhou = false;
for (const [nome, ok] of checks) {
  console.log(`  ${ok ? 'OK   ' : 'FALHA'} ${nome}`);
  if (!ok) falhou = true;
}
console.log(falhou ? '\nFALHOU' : '\nOK — lib funcionando');
process.exit(falhou ? 1 : 0);