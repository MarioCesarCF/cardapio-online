# Débitos Técnicos / Pendências

> Registro central do que foi **decidido implementar no futuro** mas ainda não foi feito.
> Regra: toda decisão de implementação futura tomada na conversa entra aqui (ver AGENTS.md).
> Ao concluir um item: marcar `✅` (ou remover) e refletir no `PLAN.md`.

## Formato de cada item

- **Status**: `pendente` | `em andamento` | `✅ concluído`
- **Quem resolve**: dono / assistente / ambos
- **O quê / Por quê**: contexto da pendência
- **Passo a passo**: instruções claras para executar
- **Links**: documentação oficial
- **Verificação**: como saber que ficou pronto

---

## F8.6 — WhatsApp: confirmar o envio com o número de TESTE da Meta (pendente)

**Status**: `pendente` (requer o dono — precisa da sua conta Meta)
**Quem resolve**: dono (criação do app na Meta) + assistente (se algo na API precisar de ajuste)

### Contexto

O back já está pronto e **desligado por decisão nossa** (`notifWhatsapp` default `false`):
- `WhatsAppModule` `@Global` em `back/src/whatsapp/` — `WhatsAppService` (Meta Cloud API via fetch) + `normalizarNumeroWhatsApp`.
- Hook em `back/src/pedidos/pedidos.service.ts` (`criaPedido`): envia template para o WhatsApp da loja quando `notifWhatsapp` está ligado; falha nunca derruba o pedido (só loga).
- `npm run testar:whatsapp` envia o template (default `hello_world`) para `5527998927442`.
- o template de produção usa os coringas `{1}` lanchonete, `{2}` número, `{3}` total, `{4}` tipo de entrega, `{5}` pagamento.

Falta só **criar o app na Meta e confirmar que o celular recebe a mensagem**. É de graça com o número de teste
(envia para até 5 números).

### Passo a passo

1. **Crie o app na Meta** — entre com a sua conta (a do Facebook/Instagram) em:
   <https://developers.facebook.com/apps/> → botão **Create App** → tipo **Business** → preencha nome do app.

2. **Adicione o produto WhatsApp** — no painel do app, em **Add Products**, clique em **WhatsApp** → **Set up**.

3. **Pegue o token de acesso temporário** — em **WhatsApp → API Setup** você recebe:
   - **Temporary access token** (válido ~24h; se expirar enquanto testa, gere outro);
   - **Phone number ID** (número de teste já criado automaticamente — não precisa pagar nada agora).

4. **(Opcional, só p/ não usar o padrão) Crie um template de teste** — o template `hello_world` (en_US) já vem
   aprovado no número de teste e serve para validar. Se quiser testar o template de produção `pedido_novo`,
   crie em WhatsApp Manager → **Message templates** e oriente o corpo com os coringas:
   - `{1}` nome da lanchonete
   - `{2}` número do pedido
   - `{3}` total (ex.: R$ 42,90)
   - `{4}` tipo de entrega (Entrega/Retirada/Consumo no local)
   - `{5}` forma de pagamento (Pix/Cartão/Dinheiro)
   - idioma `pt_BR` → e então setar as envs `WA_TEMPLATE_PEDIDO_NOVO=pedido_novo` e `WA_TEMPLATE_LANG=pt_BR`.

5. **Adicione o seu celular como destinatário de teste** — no API Setup (ou WhatsApp Manager), adicione até 5
   números de teste (ex.: `+55 27 9989-27442` / 27998927442). Sem isso a Meta recusa o envio (números fora da lista).

6. **Preencha o `back/.env`** (copie o modelo de `back/.env.example`):
   ```dotenv
   WA_GRAPH_TOKEN=<o token temporário do passo 3>
   WA_PHONE_NUMBER_ID=<o phone number ID do passo 3>
   # opcionais nesta fase:
   # WA_GRAPH_VERSION=v21.0
   # WA_TEMPLATE_PEDIDO_NOVO=hello_world
   # WA_TEMPLATE_LANG=en_US
   # WA_TEST_RECIPIENT=5527998927442
   ```

7. **Recompile o back e rode o teste** (na pasta `back/`):
   ```powershell
   npm run build
   npm run testar:whatsapp
   ```
   Deve imprimir `WhatsApp enviado para 5527998927442 com o template "hello_world"` e **a mensagem "Hello World"
   deve chegar no celular**. Se der erro, a mensagem da Meta (com o motivo) aparece na tela.

