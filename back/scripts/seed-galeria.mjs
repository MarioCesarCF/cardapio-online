// Seed da galeria de imagens (M5) — versão sem armazenamento próprio.
// Grava direto a URL do Pexels em `galeria_imagens.url` (sem baixar, sem R2).
// Quando o Cloudflare R2 for ativado, basta o seed gravar a URL do R2 nesse campo.
// Uso (a partir de back/):  npm run seed:galeria
// Exige em .env: PEXELS_API_KEY + DATABASE_URL.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORIES = [
  { slug: 'hamburguer', query: 'burger', qtd: 3, keywords: ['hamburguer', 'burger', 'lanche'] },
  { slug: 'batata', query: 'french fries', qtd: 4, keywords: ['batata', 'frita', 'porcao', 'fries'] },
  { slug: 'sucos', query: 'fresh juice glass', qtd: 3, keywords: ['suco', 'sucos', 'juice', 'natural'] },
  { slug: 'sorvetes', query: 'ice cream sundae', qtd: 3, keywords: ['sorvete', 'sorvetes', 'ice cream', 'sobremesa'] },
  { slug: 'acai', query: 'acai bowl', qtd: 1, keywords: ['acai', 'açaí', 'bowl'] },
  { slug: 'pizza', query: 'pizza', qtd: 3, keywords: ['pizza', 'queijo'] },
  { slug: 'refrigerantes', query: 'soda bottle glass', qtd: 3, keywords: ['refrigerante', 'refri', 'soda', 'cola'] },
  { slug: 'cerveja', query: 'beer glass', qtd: 2, keywords: ['cerveja', 'cervejas', 'beer'] },
];

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

async function seed() {
  console.log('Consultando o Pexels e gravando as URLs na galeria...');

  let criadas = 0;
  for (const categoria of CATEGORIES) {
    const fotos = (await pexelsSearch(categoria.query, categoria.qtd + 3)).slice(0, categoria.qtd);
    console.log(`  [${categoria.slug}] ${fotos.length} imagem(ns) encontrada(s)`);

    for (const foto of fotos) {
      const url = foto.src.large2x;
      const existente = await prisma.galeriaImagem.findUnique({ where: { url } });
      if (existente) continue;

      await prisma.galeriaImagem.create({
        data: {
          categoria: categoria.slug,
          keywords: categoria.keywords,
          url,
          autor: foto.photographer ?? null,
          fonte: foto.url ?? null,
        },
      });
      criadas += 1;
      console.log(`    + ${url.split('/').slice(3, 5).join('/')}`);
    }
  }

  console.log(`\nSeed concluído: ${criadas} imagem(ns) criadas.`);
}

seed()
  .catch((error) => {
    console.error('Falha no seed da galeria:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());