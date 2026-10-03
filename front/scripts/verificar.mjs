/**
 * `npm run verificar` do front: `tsc --noEmit` + build + leitura do budget de estilo.
 *
 * Mesma ideia do back: saida capturada, no maximo uma linha por passo. O build do
 * Angular e lento (~1min), entao este script existe para nao repetir rodadas.
 *
 * Exit code != 0 se o typecheck, o build ou o budget falhar.
 */
import { spawnSync } from 'node:child_process';

const COR = {
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  falha: (s) => `\x1b[31m${s}\x1b[0m`,
  fraco: (s) => `\x1b[33m${s}\x1b[0m`,
  cinza: (s) => `\x1b[90m${s}\x1b[0m`,
};

function run(comando, args) {
  const r = spawnSync(comando, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === 'win32',
  });
  return { code: r.status ?? 1, saida: stripAnsi(`${r.stdout ?? ''}${r.stderr ?? ''}`) };
}

/** ng/tsc colorem a saida; os codigos ANSI partem qualquer regex. */
function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
}

function ultimaCom(saida, padrao) {
  const linhas = saida.split(/\r?\n/).filter((l) => padrao.test(l));
  return linhas.length ? linhas[linhas.length - 1].trim() : '';
}

const passos = [];

// 1. typecheck (config de app: nao inclui specs de teste)
{
  const { code, saida } = run('npx', ['tsc', '-p', 'tsconfig.app.json', '--noEmit']);
  const erros = [...saida.matchAll(/error TS\d+/g)].length;
  passos.push({
    nome: 'tsc',
    ok: code === 0,
    resumo: code === 0 ? 'sem erro de tipo' : `${erros} erro(s) de tipo`,
    detalhe: code === 0 ? '' : ultimaCom(saida, /error TS\d+/) || 'sem linha de erro',
  });
}

// 2. build (o budget anyComponentStyle vive em angular.json e falha aqui)
{
  const { code, saida } = run('npx', ['ng', 'build']);
  // O Angular distingue WARNING de ERROR: so ERROR derruba o build. `verificar`
  // espelha essa semantica — warning eBarulho de sinal, nao motivo de falha.
  const estourados = [...saida.matchAll(/exceeded maximum (error )?budget[^\n]*/gi)].map((m) => m[0].trim());
  const graves = estourados.filter((l) => /maximum error budget|\[ERROR\]/i.test(l));
  const avisos = estourados.filter((l) => !graves.includes(l));
  const bundles = [...saida.matchAll(/Initial total[^|\n]*?\|\s*([\d.]+\s*kB)/g)].map((m) => m[1].trim());
  const ok = code === 0 && graves.length === 0;
  const resumoBase = ok
    ? `ok${bundles.length ? `, initial ${bundles[0]}` : ''}`
    : code !== 0
      ? 'falhou'
      : `${graves.length} budget(s) em ERRO`;
  passos.push({
    nome: 'build',
    ok,
    resumo: avisos.length ? `${resumoBase} (+${avisos.length} aviso)` : resumoBase,
    detalhe: [...graves, ...avisos].slice(0, 3).join(' | ') || '',
    suave: avisos.length > 0 && graves.length === 0,
  });
}

console.log('');
for (const p of passos) {
  const marca = p.ok
    ? p.suave
      ? COR.fraco('AVISO')
      : COR.ok('OK   ')
    : COR.falha('FALHA');
  console.log(`  ${marca} ${p.nome.padEnd(6)} ${p.resumo}`);
  if (p.detalhe) console.log(`         ${p.suave ? COR.cinza(p.detalhe) : COR.fraco(p.detalhe)}`);
}

const falhas = passos.filter((p) => !p.ok);
console.log('');
if (falhas.length) {
  console.log(COR.falha(`  ${falhas.length} de ${passos.length} passos falharam.`));
  process.exit(1);
}
console.log(COR.ok('  tudo certo.'));
console.log(
  COR.cinza('  responsivo NAO e verificado aqui: rodar o smoke de UI em 375/768/1280'),
);
process.exit(0);