8. **Ligando de verdade (produção)**: criar a **Business Account** + verificação do negócio, registrar o **número
   real** `27995077806` na WABA, aprovar o template `pedido_novo` (pt_BR) e só então marcar `notifWhatsapp` na loja.
   Relembrando: **por enquanto deixamos desligado de propósito** (foi o combinado).

### Links úteis

- Apps da Meta (criar app): <https://developers.facebook.com/apps/>
- WhatsApp Cloud API — primeiro app/teste: <https://developers.facebook.com/docs/whatsapp/cloud-api/get-started>
- WhatsApp Cloud API — referência geral: <https://developers.facebook.com/docs/whatsapp/cloud-api/>
- Envio de templates (coringas `{1}..{N}`): <https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates>
- Templates de mensagem: <https://developers.facebook.com/docs/whatsapp/message-templates>
- Verificação do negócio (p/ produção): <https://developers.facebook.com/docs/developer-verification/>

### Verificação final

- `npm run testar:whatsapp` imprime sucesso **e** chega "Hello World"/template no celular.
- Opcional (loja): ligar o toggle **WhatsApp** em `admin-config` e criar um pedido real para receber o template `pedido_novo`.

---

## Etapa 11 — Separação de perfis: Lanchonete × Cliente × Admin ✅ concluído

**Status**: ✅ concluído (2026-09-22) — ver `PLAN.md` seção Etapa 11
**Quem resolve**: closes; decisões tomadas: bloqueio total por perfil principal

### Contexto

O `authGuard` do front só checa **autenticação**, não o perfil. Qualquer logado navega para
qualquer rota protegida (`/home`, `/meus-pedidos`, `/painel-admin`, `/admin`, `/admin/:slug/*`).
Bug relatado pelo dono: com o login de uma lanchonete o usuário conseguiu abrir a área do cliente (`/home`).

O back já protege parte: `/admin/*` tem dono-check (404), `/admin-sistema/*` tem `AdminSistemaGuard`
(403); áreas de cliente (`/me*`, `/favoritas`) são abertas a qualquer autenticado (todo Neon user vira
`clientes` no 1º acesso). Falta aplicar a regra **no front** e decidir o comportamento.

**Ressalva do modelo**: um usuário pode acumular perfis (dono + cliente + admin_sistema). O objetivo
é redirecionar para o **perfil principal** e bloquear/explicar as áreas dos perfis que o usuário não tem.

### Passo a passo

1. Usar `GET /me` como fonte de perfis (`cliente`, `lanchonetes`, `adminSistema`, `adminSistemaFuncao`) — sem mudar schema.
2. Criar `front/src/app/services/perfil.service.ts` (computeds `ehCliente`/`ehDono`/`ehAdminSistema` + `perfilPrincipal()`) e consolidar a lógica espalhada em `posLogin`, `admin-home`, `admin-shell`, painel.
3. Criar guard por perfil (`perfilGuard('dono' | 'cliente' | 'admin-sistema')`) que carrega `/me` e restringe as rotas:
   - cliente → `/home`, `/meus-pedidos`, `/favoritas`;
   - dono → `/admin`, `/admin/:slug/*`;
   - admin-sistema → `/painel-admin`.
   Fora do perfil: redirect para o perfil principal (ex.: dono em `/home` → `/admin/:slug/config`; cliente em `/admin` → convite "Quer vender?").
4. **Decidir com o dono**: usuário multi-perfil (dono que também é cliente) — link explícito "Área do cliente" vs. bloqueio total.
5. Ocultar/mostrar menus conforme o perfil (home, shell do dono, painel).
6. Fazer o rolamento para as datas após Etapas 7-10 (é a última).

### Verificação

Contas de teste (`lojista.duarte@…`, `cliente.teste@…`, `admin@…`): cada uma só abre as rotas do
próprio perfil e, fora delas, cai no redirect correto (sem erro/tela em branco).

---

## F8.7 — Cardápio com IA (admitido para planejar melhor; deferido em 2026-09-22)

**Status**: `pendente` (deferido por decisão do dono para planejar melhor — não entrar antes de F8.8/F8.9/F8.10)
**Quem resolve**: assistente + decisões do dono (fluxo de revisão, se voz entra no MVP)

### Contexto

O dono pediu para **adiar** esta etapa e deixar registrado aqui com direcionamento para retomada. É a
**Etapa 7** do `PLAN.md` (linha ~63) + **F8.7** (linha ~31). Objetivo: o dono monta o cardápio mandando
**texto corrido, planilha ou fotos do menu físico**; a IA estrutura tudo no schema existente
(categorias/produtos/grupos/opções) e grava via o mesmo pipeline do `AdminService`, depois de uma
**revisão em rascunho** (nada publicado direto). Modo extra em estudo: **voz** (ditar o cardápio).

