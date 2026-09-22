# Cardápio Online

Plataforma de cardápio online para lanchonetes pequenas: página pública por loja (`{slug}`), checkout com PIX, painel do dono com pedidos em tempo real e personalização visual.

- **Front**: Angular 20 → Vercel
- **Back**: NestJS 12 (Node.js, REST + WebSocket) → Render
- **Banco**: PostgreSQL serverless (Neon) via Prisma
- **Auth**: Neon Auth (Managed Better Auth) — e-mail/senha + OAuth
- **Storage**: Cloudflare R2 (galeria de imagens)
- **E-mail**: reset de senha enviado pelo próprio Neon Auth (configurável no console da Neon)

Mais detalhes em [PLAN.md](./PLAN.md).

## Estrutura

```
front/   # Angular App
back/    # NestJS API
```

## Requisitos

- Node.js ≥ 20
- Contas em Neon, Cloudflare R2, Vercel e Render (só para deploy)

## Rodando localmente

### Back

```bash
cd back
cp .env.example .env   # preencha DATABASE_URL (Neon) e PORT
npm install
npx prisma generate    # gera o client tipado
npm run start:dev
```

### Front

```bash
cd front
npm install
npm run start   # http://localhost:4200
```