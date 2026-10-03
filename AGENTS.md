# AGENTS.md

> **Contrato de codigo.** So as regras vivas e as invariantes atuais.
> A narrativa de sessions (o que quebrou, o que foi tentado, **por que** cada decisao
> foi tomada) esta em **`docs/historico.md`** — leia so a secao do modulo que for mexer.
> Debts e pendencias com o dono: **`debitos_tecnicos.md`**. Plano macro: **`PLAN.md`**.

## Como trabalhar aqui (leia antes de qualquer tarefa)

**1. Economia de contexto (regra do dono).** Quando a janela estiver encheendo, o
assistente DEVE avisar explicitamente E dizer exatamente o que falar para retomar:
arquivos em andamento, o que falta, comandos de verificacao e pontos sensiveis
(ex.: nao commitar, nomes de endpoints, segredos em uso). Avisar e obrigatorio.

**2. Discipline de tokens (valendo para mim).**
- **Pipe obrigatorio** em qualquer comando que possa lancar stack trace. Um erro do
  Prisma sem filtro despejou ~10k tokens de `library.js` minificado numa sessao.
  Use `| Select-Object -Last N` e filtros por padrao.
- **Suite completa so no fim.** Durante o desenvolvimento, rode apenas o spec alvo
  (`npx vitest run src/x.spec.ts`). `npm test` integral = 1 vez.
- **`grep` com `-C 2`** no lugar de ler arquivo inteiro. So `read` quando for editar.
- **Confie no que ja esta neste arquivo.** Nao re-descubra o que ja esta aqui (polling
  de 20s, dance do token, `.js` nas imports, etc.).
- **Prosa longa nao-ASCII sempre via `edit`/`write`**, nunca via heredoc no shell.
- **Comandos independentes em paralelo**, nunca sequenciais por padrao.
- Nao repita verificacao ja feita nesta sessao sem motivo novo.

**3. Verificacao padrao do projeto (use os scripts, nao invente pipes).**
- `back/`: `npm run verificar` -> lint + testes + build, so o resumo.
- `front/`: `npm run verificar` -> `tsc --noEmit` + build + budget.
- Smoke de API reutilizavel: `back/scripts/smoke/lib.mjs` (login/api/pedido/limpar).
  `npm run smoke:auth` = regressao de autorizacao (precisa do back no ar).
- Carga: `back/scripts/carga.mjs` (fases `leitura`/`varredura`/`checkout`).
  Rodar com `node` direto — `npm run carga` come as flags no PowerShell.
  `checkout` cria pedido REAL e exige `--pode-criar-pedidos`.

**4. Regra de encoding (ja custou um arquivo).** `Get-Content`/`Set-Content`/`Out-File`
corrompem este repo: o PowerShell 5.1 le como cp1252 e regrava em UTF-8 **com BOM**,
destruindo acentos. Vale para `.md`, `.html` e qualquer texto. Use os tools `edit`/`write`.
Se precisar de shell, use `[System.IO.File]::WriteAllLines(..., UTF8Encoding($false))`.

## Structure

- Dois apps independentes, **sem `package.json` na raiz / sem workspaces**. Comandos
  rodam dentro de `front/` ou `back/`; nunca `npm install` na raiz.
- `front/` = Angular 20 (standalone), na Vercel.
- `back/` = NestJS 12 (Node ESM), REST + WebSocket (Socket.io), no Render.
- **Sem Supabase.** Postgres e **Neon** (serverless) via **Prisma**; auth via **Neon
  Auth** (users/sessions em `neon_auth`); imagens no Cloudflare **R2** (adormecido);
  recuperacao de senha e **enviada pelo Neon Auth** (SMTP no console da Neon — nosso
  back nao manda e-mail). Storage e realtime sao implementados na propria API.
- Prose (PLAN/README/AGENTS) em pt-BR. Codigo em ingles.

## Setup gotchas

- Node local **22.16.0**. `@angular/cli` fixado em **v20** (CLI 22 exige Node >=22.22.3).
- `back/.npmrc` tem `legacy-peer-deps=true` (**obrigatorio**: npm 10.9.2 crasha
  resolvendo peer do vitest) e `min-release-age=7`. Nunca remover.
- `back/.env` (copiar de `.env.example`): `DATABASE_URL` (Neon DSN, `sslmode=require`,
  **`&connection_limit=20`**), `PORT`, `NEON_AUTH_ISSUER` (host `<projeto>.neonauth.sa-east-1.aws.neon.tech`, **sem** `/neondb/auth`), `APP_JWT_SECRET`, `FRONT_URL`, `ADMIN_SISTEMA_EMAIL` (opcional).
- `front/src/environments/environment.ts`: `apiUrl` + `neonAuthUrl`.
- Prisma: mudou `schema.prisma` -> `npx prisma migrate dev`. Ajuste pontual sem
  migration -> `npx prisma db push`. **Pare o `node dist/main` antes**: o
  `prisma generate` falha com EPERM ao renomear `query_engine-windows.dll.node`.