Riscos/decisões que **devem ser resolvidas ANTES de implementar** (a retomada deve começar por aqui):

1. **Fluxo de revisão**: rascunho em modal vs. wizard passo a passo (categoria→produtos→revisão) — definir com o dono.
2. **Voz no MVP?**: estudar se a transcrição (STT) no próprio Gemini multimodal (recebe áudio direto) elimina
   dependência externa; validar precisão com sotaques/nomes de produtos/ruído ao vivo antes de prometer.
3. **Formato de entrada 1º**: o plano sugere texto colado → planilha (.xlsx) → fotos (visão). Validar se começa
   só com texto para sair rápido.

### Passo a passo (quando retomar)

1. Lar `PLAN.md` (Etapa 7), `AGENTS.md` (seções Admin/M2, Pedidos e "Regra do contexto") e este item.
2. Arquitetura já definida: **tudo server-side** no NestJS em `back/src/importacao-cardapio/`,
   `POST /l/:slug/cardapio/importacao` (multipart p/ fotos; JSON/form p/ texto e `.xlsx`). Provider escolhido:
   **Gemini Flash** (visão barata/boa p/ cardápio físico). Chaves só em `back/.env` (nunca no Angular).
3. Prompt forçando **JSON no schema exato** do app; reaproveitar a validação do CRUD atual (`admin.service.ts`);
   gravar em **rascunho** (sem publicar direto) e depois converter em categorias/produtos reais via pipeline atual.
4. Ordem: 1º texto colado → 2º planilha (parse `.xlsx` server-side + mapeamento de colunas) → 3º fotos (visão).
   Bônus grátis: sugerir imagens da galeria existente (`GET /galeria`) por categoria.
5. Custo ≈ zero: Gemini 2.5 Flash tem free tier; 3–8 fotos custam ~US$ 0,02–0,05; texto/planilha, frações de centavo.
   Tempo estimado: v1 só de texto ~1 semana; v1 sólida 2–4 semanas.

### Para retomar (mensagem pronta para o assistente)

> "Retome o F8.7 (cardápio com IA), deferido em debitos_tecnicos.md. Leia PLAN.md Etapa 7 + debitos_tecnicos e
> comece resolvendo as 3 decisões listadas no item (fluxo de revisão, voz no MVP, formato de entrada)."

### Links úteis

- Gemini API (modelos flash, texto/imagem/áudio): <https://ai.google.dev/gemini-api/docs>
- Parsing de .xlsx no Node: planilha `xlsx` (SheetJS)

### Verificação final

- Dono manda texto/planilha/foto e vê o rascunho revisável em tela; ao confirmar, vira cardápio real
  (categorias/produtos/grupos/opções) seguindo o schema e validações atuais — sem quebrar o fluxo manual.

---

## F8.11 — Contrato de assinatura offline + armazenamento no R2 (decisão do dono, 2026-09-22)

**Status**: `pendente` (planejado; nada implementado)
**Quem resolve**: assistente (arquitetura/código — R2, endpoints, painel) + dono (envs do R2, modelo do contrato/PDF, PIX/e-mail/WhatsApp de contato da assinatura)

### Contexto

A **landing page + gateway de cobrança (Mercado Pago/PagSeguro) ficam para depois**. Antes disso o dono
quer um fluxo **direto e presencial** (físico) de adesão:

1. O dono da plataforma imprime/leva um **contrato físico** à lanchonete (com orientações de pagamento:
   **chave PIX dele** + **e-mail/whatsapp de contato** para o lojista enviar o comprovante).
2. Assinado presencialmente, o contrato é **escaneado** e fica **disponível para a lanchonete baixar e
   conferir** (no painel do dono da loja; super-admin também consegue ver/gereciar).
3. Só depois disso é que se desenha a landing + gateway para cobrança/renovação automática (ver PLAN,
   "pendente F8.8").

### Decisão técnica de armazenamento (a confirmada com o dono)

- **Não guardar o PDF no filesystem do servidor** — o Render tem disco **efêmero** (some a cada
  deploy/restart; disco persistente é pago). Também **não** usar `BYTEA` na Neon (infla banco/backup à toa).
- **Bucket R2 (Cloudflare)**: o `R2Service` já existe (`back/src/r2/`, S3-compatível, `@aws-sdk/client-s3`)
  e está **adormecido** (sem env não é configurado; `upload()` lança). Só precisa de envs:
  `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`.
- **PDF fica no R2; no banco só metadados** (URL + data + bytes + hash). `key` sugerida:
  `contratos/<slug>-<hash>.pdf`.
