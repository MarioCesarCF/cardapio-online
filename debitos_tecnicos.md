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

## "Entre em contato" do painel do dono ainda não abre o WhatsApp (2026-09-26)

**Status**: `pendente`
**Quem resolve**: assistente (sob demanda do dono)

### Contexto

No painel de pedidos do dono (`front/src/app/pages/admin/admin-pedidos.component.ts`) o número do
WhatsApp do cliente aparece logo abaixo do nome (`rotuloWhatsapp()` — E.164 com `+55`, snapshot
`Pedido.clienteTelefone` com fallback para o perfil) e ao lado há o link discreto **"Entre em contato"**.
Hoje ele abre só uma `p-dialog` informativa: **é um placeholder**, não abre conversa real.

### Passo a passo

1. Trocar o `(onClick)` do botão por um `window.open` de `https://wa.me/<numero>`, com mensagem
   pré-preenchida e `encodeURIComponent` (ex.: número + resumo do pedido: nº, itens, total, forma
   de pagamento, endereço quando for entrega).
2. Manter o número sempre no formato E.164 sem `+` na URL do `wa.me` (o `+` faz parte da query
   `?text=`, não do path).
3. Decidir o texto por perfil: conversa com o cliente sobre **pagamento** é o caso principal, mas o
   mesmo link serve para entrega/retirada.
4. Abrir em nova aba (`_blank`) e cuidar do popup blocker (o `window.open` no clique é permitido).
5. Se o dono quiser, evoluir para mensagem variável com link de tracking — fora do escopo atual.

### Verificação

- No painel do dono, clicar em "Entre em contato" abre o WhatsApp Web/app com o número do cliente e o
  texto já preenchido; o placeholder `p-dialog` some do template.

---

## Confirmação manual do PIX: sem log de auditoria e sem notificação ao cliente (2026-09-26)

**Status**: `pendente`
**Quem resolve**: assistente (sob demanda do dono)

### Contexto

`PATCH /admin/pedidos/:idPedido/pagamento` (`back/src/admin/admin.service.ts` → `confirmarPagamento`)
grava `pixConfirmado`/`pixConfirmadoEm` e emite `pedido:status` no realtime (para o painel recarregar),
mas **não** chama `registrarLog` do `AdminSistemaService` — então confirmar/desfazer pagamento não
aparece na aba **Logs** do painel da plataforma, que hoje registra só ações administrativas.
O cliente descobre a confirmação por **polling de 20s** em `/meus-pedidos` (e no modal do cardápio),
não por push.

### Passo a passo

1. Injetar/registrar log em `confirmarPagamento`: mensagem "Pagamento confirmado"/"Confirmação de
   pagamento desfeita" com `{ pedidoId, numero, confirmado }` — **nunca** registrar `chavePix`,
   `brCodePix` ou qualquer dado do cliente (regra de LGPD/segurança do AGENTS.md).
2. Se o dono quiser uma UX melhor: avisar o cliente por WhatsApp na confirmação, reaproveitando
   `WhatsAppService` (que hoje só tem `enviarNovoPedido`) com um novo template Meta — depende da
   aprovação de template, então entra junto com o item F8.6.

### Verificação

- Confirmar e desfazer um pagamento no painel do dono e ver os 2 eventos na aba **Logs**.

---

## "Lembrar de mim" agora guarda SÓ o e-mail (senha removida — 2026-09-23)

**Status**: ✅ resolvido (decisão de segurança do dono, junto com a sessão).
**Quem resolve**: assinado — não voltar a gravar senha no `localStorage`.

### O que mudou

Antes (2026-09-21, pedido antigo do dono), o "Lembrar de mim" guardava **também a senha**
(chave `auth.senha-salva` no `localStorage`) — tradeoff frágil de segurança. Em 2026-09-23 o dono
pediu para **remover** e o front foi ajustado:

- A senha **nunca mais é gravada** em `localStorage` (nem na troca do checkbox, nem no submit).
- A chave legada `auth.senha-salva` de quem já tinha é **apagada ao carregar a página** (limpeza
  retroativa — `auth.component.ts` `ngOnInit`/`alternarLembrar`/submit → `removeItem`).
- Continua salvo **apenas o e-mail** (`auth.email-salvo`) — e-mail não é segredo; a senha fica só
  na memória (e o JWT da app continua apenas em memória; cookie do Neon Auth segue `HttpOnly`).

### Como manter

- Conveniência: e-mail vem preenchido; o usuário digita só a senha.
- Sessão persistente: o próprio Neon Auth ("Lembrar de mim" → `rememberMe` da Neon) mantém o cookie
  de sessão por muito tempo **sem** senha em disco — é isso que evita relogar a cada visita.

