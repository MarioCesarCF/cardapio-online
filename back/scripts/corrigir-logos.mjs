// Correção retroativa de `lanchonetes.logoUrl`.
//
// Até 2026-09-27 o botão "Padrão" (admin-config) e o onboarding gravavam no banco
// a URL ABSOLUTA do asset de logo do tipo (`${apiUrl}/assets/logo-<tipo>.svg`).
// Em dev isso congelava `http://localhost:3000/...` no banco — e aí a logo
// quebrava em qualquer outro lugar: no celular do dono, no deploy da Vercel, em
// outra máquina (localhost aponta para o próprio aparelho).
//
// Este script zera o campo nessas linhas: "sem logo própria" é o estado correto
// e o front deriva a logo do tipo na hora (front `resolveLogo`).
// Logo de verdade (R2, galeria/Pexels, URL própria) NÃO é tocada — só o que
// aponta para o asset padrão, em qualquer host.
//
// Idempotente. Uso (na pasta back/): npm run corrigir:logos
import { PrismaClient } from '@prisma/client';

const PADRAO = /\/assets\/logo-[a-z]+\.svg(\?.*)?$/i;

const prisma = new PrismaClient();

async function main() {
  const lanchonetes = await prisma.lanchonete.findMany({
    where: { logoUrl: { not: null } },
    select: { id: true, nome: true, slug: true, tipo: true, logoUrl: true },
  });

  let corrigidas = 0;
  let mantidas = 0;
  for (const lanchonete of lanchonetes) {
    if (!PADRAO.test(lanchonete.logoUrl)) {
      mantidas += 1;
      console.log(`  [mantida] ${lanchonete.nome} — logo propria preservada.`);
      continue;
    }
    await prisma.lanchonete.update({
      where: { id: lanchonete.id },
      data: { logoUrl: null },
    });
    corrigidas += 1;
    console.log(`  [ok] ${lanchonete.nome} (${lanchonete.slug}) — logo padrao liberada.`);
  }

  const semTipo = await prisma.lanchonete.count({
    where: { tipo: null, logoUrl: null },
  });
  console.log(
    `Logos: ${corrigidas} limpa(s), ${mantidas} logo(s) propria(s) preservada(s).`,
  );
  if (semTipo > 0) {
    console.log(
      `Aviso: ${semTipo} lanchonete(s) sem tipo e sem logo — continuam sem imagem (defina o tipo no admin-config).`,
    );
  }
}

main()
  .catch((error) => {
    console.error('Erro:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
