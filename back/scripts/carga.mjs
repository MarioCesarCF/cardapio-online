/**
 * Teste de carga da API (Peditto).
 *
 *   node --env-file=.env scripts/carga.mjs --fase leitura --conexoes 500
 *
 * Fases:
 *   leitura    GET /l/<slug>/cardapio em modo fechado (N conexões) — é o caminho
 *              que 1000 clientes simultâneos usam de verdade.
 *   varredura  a mesma rota em rampas (25 → 1000 conexões) para achar onde o p99
 *              sai do controle.
 *   checkout   POST /l/<slug>/pedidos com token de cliente. Cria pedidos REAIS no
 *              banco — por isso exige --pode-criar-pedidos.
 *
 * Antes de rodar local: THROTTLE_DISABLED=true node dist/main (o rate limit
 * global rejeitaria o próprio gerador com 429).
 */
import autocannon from 'autocannon';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const RAMPAS = [25, 50, 100, 200, 400, 800, 1000];

function args(argv) {
  const out = {
    url: 'http://localhost:3000',
    slug: '',
    fase: 'leitura',
    conexoes: 200,
    duracao: 20,
    taxa: 0,
    timeout: 15,
    email: '',
    senha: '',
    saida: '',
    pool: true,
    podeCriarPedidos: false,
  };
  // O PowerShell engole os "--" quando o comando passa por `npm run`. Por isso as
  // bandeiras valem com ou sem eles, e o que sobrar solto entra na ordem abaixo.
  const ordemSolta = ['fase', 'slug', 'conexoes', 'duracao', 'taxa', 'email', 'senha'];
  const definidos = new Set();
  let solta = 0;

  for (let i = 0; i < argv.length; i++) {
    const chave = String(argv[i]).replace(/^-+/, '');
    if (chave === 'sem-pool') {
      out.pool = false;
    } else if (chave === 'pode-criar-pedidos') {
      out.podeCriarPedidos = true;
    } else if (chave in out && !definidos.has(chave)) {
      out[chave] = argv[++i];
      definidos.add(chave);
    } else {
      while (solta < ordemSolta.length && definidos.has(ordemSolta[solta])) solta++;
      if (solta >= ordemSolta.length) continue;
      out[ordemSolta[solta]] = argv[i];
      definidos.add(ordemSolta[solta]);
      solta++;
    }
  }
  out.conexoes = Number(out.conexoes);
  out.duracao = Number(out.duracao);
  out.taxa = Number(out.taxa);
  out.timeout = Number(out.timeout);
  return out;
}

const o = args(process.argv.slice(2));
const API = o.url.replace(/\/$/, '');

let prisma = null;

function ms(n) {
  return `${n} ms`;
}

function linha(rotulo, valor) {
  console.log(`  ${rotulo.padEnd(22)} ${valor}`);
}

function titulo(texto) {
  console.log(`\n=== ${texto} ===`);
}

/** Amostra o pool de conexões do Postgres enquanto a carga roda. */
async function monitorarPool(prisma, duracaoMs) {
  const amostras = [];
  const consulta = () =>
    prisma
      .$queryRawUnsafe(
        'SELECT state, count(*)::int AS total FROM pg_stat_activity WHERE datname = current_database() GROUP BY state',
      )
      .then((linhas) => {
        const porEstado = {};
        let total = 0;
        for (const l of linhas) {
          porEstado[l.state] = l.total;
          total += l.total;
        }
        amostras.push({ total, porEstado });
      })
      .catch(() => {});

  await consulta();
  const timer = setInterval(consulta, 2000);
  await new Promise((r) => setTimeout(r, duracaoMs));
  clearInterval(timer);
  return amostras;
}

function resumoPool(amostras) {
  if (!amostras.length) return 'nenhuma amostra';
  const max = Math.max(...amostras.map((a) => a.total));
  const ultimo = amostras[amostras.length - 1];
  const estados = Object.entries(ultimo.porEstado)
    .map(([e, n]) => `${e}:${n}`)
    .join(' ');
  return `máx ${max} conexões (última: ${estados})`;
}

/**
 * O pool do Prisma é o suspect nº1 e o `pg_stat_activity` engana: as requisições
 * ficam presas na fila *dentro* do Prisma, então o banco parece ocioso. O sinal
 * real são os erros "Timed out fetching a new connection from the connection
 * pool" gravados pelo ErroLogFilter durante a corrida.
 */
