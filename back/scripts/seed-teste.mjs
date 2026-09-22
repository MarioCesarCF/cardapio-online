// Seed de dados de teste (desenvolvimento).
// Cria contas na Neon Auth e 2 lanchonetes com cardápio:
//   - "Duarte Burguers" (lanches) — situação ATIVA  (testa consulta e pedidos)
//   - "Cantina da Nonna" (pizzaria) — situação PENDENTE (testa a aprovação do admin)
// Também garante uma conta de cliente fixa (cliente.teste@teste.dev).
//
// Idempotente: reutiliza contas e lanchonetes já existentes pelo slug/e-mail.
//
// Uso (na pasta back/): npm run seed:teste
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const issuer = process.env.NEON_AUTH_ISSUER?.replace(/\/+$/, '');
const frontUrl = process.env.FRONT_URL ?? 'http://localhost:4200';
if (!issuer) {
  console.error('NEON_AUTH_ISSUER não está definido no .env.');
  process.exit(1);
}

async function buscarOuCriarUsuario(email, senha, nome) {
  const existente = await prisma.$queryRaw`
    SELECT id::text AS id FROM neon_auth."user" WHERE email = ${email} LIMIT 1
  `;
  if (existente.length > 0) return existente[0].id;

  const res = await fetch(`${issuer}/neondb/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', origin: frontUrl },
    body: JSON.stringify({ name: nome, email, password: senha }),
  });
  const json = (await res.json().catch(() => ({}))) ?? {};
  const id = json?.user?.id ?? json?.data?.user?.id;
  if (!res.ok || !id) {
    throw new Error(`Falha ao criar usuário ${email}: ${JSON.stringify(json)}`);
  }
  return id;
}

async function imagemDe(categoria) {
  const imagem = await prisma.galeriaImagem.findFirst({
    where: { categoria },
    orderBy: { createdAt: 'asc' },
    select: { url: true },
  });
  return imagem?.url ?? null;
}

async function garantirLanchonete(donoId, dados) {
  const existente = await prisma.lanchonete.findUnique({ where: { slug: dados.slug } });
  if (existente) {
    console.log(`  Lanchonete /${dados.slug} já existe (${dados.nome}) — pulando.`);
    return existente;
  }
  const lanchonete = await prisma.lanchonete.create({
    data: {
      donoId,
      ...dados,
      plano: 'trial',
      planoExpira: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  console.log(`  Lanchonete criada: ${dados.nome} (/${dados.slug}) [${dados.situacao}]`);
  return lanchonete;
}

async function garantirCardapio(lanchonete, categorias) {
  for (const cat of categorias) {
    let categoria = await prisma.categoria.findFirst({
      where: { lanchoneteId: lanchonete.id, nome: cat.nome },
    });
    if (!categoria) {
      categoria = await prisma.categoria.create({
        data: { lanchoneteId: lanchonete.id, nome: cat.nome, posicao: cat.posicao },
      });
    }
    for (const prod of cat.produtos) {
      const existeProduto = await prisma.produto.findFirst({
        where: { categoriaId: categoria.id, nome: prod.nome },
      });
      let produto = existeProduto;
      if (!produto) {
        produto = await prisma.produto.create({
          data: {
            categoriaId: categoria.id,
            nome: prod.nome,
            descricao: prod.descricao ?? null,
            preco: prod.preco,
            imagemUrl: prod.imagemUrl,
            destaque: prod.destaque ?? false,
          },
        });
        console.log(`    Produto: ${prod.nome} (${categoria.nome})`);
      }
      for (const grupo of prod.grupos ?? []) {
        let grupoDb = await prisma.grupoOpcoes.findFirst({
          where: { lanchoneteId: lanchonete.id, nome: grupo.nome },
        });
        if (!grupoDb) {
          grupoDb = await prisma.grupoOpcoes.create({
            data: {
              lanchoneteId: lanchonete.id,
              nome: grupo.nome,
              tipo: grupo.tipo,
              obrigatorio: grupo.obrigatorio,
              minSelecoes: grupo.minSelecoes,
              maxSelecoes: grupo.maxSelecoes,
            },
          });
          for (const opcao of grupo.opcoes) {
            await prisma.opcao.create({
              data: {
                grupoId: grupoDb.id,
                nome: opcao.nome,
                precoAdicional: opcao.precoAdicional ?? 0,
              },
            });
          }
          console.log(`      Grupo: ${grupo.nome}`);
        }
        const jaVinculado = await prisma.produtoGrupo.findUnique({
          where: { produtoId_grupoId: { produtoId: produto.id, grupoId: grupoDb.id } },
        });
        if (!jaVinculado) {
          await prisma.produtoGrupo.create({
            data: { produtoId: produto.id, grupoId: grupoDb.id, ordem: 0 },
          });
        }
      }
    }
  }
}

async function main() {
  console.log('Seed de teste da Etapa 1 (situação/aprovação + consulta).');

  const [donoBurguers, donoPizzaria, cliente] = await Promise.all([
    buscarOuCriarUsuario('lojista.duarte@teste.dev', 'Teste1234', 'Dona do Duarte Burguers'),
    buscarOuCriarUsuario('lojista.nonna@teste.dev', 'Teste1234', 'Dono da Cantina da Nonna'),
    buscarOuCriarUsuario('cliente.teste@teste.dev', 'Teste1234', 'Cliente de Teste'),
  ]);

  const [imgHamburguer, imgBatata, imgSuco, imgPizza] = await Promise.all([
    imagemDe('hamburguer'),
    imagemDe('batata'),
    imagemDe('sucos'),
    imagemDe('pizza'),
  ]);

  const duarte = await garantirLanchonete(donoBurguers, {
    nome: 'Duarte Burguers',
    slug: 'duarte-burguers',
    logoUrl: null,
    fonte: 'display',
    corPrincipal: '#e8800c',
    tipo: 'lanches',
    chavePix: 'duarte@teste.dev',
    nomePix: 'Duarte Burguers',
    whatsapp: '5511999990001',
    emailContato: 'contato@duarteburguers.com.br',
    enderecoLoja: 'Av. Paulista, 1000 - São Paulo/SP',
    situacao: 'ativa',
  });

  const nonna = await garantirLanchonete(donoPizzaria, {
    nome: 'Cantina da Nonna',
    slug: 'cantina-da-nonna',
    logoUrl: null,
    fonte: 'display',
    corPrincipal: '#d64541',
    tipo: 'pizzaria',
    chavePix: 'nonna@teste.dev',
    nomePix: 'Cantina da Nonna',
    whatsapp: '5511999990002',
    emailContato: 'contato@cantinadanonna.com.br',
    enderecoLoja: 'Rua Augusta, 250 - São Paulo/SP',
    situacao: 'pendente',
  });

  await garantirCardapio(duarte, [
    {
      nome: 'Hambúrgueres',
      posicao: 0,
      produtos: [
        {
          nome: 'X-Tudo Duplo',
          descricao: 'Dois hambúrgueres, queijo, bacon, ovo e molho da casa.',
          preco: 32.9,
          destaque: true,
          imagemUrl: imgHamburguer,
          grupos: [
            {
              nome: 'Adicionais',
              tipo: 'multipla',
              obrigatorio: false,
              minSelecoes: 0,
              maxSelecoes: 2,
              opcoes: [
                { nome: 'Bacon extra', precoAdicional: 5 },
                { nome: 'Queijo extra', precoAdicional: 4 },
                { nome: 'Ovo', precoAdicional: 2.5 },
              ],
            },
          ],
        },
        {
          nome: 'Clássico',
          descricao: 'Hambúrguer 160g, queijo prato e molho da casa.',
          preco: 24.9,
          imagemUrl: imgHamburguer,
        },
        {
          nome: 'Batata da casa',
          descricao: 'Porção de batata rústica com cheddar e bacon.',
          preco: 18.5,
          imagemUrl: imgBatata,
        },
      ],
    },
    {
      nome: 'Bebidas',
      posicao: 1,
      produtos: [
        { nome: 'Suco natural', descricao: 'Laranja ou limão, 500ml.', preco: 9.5, imagemUrl: imgSuco },
        { nome: 'Refrigerante lata', preco: 6.9 },
      ],
    },
  ]);

  await garantirCardapio(nonna, [
    {
      nome: 'Pizzas',
      posicao: 0,
      produtos: [
        {
          nome: 'Pizza Margherita',
          descricao: 'Molho de tomate, muçarela e manjericão.',
          preco: 42,
          imagemUrl: imgPizza,
          grupos: [
            {
              nome: 'Tamanho',
              tipo: 'unica',
              obrigatorio: true,
              minSelecoes: 1,
              maxSelecoes: 1,
              opcoes: [
                { nome: 'Média (6 fatias)' },
                { nome: 'Grande (8 fatias)', precoAdicional: 10 },
              ],
            },
          ],
        },
        {
          nome: 'Pizza Calabresa',
          descricao: 'Calabresa fatiada, cebola e azeitona.',
          preco: 48,
          imagemUrl: imgPizza,
        },
        {
          nome: 'Pizza Portuguesa',
          descricao: 'Presunto, ovos, cebola, azeitona e palmito.',
          preco: 52.9,
          imagemUrl: imgPizza,
        },
      ],
    },
    {
      nome: 'Bebidas',
      posicao: 1,
      produtos: [{ nome: 'Refrigerante lata', preco: 6.9 }],
    },
  ]);

  console.log('');
  console.log('Resumo da Etapa 1:');
  console.log(`  - Duarte Burguers /duarte-burguers [ativa] — dona: lojista.duarte@teste.dev / Teste1234`);
  console.log(`  - Cantina da Nonna /cantina-da-nonna [pendente] — dono: lojista.nonna@teste.dev / Teste1234`);
  console.log(`  - Cliente: cliente.teste@teste.dev / Teste1234`);
  console.log('');
  console.log('No painel-admin, aprovar a Cantina da Nonna vai gerar entrada no log.');
}

main()
  .catch((error) => {
    console.error('Falha no seed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());