## `back/` — NestJS 12

- **ESM** (`"type": "module"`): import relativa **precisa da extensao `.js`**.
- Lint e **oxlint** (`npm run lint`). Testes **vitest**. Build `nest build`.
- **Rodar local**: o `npm start` -> `nest start` -> `node dist/main` (compilado).
  Mudanca no back = `npm run build` + restart. O watcher do `start:dev` faz isso sozinho.
- `PrismaService` e `@Global` (`src/prisma/`). `app.set('trust proxy', 1)` e
  **obrigatorio** (Render/proxy) — nao remover.
- **Auth**: Neon Auth. O browser **nao** consegue o JWT da Neon (o `/get-session` manda
  o EdDSA so no header `set-auth-jwt`, escondido por CORS). O `session.token` e o token
  **opaco** do cookie `HttpOnly`. O front manda `POST /auth/exchange` com o opaco; o
  back resolve em `neon_auth.session` e emite **JWT HS256 proprio** (`APP_JWT_SECRET`,
  iss/aud `cardapio-online`, exp 7d) = o Bearer. `AuthService.validateSession` tenta o
  JWT da app e cai no caminho legado da Neon (EdDSA via `neon_auth.jwks`).
- **Rate limit** (`src/common/limite-taxa.ts`): balde por **usuario autenticado**, por IP
  so no publico. Motivo: CGNAT de operadora derruba todo mundo junto (ver historico).
  O `sub` do JWT e **verificado** (HS256, sem ir ao banco) antes de virar chave — token
  forjado cai no balde de IP em vez de abrir balde novo. Limites: global 100/min,
  cardapio+diretorio 30/min, `POST /pedidos` 10/min, auth 10/min, verificar-email 5/min.
- **Numero do pedido**: `pg_advisory_xact_lock(hashtext(slug))` + `MAX(numero)+1` **na
  mesma transacao** (`{maxWait: 20000, timeout: 30000}`). O `::text` no SELECT e
  obrigatorio (Prisma da P2010 em `void`). Retry de P2002 e so rede de seguranca.
- **Prisma gotchas**:
  - `$queryRaw` **nao** faz cast implicito de text -> uuid: sempre `${x}::uuid`.
  - Numa transacao interativa, **nada de muitas queries em sequencia**: ou lote com
    `createMany` + uma leitura, ou `timeout` alto. Default do Prisma e **5s** e isso so
    quebra **no deploy** (Render -> Neon `sa-east-1`) — leia `logs_sistema`.
  - FK RESTRICT na Neon **nao** vira `P2003`: chega como `PrismaClientUnknownRequestError`
    (SQLSTATE 23001). **Cheque `count` antes de deletar** lanchonete; nao confie no codigo.
- **Modulos** (rotas em `src/<modulo>/`): `auth`, `lojas` (cardapio publico +
  `GET /l` diretorio), `pedidos` (+ gateway realtime, `horarios.ts`, `pix.ts`,
  `pedidos-maint.service.ts` de historico), `me` (perfil/enderecos/pedidos/termo/
  encerrar conta), `admin` (dono), `admin-sistema` (super-admin), `favoritas`,
  `galeria`, `whatsapp`, `plataforma`, `assets`, `encerramento`, `r2` (adormecido).
- **`PedidosGateway`**: valida o JWT async em `handleConnection` e guarda a promise em
  `client.data.authPromise` — handlers **precisam** `await client.data.authPromise`
  (o evento chega antes da validacao terminar). Canais `loja:join`, `pedido:novo`,
  `pedido:status`. CORS do handshake segue `FRONT_URL` + `CORS_ORIGINS`.
- **Status do pedido**: `recebido -> em_preparo -> enviado -> entregue -> finalizado`,
  ou `cancelado` (so antes da entrega, com justificativa obrigatoria). Pulo/volta ->
  400 (`TRANSICOES_STATUS`).
- **Plano**: `trial|pago`, **mensal (30 dias)** nos dois casos. `pago` vencido e so
  aviso; **bloqueio de pedido so para `trial` expirado**. Cardapio publico sempre visivel.
- **Contas de teste** (`npm run seed:teste`, idempotente):
  `cliente.teste@teste.dev` / `lojista.duarte@teste.dev` / `lojista.nonna@teste.dev`, senha
  `Teste1234`; admin raiz via `npm run criar:admin -- <email> <senha> <nome>`.
- **Dados sensiveis**: **nunca logar nem exportar `chavePix`/`brCodePix`**. Na consulta do
  painel de plataforma a chave vem mascarada (`null`) para admin humano — so o raiz ve.

## `front/` — Angular 20

- Root component e `src/app/app.ts` (convenção do scaffold v20), nao `app.component.ts`.
- Comandos: `npm start`, `npm run build` (`dist/front`), `npm test` (karma — precisa Chrome).
- SCSS; Prettier dentro do `front/package.json` (printWidth 100, singleQuote).
- API via `HttpClient` -> `environment.apiUrl`. Auth em `services/auth.service.ts`
  (Neon Auth) + interceptor funcional com Bearer.