async function errosDePoolDesde(quando) {
  if (!prisma) return null;
  try {
    return await prisma.logSistema.count({
      where: {
        nivel: 'erro',
        mensagem: { contains: 'connection pool' },
        createdAt: { gte: quando },
      },
    });
  } catch {
    return null;
  }
}

// O autocannon 8 devolve `statusCodeStats` como { codigo: { count } } e não tem
// `requests.perSecond` — a taxa vem de `average` (total ÷ segundos).
function contagemPorCodigo(r) {
  const bruto = r.statusCodeStats ?? {};
  const saida = {};
  for (const [codigo, valor] of Object.entries(bruto)) {
    saida[codigo] = typeof valor === 'object' && valor ? valor.count : valor;
  }
  return saida;
}

function requisicoesPorSegundo(r) {
  const segundos = (r.finish - r.start) / 1000;
  return segundos > 0 ? r.requests.total / segundos : r.requests.average ?? 0;
}

function mostraResultado(r) {
  const codigos = contagemPorCodigo(r);
  linha('requisições/s', requisicoesPorSegundo(r).toFixed(1));
  linha('total de requisições', r.requests.total);
  linha('latência p50', ms(r.latency.p50));
  linha('latência p97,5', ms(r.latency.p97_5));
  linha('latência p99', ms(r.latency.p99));
  linha('latência máx', ms(r.latency.max));
  linha('não-2xx', r.non2xx);
  linha('4xx (recusados)', r['4xx'] ?? 0);
  linha('5xx (erro no servidor)', r['5xx'] ?? 0);
  linha('erros', r.errors);
  linha('timeouts', r.timeouts);
  linha('resets (quebra TCP)', r.resets);
  const porCodigo = Object.entries(codigos)
    .map(([c, n]) => `${c}×${n}`)
    .join(' ');
  linha('códigos', porCodigo || '—');
}

/** Aviso honesto: se aparecer 429, o resultado mede o rate limit, não o servidor. */
function julga(r) {
  const codigos = contagemPorCodigo(r);
  const bloqueados = codigos['429'] ?? 0;
  const erroServidor = r['5xx'] ?? 0;
  if (bloqueados > 0) {
    console.log(
      `  !! ${bloqueados} respostas 429 — o rate limit entrou no meio. Estes números medem o throttle, não a capacidade.`,
    );
  }
  if (erroServidor > 0) {
    console.log(`  !! ${erroServidor} respostas 5xx — erro de verdade no servidor.`);
  }
  if (r.timeouts > 0) {
    console.log(`  !! ${r.timeouts} timeouts — a fila está estourando o timeout.`);
  }
  if (!bloqueados && !erroServidor && !r.timeouts) {
    console.log('  ok: sem 429, sem 5xx, sem timeout.');
  }
  if ((r['5xx'] ?? 0) > 0) {
    console.log(
      '  >> 5xx com pool "ocioso" costuma ser fila no pool do Prisma — o script confere no logs_sistema no fim.',
    );
  }
  return { quatroVoceNove: bloqueados, cincoX: erroServidor, timeouts: r.timeouts };
}

/**
 * Login cru no Neon Auth (sem SDK) + troca pelo JWT da aplicação.
 * O `session.token` que vem no corpo é o valor opaco do cookie HttpOnly — é
 * ele que o POST /auth/exchange aceita (mandar o JWT EdDSA dá 401).
 */
