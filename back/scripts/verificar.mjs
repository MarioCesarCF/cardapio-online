/**
 * `npm run verificar` do back: lint + testes + build, so o resumo.
 *
 * Existe para nao gastar tokens com saida bruta de vitest/oxlint/nest a cada tarefa.
 * Cada passo e executado com a saida **capturada**; o script imprime no maximo uma
 * linha por passo e a ultima linha de erro quando algo falha (com pipe).
 *
 * Exit code != 0 se qualquer passo falhar.
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

/** vitest/oxlint/ng colorem a saida; os codigos ANSI partem qualquer regex. */
function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
}

function ultimaLinhaCom(saida, padrao) {
  const linhas = saida.split(/\r?\n/).filter((l) => padrao.test(l));
  return linhas.length ? linhas[linhas.length - 1].trim() : '';
}

const passos = [];

// 1. lint
{
  const { code, saida } = run('npx', ['oxlint', 'src/', 'test/']);
  const resumo =
    ultimaLinhaCom(saida, /Found \d+ warning/) ||
    ultimaLinhaCom(saida, /^\s*Finished/) ||
    'sem resumo';
  const problemas = /(\d+) errors?/.exec(resumo)?.[1] ?? '0';
  const avisos = /(\d+) warnings?/.exec(resumo)?.[1] ?? '0';
  const ok = code === 0 && problemas === '0';
  passos.push({
    nome: 'lint',
    ok,
    resumo: `${avisos} aviso(s), ${problemas} erro(s)`,
    detalhe: ok ? '' : ultimaLinhaCom(saida, /error|warning/) || resumo,
  });
}

// 2. testes
{
  const { code, saida } = run('npx', ['vitest', 'run']);
  const arquivos = /Test Files\s+(\d+)\s+passed/.exec(saida)?.[1] ?? '?';
  const testes = /Tests\s+(\d+)\s+passed/.exec(saida)?.[1] ?? '?';
  const falhos = /(\d+)\s+failed/.exec(saida)?.[1] ?? '0';
  const ok = code === 0;
  passos.push({
    nome: 'testes',
    ok,
    resumo: `${testes} testes em ${arquivos} arquivo(s)${falhos !== '0' ? `, ${falhos} FALHOU` : ''}`,
    detalhe: ok ? '' : ultimaLinhaCom(saida, /FAIL|AssertionError|→/) || 'ver `npx vitest run` direto',
  });
}

// 3. build
{
  const { code, saida } = run('npm', ['run', 'build']);
  const ok = code === 0;
  passos.push({
    nome: 'build',
    ok,
    resumo: ok ? 'dist/ gerado' : 'falhou',
    detalhe: ok ? '' : ultimaLinhaCom(saida, /error TS|Error|error/) || 'sem linha de erro',
  });
}

console.log('');
for (const p of passos) {
  const marca = p.ok ? COR.ok('OK   ') : COR.falha('FALHA');
  console.log(`  ${marca} ${p.nome.padEnd(7)} ${p.resumo}`);
  if (!p.ok && p.detalhe) console.log(`         ${COR.fraco(p.detalhe)}`);
}
const falhas = passos.filter((p) => !p.ok);
console.log('');
if (falhas.length) {
  console.log(COR.falha(`  ${falhas.length} de ${passos.length} passos falharam.`));
  process.exit(1);
}
console.log(COR.ok('  tudo certo.'));
console.log(COR.cinza('  (commit nao foi feito)'));
process.exit(0);