- **REGRA: `await auth.init()` antes de qualquer endpoint com `AuthGuard`.**
  `perfilGuard` ja faz; as **rotas publicas** sao o ponto cego. Sem isso: 401 "Sessao
  ausente" no reload. Nao "corrigir" no interceptor (deadlock com `/auth/exchange`).
- **Angular gotchas**:
  - `[(ngModel)]="signal"` (sem `()`) — `[(ngModel)]="signal()"` da **NG5002**.
  - Todo `[ngModel]` dentro de `<form>` precisa de **`name`**.
  - `p-toggleswitch` v20 **nao tem** input `[checked]` (NG8002) — use `[ngModel]`.
  - **Nao usar `appendTo="self"`**: so o `p-drawer` do PrimeNG 20.3.15 nao filtra o
    sentinel e quebra com `Cannot append [object HTMLDivElement] to self`. Use
    `[appendTo]="null"` (render inline, a cor da loja continua cascading).
  - Overlay inline precisa de `z-index` explicito (`Z_OVERLAY = 1000` no cardapio),
    acima do app bar (900).
- **SCSS**: budget real `anyComponentStyle` (**error 10 kB / warn 12 kB**, medido
  comprimido). `cardapio`, `admin-cardapio` e `painel-admin` estao perto — mover para
  `styles.scss` **escopado por um wrapper real do DOM** (seletor errado = regra morta,
  nao da erro de build).
- **REGRA: conferir no responsivo** em **375x667**, **768x1024** e **1280x800**. O dono
  usa celular e **375px e o piso**. Aceitar: `document.documentElement.scrollWidth <=
  window.innerWidth`; nenhum input/button com < ~40px de altura; tabela com muitas
  colunas vira card empilhado ou wrapper com `overflow-x: auto`. Breakpoints do projeto:
  `600px` e `900px`. Reportar os 3 viewports na conclusao.
- **Smoke de UI**: Chrome headless + CDP. **Use clique real**
  (`Input.dispatchMouseEvent`), nao `element.click()` — o PrimeNG com `appendTo` inline
  realoca o container e o clique sintetico e flaky. Fechar dialog = `.p-dialog-close-button`.
- **i18n**: `<html lang="pt-BR">` + `<meta name="google" content="notranslate">` +
  `class="notranslate"` no body. `LOCALE_ID = 'pt-BR'` registrado — currency sai
  `R$ 12,90`. Banco guarda ponto; so exibicao troca.
- **Logo da lanchonete**: `logoUrl` guarda **so logo propria**. Nunca gravar URL de asset
  (`/assets/logo-*.svg`) no banco — congela o host e quebra em outro ambiente. Resolver
  sempre por `resolveLogo()` (`services/lanchonete-visual.ts`).
- **Termos**: versao **sincronizada** em `back/src/me/termo.ts` e
  `front/src/app/services/termos.ts` (`TERMO_VERSAO_ATUAL`). `GET /me` le o aceite com
  `findUnique` da **versao vigente** — nunca `findFirst`/mais recente (bug do "pede o
  termo a cada login").

## Seguranca — vale para todo codigo novo

- **Nunca confiar na origin** para autorizacao (so defesa em profundidade).
- **CORS** restrito a `FRONT_URL` + `CORS_ORIGINS` (virgula). `helmet` com
  `crossOriginResourcePolicy: 'cross-origin'` (o default `same-origin` bloqueia as
  `<img>` de logo/galeria servidas pela API). `x-powered-by` desabilitado.
- **Boot falha em producao** se `APP_JWT_SECRET` faltar/<32 bytes ou se
  `THROTTLE_DISABLED=true`. `THROTTLE_DISABLED` so para smoke local/e2e.
- **Escapamento**: front usa **so** `{{ }}` — **zero** `innerHTML`/`bypassSecurityTrust`.
- **JWT da app** vive **so em memoria** no front (signal). Nao mover para `localStorage`.
  (O "Lembrar de mim" guarda e-mail+senha por pedido explicito do dono — tradeoff
  documentado em `debitos_tecnicos.md`.)
- **Validacao manual** em todo body/query (sem class-validator): tamanho, tipo, dominio,
  enum. Nunca confiar no cliente.
- **Prisma raw**: preferir `$queryRaw` tipado; `$queryRawUnsafe` so com parametros.
- **LGPD**: dado pessoal so para operar o servico; **jamais** registrar documento,
  telefone, e-mail ou chave em log/detalhe. Chave PIX nunca em log nem no `.xlsx`.
- **Servicos externos** (WhatsApp/Meta, e-mail): sempre `try/catch`, log de erro **sem**
  dado sensivel, e **falha nunca derruba a operacao principal**.
- **`overrides: { multer: ^2.4.0 }`** no `back/package.json` — **nao remover** (o
  `@nestjs/platform-express` fixa 2.2.0, com 4 CVEs). Sem upload em uso, mas a lib
  carrega no boot.