async function obterToken(email, senha) {
  const issuer = (process.env.NEON_AUTH_ISSUER ?? '').replace(/\/$/, '');
  if (!issuer) {
    throw new Error(
      'NEON_AUTH_ISSUER não está no .env — rode com --env-file=.env para o script logar.',
    );
  }
  const base = `${issuer}/neondb/auth`;
  // A Neon Auth exige `Origin` na lista de confiança — sem esse header ela
  // responde 403 "Missing or null Origin" (o navegador manda sozinho; fetch cru
  // não manda).
  const origem = process.env.FRONT_URL?.trim() || 'http://localhost:4200';
  const resposta = await fetch(`${base}/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origem },
    body: JSON.stringify({ email, password: senha }),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(
      `login no Neon Auth falhou (${resposta.status}): ${dados.message ?? dados.code ?? 'sem mensagem'}`,
    );
  }
  // O `token` do corpo (32 chars) é o valor opaco que fica em
  // `neon_auth.session.token`. O cookie `__Secure-neon-auth.session_token` é o
  // mesmo valor com o sufixo `.mac` — mandar os dois funciona, mandar o JWT do
  // header `set-auth-jwt` NÃO (dá 401).
  const opaco = typeof dados.token === 'string' ? dados.token.trim() : '';
  if (!opaco) throw new Error('login ok, mas a resposta não trouxe token de sessão');

  const troca = await fetch(`${API}/auth/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: opaco }),
  });
  const jwt = await troca.json().catch(() => ({}));
  if (!troca.ok) {
    throw new Error(
      `/auth/exchange respondeu ${troca.status}: ${jwt.message ?? 'sem mensagem'}`,
    );
  }
  if (!jwt.token) throw new Error('/auth/exchange não devolveu token');
  return jwt.token;
}

/** Monta um pedido válido a partir do cardápio real (grupos obrigatórios respeitados). */
async function montarPedido(token) {
  const config = await (await fetch(`${API}/l/${o.slug}/config`)).json();
  const cardapio = await (await fetch(`${API}/l/${o.slug}/cardapio`)).json();
  const produto = cardapio.categorias?.flatMap((c) => c.produtos ?? [])[0];
  if (!produto) throw new Error('a lanchonete não tem produto ativo — cadastre antes');

  const opcoes = [];
  for (const grupo of produto.grupos ?? []) {
    if (!grupo.obrigatorio && (grupo.minSelecoes ?? 0) === 0) continue;
    const primeira = grupo.opcoes?.[0];
    if (primeira) opcoes.push({ opcaoId: primeira.id });
  }

  const itens = [{ produtoId: produto.id, qtd: 1, opcoes }];
  const corpo = {
    itens,
    tipoEntrega: 'retirar',
    formaPagamento: config.aceitaPix ? 'pix' : 'dinheiro',
  };
  return { corpo, nomeProduto: produto.nome };
}

function opcoesAutocannon(extra) {
  return {
    timeout: o.timeout * 1000,
    ...extra,
  };
}

async function rodarUmaFase({ nome, conexoes, taxa = 0, request }) {
  const poolSamples = o.pool
    ? monitorarPool(prisma, o.duracao * 1000 + 5000)
    : null;
  const resultado = await new Promise((resolve, reject) => {
    const inst = autocannon(
      opcoesAutocannon({
        url: `${API}${request.caminho}`,
        connections: conexoes,
        duration: o.duracao,
        ...(taxa > 0 ? { connectionRate: taxa } : {}),
        method: request.method,
        headers: request.headers ?? {},
        ...(request.body ? { body: request.body } : {}),
        ...(request.setup ? { setupRequest: request.setup } : {}),
      }),
      (err, res) => (err ? reject(err) : resolve(res)),
    );
    inst.on('start', () => {
      console.log(
        `\n[${nome}] ${conexoes} conexões por ${o.duracao}s contra ${request.caminho}`,
      );
    });
  });
  const amostras = poolSamples ? await poolSamples : [];
  return { nome, conexoes, taxa, resultado, amostras };
}

function imprimeFase(dados) {
  titulo(`${dados.nome} — ${dados.conexoes} conexões`);
  mostraResultado(dados.resultado);
  const veredito = julga(dados.resultado);
  if (dados.amostras.length) linha('pool do Postgres', resumoPool(dados.amostras));
  return {
    nome: dados.nome,
    conexoes: dados.conexoes,
    requisicoesPorSegundo: Number(requisicoesPorSegundo(dados.resultado).toFixed(1)),
    latenciaP50: dados.resultado.latency.p50,
    latenciaP99: dados.resultado.latency.p99,
    latenciaMax: dados.resultado.latency.max,
    nao2xx: dados.resultado.non2xx,
    erros: dados.resultado.errors,
    timeouts: dados.resultado.timeouts,
    quatroVoceNove: veredito.quatroVoceNove,
    cincoX: veredito.cincoX,
    poolMax: dados.amostras.length ? Math.max(...dados.amostras.map((a) => a.total)) : null,
  };
}

