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

## Etapa 11 — Separação de perfis: Lanchonete × Cliente × Admin (pendente)

**Status**: `pendente` (etapa planejada por último — ver PLAN.md)
**Quem resolve**: assistente + decisões do dono (multi-perfil)

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

## Próximos itens (buffer)

> Decisões futuras a registrar aqui quando forem tomadas na conversa (ex.: F8.7 cardápio com IA, F8.8 planos,
> F8.9 segurança, F8.10 termos, infra: Google OAuth no console Neon, R2 real, deploy Vercel/Render, testes karma).

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