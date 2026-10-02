// Seed da galeria de imagens (M5) — versão sem armazenamento próprio.
// Grava direto a URL do Pexels em `galeria_imagens.url` (sem baixar, sem R2).
// Quando o Cloudflare R2 for ativado, basta o seed gravar a URL do R2 nesse campo.
//
// Uso (a partir de back/):
//   npm run seed:galeria                 # todas as categorias
//   npm run seed:galeria -- refrigerantes # só uma categoria (slug)
// Exige em .env: PEXELS_API_KEY + DATABASE_URL.
//
// Idempotente: pula foto cuja URL já está na tabela. A mesma foto nunca entra
// duas vezes (nem no mesmo run, nem entre categorias).
//
// `keywords` serve à busca da galeria no painel (match exato de token em
// minúsculas) e é o que o cardápio automático usa para escolher a imagem de
// cada produto — ver `CHAVES_IMAGEM_GALERIA` em `src/admin/cardapio-modelo.ts`.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORIAS = [
  {
    slug: 'hamburguer',
    keywords: ['hamburguer', 'burger', 'lanche'],
    buscas: [
      { query: 'hamburger', qtd: 4 },
      { query: 'cheeseburger', qtd: 2 },
    ],
  },
  {
    slug: 'batata',
    keywords: ['batata', 'frita', 'porcao', 'porcoes', 'fries'],
    buscas: [
      { query: 'french fries potato', qtd: 4 },
      { query: 'potato wedges', qtd: 2 },
      { query: 'sweet potato fries', qtd: 1, keywords: ['batata-doce', 'doce'] },
    ],
  },
  {
    slug: 'hot-dog',
    keywords: ['hot dog', 'cachorro-quente', 'lanche'],
    buscas: [{ query: 'hot dog', qtd: 3 }],
  },
  {
    slug: 'calabresa',
    keywords: ['calabresa', 'sausage', 'embutido'],
    buscas: [{ query: 'grilled sliced sausage', qtd: 2 }],
  },
  {
    slug: 'pizza',
    keywords: ['pizza', 'pizzas', 'queijo'],
    buscas: [
      { query: 'pizza', qtd: 4 },
      { query: 'margherita pizza slice', qtd: 2 },
      { query: 'dessert pizza fruit', qtd: 2, keywords: ['pizza-doce', 'doce'] },
    ],
  },
  {
    slug: 'sucos',
    keywords: ['suco', 'sucos', 'juice', 'natural'],
    buscas: [
      { query: 'fresh juice glass', qtd: 2 },
      { query: 'orange juice glass', qtd: 2, keywords: ['laranja'] },
      { query: 'passion fruit juice', qtd: 1, keywords: ['maracuja'] },
    ],
  },
  {
    slug: 'sorvetes',
    keywords: ['sorvete', 'sorvetes', 'ice cream', 'sobremesa'],
    buscas: [
      { query: 'ice cream scoops', qtd: 3 },
      { query: 'pudding dessert', qtd: 1, keywords: ['pudim'] },
      { query: 'mousse dessert cup', qtd: 1, keywords: ['mousse'] },
    ],
  },
  {
    slug: 'acai',
    keywords: ['acai', 'açaí', 'bowl'],
    buscas: [
      { query: 'acai bowl', qtd: 3 },
      { query: 'acai cup', qtd: 2, keywords: ['creme'] },
    ],
  },
  {
    slug: 'frutas',
    keywords: ['fruta', 'frutas'],
    buscas: [
      { query: 'banana', qtd: 1, keywords: ['banana'] },
      { query: 'strawberry', qtd: 1, keywords: ['morango'] },
      { query: 'mango slices', qtd: 1, keywords: ['manga'] },
      { query: 'kiwi slices', qtd: 1, keywords: ['kiwi'] },
      { query: 'green grapes', qtd: 1, keywords: ['uva'] },
    ],
  },
  {
    slug: 'refrigerantes',
    keywords: ['refrigerante', 'refri', 'soda', 'bebida', 'cola', 'guarana'],
    buscas: [
      {
        query: 'soda can',
        qtd: 3,
        keywords: ['lata', 'lata-refrigerante', 'refrigerante'],
      },
      {
        query: 'cola bottle plastic',
        qtd: 3,
        keywords: ['garrafa', 'garrafa-refrigerante', 'refrigerante'],
      },
      { query: 'water bottle', qtd: 2, keywords: ['agua', 'agua mineral'] },
    ],
  },
  {
    slug: 'cerveja',
    keywords: ['cerveja', 'cervejas', 'beer'],
    buscas: [
      { query: 'beer can', qtd: 2, keywords: ['lata', 'lata-cerveja'] },
      { query: 'can of beer isolated', qtd: 2, keywords: ['lata', 'lata-cerveja'] },
      { query: 'craft beer can', qtd: 2, keywords: ['lata', 'lata-cerveja'] },
      { query: 'beer bottle long neck', qtd: 2, keywords: ['garrafa-cerveja', 'long neck'] },
      {
        query: 'beer bottle on table',
        qtd: 2,
        keywords: ['garrafa-cerveja', 'long neck'],
      },
    ],
  },
  {
    slug: 'combo',
    keywords: ['combo', 'combos'],
    buscas: [{ query: 'fast food combo meal', qtd: 2 }],
  },
];