async function main() {
  if (!o.slug) {
    console.error(
      'Informe --slug (o caminho da lanchonete). Ex.: --slug lanchonete-duarte-burguers',
    );
    process.exit(1);
  }

  console.log(`API:  ${API}`);
  console.log(`Loja: ${o.slug}`);
  console.log(
    `Fase: ${o.fase}  |  conexoes: ${o.conexoes}  |  duracao: ${o.duracao}s  |  taxa: ${o.taxa || 'fechado'}  |  saida: ${o.saida || '(não)'}`,
  );
  if (!Number.isFinite(o.duracao) || o.duracao <= 0) {
    console.error('Duração inválida — informe um número de segundos.');
    process.exit(1);
  }

  const saude = await fetch(`${API}/health`).then(
    (r) => r.json().catch(() => ({})),
    () => null,
  );
  if (saude === null) {
    console.error(`\nNão consegui falar com ${API}/health — o back está no ar?`);
    process.exit(1);
  }
  console.log(`Health: ${JSON.stringify(saude)}`);

  const cardapio = await fetch(`${API}/l/${o.slug}/cardapio`);
  if (!cardapio.ok) {
    console.error(
      `\nGET /l/${o.slug}/cardapio respondeu ${cardapio.status}. A loja está ativa e o slug existe?`,
    );
    process.exit(1);
  }
  const corpoCardapio = await cardapio.text();
  linha('tamanho do cardápio', `${(corpoCardapio.length / 1024).toFixed(1)} kB`);

  if (o.fase === 'checkout' && !o.podeCriarPedidos) {
    console.error(
      '\nA fase checkout grava pedidos REAIS no banco. Rode com --pode-criar-pedidos para confirmar.',
    );
    process.exit(1);
  }

  // `prisma` é o do módulo (rodarUmaFase também precisa dele).
  if (o.pool) {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();
  }
  const inicio = new Date();
  const resultados = [];

  if (o.fase === 'leitura' || o.fase === 'varredura') {
    const rampas = o.fase === 'varredura' ? RAMPAS : [o.conexoes];
    for (const conexoes of rampas) {
      const dados = await rodarUmaFase({
        nome: o.fase,
        conexoes,
        request: { caminho: `/l/${o.slug}/cardapio`, method: 'GET' },
      });
      resultados.push(imprimeFase(dados));
      if (o.fase === 'varredura' && dados.resultado.timeouts > 0) {
        console.log(
          `  (parando a rampa: ${conexoes} conexões já dão timeout, subir mais não informa nada)`,
        );
        break;
      }
    }
  }

  if (o.fase === 'checkout') {
    const token = await obterToken(o.email, o.senha);
    const { corpo, nomeProduto } = await montarPedido(token);
    console.log(`Pedido de teste: "${nomeProduto}", ${corpo.itens[0].qtd} un.`);
    const dados = await rodarUmaFase({
      nome: 'checkout',
      conexoes: o.conexoes,
      taxa: o.taxa,
      request: {
        caminho: `/l/${o.slug}/pedidos`,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(corpo),
      },
    });
    resultados.push(imprimeFase(dados));
  }

  titulo('Resumo');
  console.table(resultados);

  const errosPool = await errosDePoolDesde(inicio);
  if (errosPool !== null) {
    titulo('Diagnóstico');
    linha('erros de pool do Prisma', errosPool);
    if (errosPool > 0) {
      console.log(
        `  >> ${errosPool} requisições estouraram os 10s de espera por conexão do pool.\n` +
          '     A produção está no limite do pool do Prisma, não da CPU.\n' +
          '     Duas saídas, nesta ordem: (1) cache do cardápio por slug,\n' +
          '     (2) subir connection_limit no DATABASE_URL (hoje o Prisma usa 2×CPUs+1).',
      );
    } else {
      console.log('  >> Nenhum timeout de pool: o limite não foi o pool.');
    }
  }

  if (o.saida) {
    const caminho = resolve(o.saida);
    mkdirSync(dirname(caminho), { recursive: true });
    writeFileSync(
      caminho,
      JSON.stringify(
        { quando: new Date().toISOString(), api: API, slug: o.slug, fase: o.fase, resultados },
        null,
        2,
      ),
    );
    console.log(`\nResultado em ${caminho}`);
  }

  if (prisma) await prisma.$disconnect();
}

await main();
