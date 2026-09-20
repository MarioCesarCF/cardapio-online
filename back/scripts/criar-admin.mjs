// Cria o primeiro administrador da plataforma (admin-sistema):
//   1. cadastra a conta na Neon Auth (e-mail + senha);
//   2. marca o usuário como "super" em admin_sistema.
//
// Uso (na pasta back/): npm run criar:admin -- <email> <senha> <nome>
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const [, , email, senha, nome] = process.argv;

function sair(mensagem) {
  console.error(mensagem);
  process.exit(1);
}

if (!email || !senha || !nome) {
  sair('Uso: npm run criar:admin -- <email> <senha> <nome>');
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
  sair('E-mail inválido.');
}
if (senha.length < 8 || senha.length > 72) {
  sair('A senha deve ter entre 8 e 72 caracteres.');
}

const issuer = process.env.NEON_AUTH_ISSUER?.replace(/\/+$/, '');
const frontUrl = process.env.FRONT_URL ?? 'http://localhost:4200';
if (!issuer) {
  sair('NEON_AUTH_ISSUER não está definido no .env.');
}

async function main() {
  const jaExiste = await prisma.adminSistema.findUnique({ where: { email } });
  if (jaExiste) {
    sair(`O e-mail ${email} já é administrador.`);
  }

  const res = await fetch(`${issuer}/neondb/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', origin: frontUrl },
    body: JSON.stringify({ name: nome, email, password: senha }),
  });
  const json = (await res.json().catch(() => ({}))) ?? {};
  const id = json?.user?.id ?? json?.data?.user?.id;

  if (!res.ok || !id) {
    const msg = json?.message ?? 'Não foi possível cadastrar a conta na Neon Auth.';
    sair(`Erro: ${msg}`);
  }

  await prisma.adminSistema.upsert({
    where: { id },
    create: { id, email, nome, funcao: 'super' },
    update: { email, nome, funcao: 'super' },
  });

  console.log(`Administrador raiz criado: ${email} (${nome})`);
  console.log('Entrou em /auth no site e será redirecionado para /painel-admin.');
}

main()
  .catch((error) => {
    console.error('Falha:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());