const filtro = (process.argv[2] ?? '').trim();
if (filtro && !CATEGORIAS.some((c) => c.slug === filtro)) {
  console.error(`Categoria desconhecida: "${filtro}".`);
  console.error(`Use um destes slugs: ${CATEGORIAS.map((c) => c.slug).join(', ')}`);
  process.exit(1);
}

async function pexelsSearch(query, perPage) {
  const apiKey = process.env.PEXELS_API_KEY?.trim();
  if (!apiKey) throw new Error('Faltando env PEXELS_API_KEY');

  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`,
    {
      headers: { Authorization: apiKey, 'User-Agent': 'cardapio-online-seed/1.0' },
    },
  );
  if (!res.ok) throw new Error(`Pexels ${res.status}: ${await res.text()}`);
  const body = await res.json();
  return body.photos ?? [];
}

const jaInseridas = new Set();

async function seed() {
  console.log('Consultando o Pexels e gravando as URLs na galeria...');

  const categorias = filtro
    ? CATEGORIAS.filter((c) => c.slug === filtro)
    : CATEGORIAS;

  let criadas = 0;
  let atualizadasPalavras = 0;
  for (const categoria of categorias) {
    let criadasNaCategoria = 0;

    for (const busca of categoria.buscas) {
      // +2 de folga porque o Pexels devolve resultados repetidos.
      const fotos = (await pexelsSearch(busca.query, busca.qtd + 2)).slice(
        0,
        busca.qtd,
      );
      const keywords = [...new Set([...categoria.keywords, ...(busca.keywords ?? [])])];

      for (const foto of fotos) {
        const url = foto.src.large2x;
        if (jaInseridas.has(url)) continue;
        jaInseridas.add(url);

        const existente = await prisma.galeriaImagem.findUnique({ where: { url } });
        if (existente) {
          // Foto já na galeria (rodada anterior): só garante que as palavras
          // chave novas entrem, senão o cardápio automático não a encontra.
          const faltando = keywords.filter((k) => !existente.keywords.includes(k));
          if (faltando.length > 0) {
            await prisma.galeriaImagem.update({
              where: { url },
              data: { keywords: [...existente.keywords, ...faltando] },
            });
            atualizadasPalavras += 1;
          }
          continue;
        }

        await prisma.galeriaImagem.create({
          data: {
            categoria: categoria.slug,
            keywords,
            url,
            autor: foto.photographer ?? null,
            fonte: foto.url ?? null,
          },
        });
        criadas += 1;
        criadasNaCategoria += 1;
        console.log(`    + [${categoria.slug}] ${url.split('/').slice(3, 5).join('/')}`);
      }
    }

    console.log(
      `  [${categoria.slug}] ${criadasNaCategoria} imagem(ns) nova(s) de ${categoria.buscas.length} busca(s)`,
    );
  }

  const total = await prisma.galeriaImagem.count();
  console.log(
    `\nSeed concluído: ${criadas} imagem(ns) criadas, ${atualizadasPalavras} foto(s) antigas ganharam palavras-chave novas. Total na galeria: ${total}.`,
  );
}

seed()
  .catch((error) => {
    console.error('Falha no seed da galeria:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