- **Privacidade (LGPD)**: contrato tem dado pessoal (nome/assinatura) — o download deve ser
  **autenticado** (dono da loja via `/admin/...`, ou super-admin). O `publicUrl` atual do `R2Service` é
  para mídia pública (logo) — para contrato não usar URL pública/exposta; servir **via endpoint da API**
  (o back busca no R2 e devolve o stream, autorizando por perfil).
- O conteúdo do contrato (chave PIX/contato do dono da plataforma) pode viver em `config_plataforma` /
  env — **nunca em log**.

### Passo a passo (quando implementar)

1. **Infra R2**: criar bucket na Cloudflare (ex.: `peditto-contratos`), gerar token API e preencher as 5 envs
   em `back/.env` (+ `back/.env.example`). `GET /health` pode refletir `r2Configured`.
2. **Schema**: tabela `contratos` (ou colunas em `lanchonetes`: `contratoUrl`, `contratoEnviadoEm`,
   `contratoHash`, `contratoBytes`). Se tabela própria: `id`, `lanchoneteId` (FK), `url`, `nomeArquivo`,
   `bytes`, `hash`, `uploadedById`, `createdAt` + `@@unique(lanchoneteId)` (1 contrato ativo por loja).
3. **Upload (super-admin)**: `POST /admin-sistema/lanchonetes/:id/contrato` (multipart, `AuthGuard` +
   `AdminSistemaGuard`) → grava no R2 (key `contratos/<slug>-<hash>.pdf`) + salva metadados + `registrarLog`
   "Contrato enviado" (sem conteúdo).
4. **Download (dono da loja)**: `GET /admin/lanchonetes/:slug/contrato` (dono-check 404) → busca no R2 e
   devolve `application/pdf` (stream/redirect autenticado). Disponibilizar link/botão "Baixar contrato" no
   `admin-config` + ao criar a loja.
5. **Download (super-admin)**: `GET /admin-sistema/lanchonetes/:id/contrato` (consulta já read-only).
6. **Registrar assinatura/adimplência** (opcional agora): campo `planoOrigem = 'fisico'` ou botão
   "Marcar como pago" já existente no F8.8 (liga `pago`, `planoExpira` null) — o contrato físico cobre isso.
7. **Orientações no contrato**: chave PIX + e-mail/whatsapp de contato configuráveis em `config_plataforma`
   ou env — o lojista envia o comprovante e o dono confere manualmente.

### Links úteis

- R2 (Cloudflare) — visão geral/preços: <https://developers.cloudflare.com/r2/>
- R2 S3 API (compatível com `@aws-sdk/client-s3`): <https://developers.cloudflare.com/r2/api/s3/api/>
- Render — disco efêmero/persistente: <https://render.com/docs/disks>

### Verificação

- Com o R2 configurado: super-admin faz upload de um PDF de teste → log "Contrato enviado"; dono da loja
  acessa `/admin/lanchonetes/:slug/contrato` autenticado e **baixa o PDF idêntico**. Sem `.env` do R2 →
  endpoint responde 503/erro claro (não 500).

---

## F8.9 — Segurança completa ✅ concluído (2026-09-22)

**Status**: ✅ concluído — ver `PLAN.md` seção F8.9
**Quem resolve**: assistente (código) + dono (origens reais pós-deploy, segredos)

### O que foi implementado