### Verificação

- `front/src/app/pages/auth/auth.component.ts`: `SENHA_SALVA_KEY` só em `removeItem` (nunca
  `setItem`); `EMAIL_SALVO_KEY` continua gravando/restaurando o e-mail. Front build OK.

---

## Termos/Privacidade — dados reais + revisão jurídica + promessas comerciais (pendente)

**Status**: `pendente` (bloqueia o lançamento comercial, **não** o desenvolvimento)
**Quem resolve**: dono (dados e decisão comercial) + advogado (revisão) + assistente (aplicar)

### O que já está pronto (versão 1.0, 2026-09-27)

- `/termos` e `/privacidade` públicas (`front/src/app/pages/termos/`, lazy, sem guard), com
  `legal.scss` compartilhado e o bloco `ContatoLgpdComponent` (e-mail de `GET /plataforma/email-lojista`).
- Termos (13 seções) cobre: papel do Peditto (plataforma ≠ relação de consumo), cadastro, uso como
  lanchonete, **PIX (confirmação manual hoje / provedores e automática só no futuro; e que o PIX fica
  indisponível no checkout enquanto a loja não tiver chave)**, cartão e dinheiro, cancelamento,
  responsabilidades, assinatura (**R$ 99,90/mês**, adesão presencial, sem
  cobrança automática), disponibilidade, alterações, segurança, encerramento, foro.
- Política (11 seções) cobre: papéis (controlador/operador), dados tratados, **finalidades por base
  legal** (execução de contrato / obrigação legal / legítimo interesse), **matriz de tratamento**
  (Dado | Quem fornece | Finalidade | Quem acessa | Retenção | Base legal), compartilhamentos
  (Neon, Vercel, Render, Meta/WhatsApp, Google, autoridades), transferência internacional (art. 33),
  segurança, **retenção** (conta/90 dias, pedidos ~24h atual + ~30d histórico, logs, fiscais),
  **dereitos do titular** (resposta em 15 dias; registramos também o que ainda **não** existe: exclusão de conta
  automática, download do cadastro, consentimento granular), alterações e contato.
- `TERMO_VERSAO_ATUAL = '1.0'` em `back/src/me/termo.ts` **e** `front/src/app/services/termos.ts`
  (manter em sincronia).
- **Decisão de 2026-09-27 (dono)**: o Peditto **ainda não está em produção**, então o texto é
  revisado **dentro da 1.0** — não há mais bump de versão por ajuste de redação. Ficou um registro
  `1.1` no banco de uma conta que aceitou na janela do bump (2026-09-27 13:05); é lixo inofensivo,
  o `termos_aceite` é `@@id([usuarioId, versao])` e o `upsert` com `update: {}` preserva a data do
  1º aceite. **Na virada para produção** a versão deve subir para 1.1 de verdade (ou o que o
  advogado definir), com data nova e aviso ao dono.
- Smoke validado: 13/11 seções, matriz 6 col × 9 linhas, aceite gravado no banco
  (`termos_aceite`) e tela de aceite aparecendo para quem não tem a versão vigente.

### Pendências

1. **Placeholders** — substituir em `termos.component.html` (seções 1 e 13) e `privacidade.component.html`
   (seção 1): `[RAZÃO SOCIAL — preencher antes do lançamento]`, `[CNPJ — preencher]`,
   `[ENDEREÇO — preencher]`. Buscar por `termos__pendente`.
2. **Revisão jurídica** — todo o texto é redigido por assistente, **sem** advogado. Pedir revisão de
   LGPD + CDC antes de divulgar os links.
3. **Confirmar as promessas comerciais** escritas no texto (o dono precisa validar cada uma):
   - período de teste de **30 dias**;
   - "sem fidelidade e sem multa" no cancelamento + acesso até o fim do período pago;
   - exclusão dos dados da lanchonete em até **90 dias** após o encerramento;
   - resposta a pedidos de titular em até **15 dias**;
   - aviso de mudança de preço com **30 dias** de antecedência;
   - **trial expirado bloqueia novos pedidos** (o back bloqueia — `pedidos.service.ts`);
   - **loja sem chave PIX não recebe pedido por PIX** (o back bloqueia — `geraPix`).
4. **Se mudar a versão**: subir `TERMO_VERSAO_ATUAL` nos **dois** arquivos e a data em
   `TERMO_ATUALIZADO_EM`; avisar o dono que todos logados verão a tela de aceite de novo.

### Verificação

- `/termos` e `/privacidade` abrem sem sessão, com versão 1.0 e sem `termos__pendente` aparecendo.
- `GET /me` traz `termoAceite.versao === '1.0'` depois do aceite; a data do 1º aceite não muda.

