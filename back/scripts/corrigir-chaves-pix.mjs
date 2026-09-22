// Correção retroativa das chaves PIX já gravadas: normaliza telefone/CPF/CNPJ/
// e-mail/aleatória para o formato exigido dentro do BR Code (ver normalizarChavePix).
// NUNCA imprime a chave (dado sensível) — só nome da loja e contadores.
//
// Requer o back compilado (importa dist/pedidos/pix.js): rode antes `npm run build`.
// Uso (na pasta back/): npm run corrigir:chaves-pix
import { PrismaClient } from '@prisma/client';

let normalizarChavePix;
try {
  ({ normalizarChavePix } = await import('../dist/pedidos/pix.js'));
} catch (error) {
  console.error('Não achei dist/pedidos/pix.js — rode antes: npm run build');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const lanchonetes = await prisma.lanchonete.findMany({
    where: { chavePix: { not: null } },
    select: { id: true, chavePix: true, nome: true },
  });

  let alteradas = 0;
  let inalteradas = 0;
  for (const lanchonete of lanchonetes) {
    if (!lanchonete.chavePix) {
      inalteradas += 1;
      continue;
    }
    const normalizada = normalizarChavePix(lanchonete.chavePix);
    if (normalizada !== lanchonete.chavePix) {
      await prisma.lanchonete.update({
        where: { id: lanchonete.id },
        data: { chavePix: normalizada },
      });
      alteradas += 1;
      console.log(`  [ok] ${lanchonete.nome} — chave PIX normalizada.`);
    } else {
      inalteradas += 1;
    }
  }
  console.log(
    `Chaves PIX: ${alteradas} normalizada(s), ${inalteradas} já no formato correto.`,
  );
}

main()
  .catch((error) => {
    console.error('Erro:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