- **CORS restrito** (`back/src/main.ts`): `enableCors({ origin })` com a lista de `FRONT_URL` (default `http://localhost:4200`) + extras de `CORS_ORIGINS` (separadas por vírgula — é ali que entra o domínio real do Vercel depois do deploy). Sem `credentials` (front usa Bearer, não cookie). **Smoke**: `Origin: http://evil.com` → resposta **sem** `Access-Control-Allow-Origin`; `Origin: http://localhost:4200` → `ACAO=http://localhost:4200`.
- **Helmet** (`helmet@^8`, `crossOriginResourcePolicy: { policy: 'cross-origin' }` — o default `same-origin` bloquearia os `<img>` cross-origin de logos/galeria servidos por esta API) + `app.disable('x-powered-by')`. Headers presentes na resposta: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer`, `Strict-Transport-Security`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy: cross-origin`, dentre outros.
- **Rate limit** (`@nestjs/throttler@^6`, peer compatível com Nest 12): global **100 req/min por IP** via `ThrottlerModule.forRootAsync` + `APP_GUARD: ThrottlerGuard` (`back/src/app.module.ts`); **`@Throttle` 10/min** em `POST /auth/*` (todo o controller — `force bruta/enumeration`) e `POST /l/:slug/pedidos` (`spam de pedido`). `app.set('trust proxy', 1)` obrigatório no Render (senão todo mundo vira um IP só). `THROTTLE_DISABLED=true` desativa via `skipIf` (só p/ smoke local/e2e — **nunca em prod**). **Smoke**: 10×200 no `/auth/verificar-email`, 11ª e 12ª → **429**.
- **JWT da app**: validação no boot — `APP_JWT_SECRET` ausente ou < 32 bytes → **`throw` em produção** com mensagem clara (comando p/ gerar inclusa); em dev, `Logger.warn` (o `exchange` já falha fechado quando a chave é vazia).
- **Auditoria (sem mudança necessária)**: front renderiza 100% com interpolação `{{ }}` (zero `innerHTML`/`bypassSecurityTrust`); `registrarLog`/`ErroLogFilter`/scripts nunca gravam/imprimem `chavePix`/`brCodePix`/telefone/documento; único `$queryRawUnsafe` já é parametrizado (`$1`); validação de entrada segue o padrão manual do projeto.
- **Endurecimento pós-auditoria (2026-09-22, commit pós-F8.9)**: `requerSuper` em `criarAdmin`/`atualizarAdmin`/`removerAdmin`/`updatePlataforma` (admin humano recebe 403 mesmo via API); `GET /admin-sistema/lanchonetes/:id` mascara `chavePix` (`null`) para quem não é raiz; `THROTTLE_DISABLED=true` **derruba o boot em produção** (`main.ts`); `@Throttle` **5/min** em `/auth/verificar-email` (enumeração) e **30/min** nos GET públicos de lojas; CORS do WS espelhado (`FRONT_URL`+`CORS_ORIGINS` lidos via `process.env`, sem header `Origin` → libera); `jwtVerify` legado da Neon com `algorithms: ['EdDSA']` explícito; **removido** `configurarEmailPadrao` (o e-mail público do raiz não vira contato da home de graça — fica `null` até configurar); front esconde aba Configurações para não-super. Back `npm test` = **83** (+5: Forbidden p/ não-raiz ×3 e máscara de `chavePix` ×2).

### Passo a passo (para o dono, depois do deploy)

1. No `.env` do Render: `FRONT_URL=https://<seu-domínio-do-front>` e `CORS_ORIGINS=https://<seu-domínio>` (se houver mais de uma origem — ex.: preview da Vercel). Refletir também no console da Neon (`FRONT_URL`/origins de OAuth) se usarem Google sign-in.
2. `APP_JWT_SECRET` ≥ 32 bytes aleatórios (gerar com o comando do `.env.example`).
3. `THROTTLE_DISABLED` fica `false`/ausente em produção — o bootstrap **derruba a app** se estiver `true` com `NODE_ENV=production`.

### Verificação

- `npm run lint` (0), `npm test` (**83**; eram 78), `npm run e2e` (1 — o unhandled error do `PedidosMaintService` no e2e é pré-existente: tenta conectar no banco sem `DATABASE_URL`), `npm run build` — todos OK.
- Smokes do dia (feitos com `node dist/main` local): headers de segurança presentes, CORS externo bloqueado, 429 na 11ª chamada do `/auth/verificar-email`.

---

## Próximos itens (buffer)

> Decisões futuras a registrar aqui quando forem tomadas na conversa (ex.: F8.9 segurança,
> infra: Google OAuth no console Neon, R2 real, deploy Vercel/Render, testes karma).

---

## Lembrar de mim grava senha no localStorage — decisão do dono (2026-09-21)

**Status**: ✅ concluído (implementado desta forma por pedido explícito do dono)
**Quem resolve**: assinado — mas registrar o tradeoff para revisão futura

### Contexto

O "Lembrar de mim" passou a salvar **também a senha** (chave `auth.senha-salva` no `localStorage`, junto do
`auth.email-salvo`). Foi pedido explícito do dono. Isso **fragiliza a postura de segurança** descrita no
AGENTS.md (a política atual é manter segredos fora do `localStorage` — o JWT da app, por ex., vive só em
memória). O cookie do Neon Auth continua `HttpOnly`.

### Passo a passo (se um dia revisarmos)

- Marcar/clara senha ao deslogar? (hoje fica até o dono desmarcar o checkbox)
- Ou evoluir para "logar mantendo a sessão" via cookie de sessão longa da Neon (sem guardar a senha) —
  mais seguro e equivalente na prática.

### Verificação

- `auth.component.ts`: `alternarLembrar()` grava `SENHA_SALVA_KEY`; `ngOnInit` restaura senha junto do e-mail.