---

## Exportação de pedidos: confirmar retenção e compatibilidade no celular (2026-09-27)

**Status**: `parcial` — formato resolvido (virou `.xlsx` de verdade em 2026-09-27); falta a
decisão do dono sobre retenção
**Quem resolve**: dono (retenção) + assistente (ajustes)

### Contexto

A exportação para planilha é feita no front (sem back novo): `relatorio-pedidos.ts` gera um
**`.xlsx` (OOXML) de verdade** com 3 abas (Itens/Pedidos/Informações), baixado via Blob. O botão
"Exportar esta lista" respeita o filtro de status + Histórico/Atuais; "Exportar tudo" busca
atuais + histórico. A aba **Informações** avisa que o histórico some ~30 dias depois do pedido.

**Troca de formato (2026-09-27, segunda rodada)**: era **SpreadsheetML 2003** (`.xml`), que só
abre no Office — o Google Sheets do Android não importa. Agora é `.xlsx` (o mesmo pacote que o
Excel salva), gerado **sem lib externa**: `zip.ts` monta o ZIP (CRC-32 próprio + `deflate-raw` do
`CompressionStream`, com fallback para "store" se o navegador não tiver) e `relatorio-pedidos.ts`
escreve os XMLs (`[Content_Types].xml`, `_rels/.rels`, `docProps/*`, `xl/workbook.xml`,
`xl/_rels/workbook.xml.rels`, `xl/styles.xml`, `xl/worksheets/sheet1..3.xml`). Melhora em relação
ao XML antigo: data vira **número com formato** (`dd/mm/yyyy hh:mm`), valores são **números
somáveis** (`R$` no formato da célula, não no texto), cabeçalho **congelado** e **autofiltro**,
texto com escape de XML. Nomes de arquivo `.xlsx`. Nada disso entra no bundle inicial: o
componente faz `await import('../../services/relatorio-pedidos')` no clique (chunk de ~14 kB).

### Pendências

1. ~~**Testar no celular / formato alternativo**~~ → **resolvido**: é `.xlsx` agora, que é o
   formato que o Google Sheets do Android, o WPS e o Excel abrem. Validado abrindo o arquivo
   gerado no LibreOffice headless (converteu sem erro) e conferindo o ZIP/XML célula a célula.
   Falta só o dono abrir no celular dele para o visto final.
2. **Retenção**: hoje o histórico some sozinho (~24h atual, ~30d histórico — `PedidosMaintService`).
   Se o dono quiser preservar mais, o caminho é o download automático do arquivo para um bucket (R2) ou
   aumentar a janela em `pedidos-maint.service.ts` (impacta custo de banco e privacidade).
3. Ao mudar a retenção, **atualizar a seção 8 da Política de Privacidade** e o texto da aba
   Informações do relatório (para não divergir do que a política promete).

---

## Encerramento de conta: LGPD, retenção e o que ainda não existe (2026-09-27)

**Status**: `parcial` (fluxo entregue; falta decidir retenção do questionário e export de dados)
**Quem resolve**: dono (política de retenção) + dono/advogado (texto) + assistente (ajustes)

### O que foi entregue

- `RespostaEncerramento` (migração `20260927161029_m19_encerramento`): questionário **opcional**
  gravado com motivo estruturado (slugs), contexto de uso (`pedidosRecebidos`, `diasAtivo`) e o
  contato **só quando a lanchonete autoriza**.
- Duas entradas: **cliente** (home → "Encerrar conta") e **lanchonete** (admin-config → "Encerrar
  lanchonete"). Em ambas a página `/encerrar` confirma primeiro e sempre dá para pular o questionário.
- Painel da plataforma: aba **Encerramentos** (`/admin-sistema/encerramentos?dias=`) com motivos em
  %, fatores, preço considerado adequado, satisfação média, comentários e contatos.
- `DELETE /me/conta` (`MeService.excluirConta`): favorites → pedidos → termo de aceite → cliente →
  conta no Neon Auth, tudo best-effort na parte do Neon.

### Decisões que o dono precisa revisar

1. **Bloqueio com pedido em andamento** (decisão do assistente em 2026-09-27, o dono não foi
   consultado): se o cliente tem pedido em `recebido|em_preparo|enviado|saiu_para_entrega`, o
   encerramento é **recusado** — a lanchonete precisa do telefone/endereço para entregar. Se o
   dono preferir permitir, o caminho é apagar/anomizar o pedido também (mas aí a entrega quebra).
2. **Anonimização**: `clienteId`, `clienteTelefone` e `enderecoEntrega` vão para `NULL` nos pedidos do
   cliente. O histórico do pedido **continua na lanchonete** (ela precisa do histórico de vendas).
3. O contato liberado pela lanchonete é **dado pessoal**: só o admin **raiz** enxerga (admin humano
   recebe `null` no payload). Decisão do dono: **não** há notificação nem e-mail — só o painel.

### Pendências

1. **Retenção do questionário**: `RespostaEncerramento` não tem prazo de expurgo hoje. A Política de
   Privacidade promete retenção genérica; se o dono quiser, definir prazo (ex.: 24 meses) e um
   `PedidosMaintService`-like para limpar, **e** atualizar a seção de retenção da política.
2. **Direitos do titular que ainda não existem**: download do cadastro, exclusão de conta
   automática (hoje é na mão) e consentimento granular — já listados como "não existe" na
   `/privacidade`; se algum for implementado, atualizar o texto.
3. **Feedback de vitória**: não foi implementado (o dono marcou como fora do escopo). Continua só o
   encerramento.
4. Ao mudar qualquer texto do fluxo (terminos/privacidade), lembrar que a versão do termo é `1.0` e
   revisão de texto **não** sobe a versão antes de produção.

### Verificação

- Back: `npm run lint` (0), `npm test` (**132**), `npm run build`; front `npm run build`.
- Smoke de API (cliente + lanchonete + resumo + 403 de não-admin) e smoke de UI no Chrome headless
  (as 2 etapas renderizam, 5 notas, botões de pular/enviar).
- `cliente.teste@teste.dev` continua existindo (nenhum smoke rodou o botão destrutivo).

---

## AGPL transitivo no `front` (`@triplit/client`, `ua-parser-js` 2.x) — aceito, revisar na virada (2026-09-27)

**Status**: `aceito com justificativa` (nada a fazer no código agora; reavaliar se o front parar de usar o SDK da Neon)
**Quem resolve**: assistente (revisar quando a `@neondatabase/neon-js` sair da beta)

### Contexto

O scan de segurança (GitGuard/Syft) apontou licença **AGPL-3.0** em duas entradas do
`front/package-lock.json`. A cadeia é esta:

```
front -> @neondatabase/neon-js@0.7.0-beta
      -> @neondatabase/auth@0.5.0-beta
      -> @neondatabase/auth-ui@0.3.0-beta   (biblioteca de componentes REACT — não usamos)
      -> @daveyplate/better-auth-ui@3.4.0
         -> peer opcional: @triplit/client 1.0.50  (AGPL-3.0-only)  -> @triplit/react
         -> dep:          ua-parser-js 2.0.10     (AGPL-3.0-or-later)
```

Pontos que fecham o caso:

- Ambos entram no lock como **`"peer": true`** — são *peers* auto-instalados de uma lib React que o
  app **nunca importa** (a autenticação usa `createAuthClient` de `@neondatabase/neon-js/auth` direto;
  `auth-ui` é só a casca de UI da Neon).
- **Não vão para o bundle**: conferido no build real (`front/dist/front/browser/*.js`) — zero
  ocorrência de `triplit` / `ua-parser`. Nenhum código AGPL é distribuído ao usuário, logo a
  obrigação de copyleft (que é sobre *conveying*) não é acionada.
- `ua-parser-js` 0.7.41 (o do `karma`, **MIT**) continua no lock normalmente — o AGPL é só a cópia
  aninhada da `auth-ui`.
- `@neondatabase/auth` está na **última versão beta** (0.5.0-beta) — não há upgrade que remova isso.

### Passo a passo (se/quando mexer nisso)

1. Conferir de novo: `Select-String -Path front/dist/front/browser/*.js -Pattern "triplit|ua-parser"`.
2. Se a `@neondatabase/neon-js` sair da beta, ver se a `auth-ui` deixou de arrastar os peers AGPL e
   atualizar o `front/package-lock.json`.
3. Se o AGPL passar a entrar no bundle, aí sim é caso jurídico — as saídas são:
   (a) pedir licença comercial à Triplit, (b) trocar a lib de UI por uma MIT, ou (c) manter e
   assumir o risco (não recomendado para produto fechado).
4. Alternativa mais limpa de longo prazo: trocar `@neondatabase/neon-js` (que hoje é um pacote "full",
   com CLI + postgrest + auth-ui) pelo SDK de auth enxuto. **Não é prioridade** — funciona e é da Neon.

### Verificação

- `npm ls @triplit/client ua-parser-js` no `front` — esperado: 2 cópias, ambas sob
  `node_modules/@neondatabase/auth-ui/`.
- Bundle sem nenhuma das strings.
