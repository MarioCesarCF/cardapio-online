# Cardápio Online — Plano do Projeto

## 0. Andamento (atualizado em 2026-09-21)

> O app foi reconstruído por papel (plataforma → dono → cliente). Docs técnicos dos módulos em `AGENTS.md`; contas de teste em `CREDENCIAIS-TESTE.md`.

### Concluído
- **Etapa 1 — Painel da plataforma (super-admin)**: teve 2 faixas; as decisões do usuário que prevalecem:
  - consulta read-only (`/admin-sistema/lanchonetes[:id]` + `/cardapio` + `/pedidos`), situação `pendente|ativa|pausada`, logs de ação/erro (inclusive 5xx automáticos), gestão de admins e exclusão **só por mim (`super`)** — com log.
  - app do dono SEM o "meu cadastro" da seção Loja (dono não gerencia situação).
- **Etapa 2 — Dono pendente + diretório**: lanchonete nova nasce `pendente`; dono prepara config/cardápio mas a aba Pedidos mostra "Loja indisponível"; diretório (`GET /l`) = só lojas **ativas**, mas **sem página pública** — a **home (`/`) virou a tela de login** e só o link `/{slug}` é aberto sem conta; `slug` editável + botão copiar link.
- **Etapa 3 — Fluxo do cliente**: WhatsApp no checkout (obrigatório na 1ª compra, salvo em `PATCH /me` + snapshot `pedido.clienteTelefone`), login Google, sessão ~7 dias, `/me` perfil+endereços, `meus-pedidos` com QR PIX, link da loja e "Pedir de novo".
- **Etapa 4 — Cadeia nova de status dos pedidos (concluída)**: status agora `recebido→em_preparo→enviado→entregue→finalizado`, com `cancelado` (só antes de sair pra entrega) e **justificativa obrigatória** em `pedido.justificativaCancelamento`. Dono avança uma etapa por vez no painel (`admin-pedidos` tem fluxo "próximo status" + botão "Cancelar pedido" com textarea de motivo); `PATCH /admin/pedidos/:idPedido/status` valida transições/justificativa e o realtime segue com `pedido:status`. Cliente vê o motivo do cancelamento e o PIX fica disponível de `recebido` até `enviado` (`STATUS_COM_PIX`).
- **Etapa 5 — Identidade da home + contato para lojistas (concluída)**: tabela `config_plataforma` (`m9_plataforma_email_lojista`, linha única) guarda o **e-mail de contato** que aparece na página principal do cliente para quem quer abrir loja; editável pelo admin no painel (aba Configurações) via `GET/PATCH /admin-sistema/plataforma` e exposto publicamente em `GET /plataforma/email-lojista`. A home passou a se chamar **"Página principal"**, ganhou "Lanchonetes favoritas" como subtítulo antes do filtro e uma seção `mailto` "Quer vender pelo Cardápio Online?"; o link do cardápio virou "Página principal". Default do e-mail no boot = e-mail do admin raiz.
- **Etapa 6 — Login: olhinho, lembrar de mim e recuperação de senha (concluída)**: tela de auth ganhou botão de **mostrar/ocultar senha**, checkbox **"Lembrar de mim"** (persiste e-mail + `rememberMe` no sign-in) e **"Esqueci senha"** que pede o e-mail, confirma cadastro via novo `POST /auth/verificar-email` e dispara o link de redefinição do Neon Auth (`requestPasswordReset`). O link cai em `/auth?esqueci=1&token=…` com tela própria de **nova senha + confirmação** → `resetPassword` sobrescreve a senha. Fluxo de link+reset 100% validado em smoke (senha do `cliente.teste` trocada e revertida); entrega real do e-mail depende da config de e-mail da Neon (infra em aberto).
- **Bases**: M1 (core), `m4*` (admin_sistema), `m5` (situacao+logs, backfill), `m6` (cliente_telefone), `m7` (lanchonetes_favoritas), `m8` (pedido_status_justificativa), `m9` (plataforma_email_lojista), `m10` (pedido_tipo_entrega), `m11` (lanchonete_horarios). Seed `npm run seed:teste` e galeria `npm run seed:galeria` (Pexels → URL, R2 só com env).

### Falta fazer
- **Infra/higiene**: configurar OAuth Google no console Neon (hoje dev usa usuários compartilhados); ativar R2 real (galeria evolui de URL Pexels → upload do `R2Service`); **WhatsApp (F8.6)**: confirmar o envio com o número de TESTE da Meta (criar app + `WA_GRAPH_TOKEN`/`WA_PHONE_NUMBER_ID` e rodar `npm run testar:whatsapp` — em aberto, requer o dono); **recuperação de senha**: o envio do e-mail é do próprio **Neon Auth** — configurar remetente/SMTP (ex.: Gmail com App Password) no **console da Neon** (nosso back não envia e-mail); deploy Vercel (front) + Render (back); correr testes karma do front (precisam de Chrome).
- **Etapa 7 — Importação de cardápio com IA (planejada)**: ver seção própria abaixo.
- **Etapa 11 — Separação de perfis (Lanchonete × Cliente × Admin)**: planejada **por último** — ver seção própria abaixo.

### Etapa 8 — Novas demandas (2026-09-21)
Implementação **gradual em fases** (cada fase termina com build + testes do back e build do front):
- **F8.1 — Tipo de pedido ✅**: `Pedido.tipoEntrega String @default("entrega")` (migração `m10_pedido_tipo_entrega`); `POST /l/:slug/pedidos` aceita `tipoEntrega` (`entrega|retirar|consumir`, default `entrega`, inválido → 400) e **só exige endereço quando `entrega`**; exposto no `formataPedido` (painel + histórico) e na resposta do POST. Front: checkout com **Entrega marcado por padrão**, `retirar`/`consumir` ocultam o bloco de endereço; badges no painel do dono, em meus-pedidos e no modal/barra do pedido.
- **F8.2 — Aviso de pagamento presencial ✅**: no checkout, quando `cartao`/`dinheiro`, subtexto bem próximo do checkbox — dinâmico conforme o tipo de pedido: "Pagamento será realizado no momento da entrega." / "…da retirada." / "…no local." (front puro, `avisoPagamento()` + `.pago-delay`).
- **F8.3 — Horário de funcionamento + bloqueio ✅**: `Lanchonete.horarios Json?` (migração `m11_lanchonete_horarios`, formato `[{dia 0-6, aberto, inicio "HH:MM", fim "HH:MM"}]`, **dia 0 = domingo** — `Date.getDay()`); validação estrutural no `updateConfig` (`validaHorarios`: 7 itens, dia único, HH:MM válido, fim depois do início ou `00:00` = meia-noite, dias fechados normalizados com inicio/fim null); helper puro `estaDentroDoHorario()` em `back/src/pedidos/horarios.ts` (8 specs — minuto antes/depois, fim 00:00, dia fechado, sem horários não bloqueia), usado em `criaPedido` → 400 "Lanchonete fora do horário de funcionamento." (sem detalhes sensíveis); exposto em `toConfig` (painel do dono) e no `GET /l/:slug/config`. Front: seção "Horário de funcionamento" no `admin-config` (7 linhas: dia + toggle + início/fim com `<input type="time">`, validação pt-BR no rodapé via `validaHorarios` compartilhado em `front/src/app/services/horarios.ts`) e cardápio público mostra resumo (`horarioResumo` — ex.: "TER a QUA 16h–22h") com badge "aberto/fechado agora" + guarda no `confirmarPedido` (front é só UX; bloqueio real é server-side).
- **F8.4 — PIX real (correção) ✅**: causa confirmada — a chave do Duarte no dev estava **crua sem `+55`** (o BR Code embutia `27995077806` em vez de `+5527995077806`). `normalizarChavePix()` em `back/src/pedidos/pix.ts`: telefone → dígitos + `+55` (CPF de 11 dígitos desambiguado por dígito verificador, senão vira telefone), e-mail → trim+minúsculas, CPF/CNPJ → só dígitos, aleatória → trim; **idempotente** e usada **no save** (`validaChavePix` no `updateConfig`, vazio limpa, não-string → 400) e **dentro do `gerarBrCode`** (defesa em profundidade). Script retroativo `npm run corrigir:chaves-pix` (roda `dist/pedidos/pix.js`, então exige `npm run build` antes; **nunca imprime chaves**) — no dev normalizou 1 chave (Duarte, telefone) sem tocar nas 3 corretas e é idempotente (2ª execução: 0 alteradas). Testes em `pix.spec.ts`: +6 de normalização (máscaras, DDI, CPF×telefone, idempotência) e decodificação **independente** do payload EMV (parsing TLV + conferência do campo 26/01 e do CRC). Back `npm test` = **56**. **Pendente (requer dono)**: re-teste do QR com a **chave real do banco do dono** — se ainda falhar no app, validar o payload de debug app a app.
- **F8.5 — E-mail ➡️ cancelado por decisão do dono**: implementei `EmailService` (Resend via fetch) + tabela `parametros` (`m12`) + notificação de pedido por e-mail, mas depois de avaliar o custo de dependências decidimos **remover por completo** (migração `m13_remove_email` dropa a tabela `parametros` e a coluna `notifEmail`). **Notificações de novo pedido ficam só no painel (realtime) + WhatsApp (F8.6); as notificações de pedido NÃO usam e-mail.** E a **recuperação de senha não usa o nosso back**: quem envia o e-mail de reset é o próprio **Neon Auth** — para usar o seu Gmail, configure SMTP (host `smtp.gmail.com`, porta 465/587, usuário + **App Password**, from) no **console da Neon** (projeto → Auth/e-mail), sem mexer no código.
- **F8.6 — WhatsApp (notificação ao dono) ✅ (validação do envio pronta)**: escolhemos a **Meta WhatsApp Cloud API** (oficial). `WhatsAppModule` `@Global` implementado (`normalizarNumeroWhatsApp` + `enviarTemplate`/`enviarNovoPedido` com os coringas `{1}..{5}`); hook em `criaPedido` quando `notifWhatsapp` (+ default `false`, envio ficou **desligado** — dono só queria validar); nunca loga token/payload. `npm run testar:whatsapp` envia o template (default `hello_world`) para `27998927442` usando o **número de TESTE** da Meta (grátis, até 5 destinatários). **Pendente (requer dono)**: criar o app na Meta (developers.facebook.com → WhatsApp → API Setup), preencher `WA_GRAPH_TOKEN`/`WA_PHONE_NUMBER_ID` no `back/.env` e rodar `npm run build` + `npm run testar:whatsapp` para **confirmar o recebimento no celular**. Para produção: Business Account + verificação + número real `27995077806` + template aprovado (`pedido_novo`, pt_BR).
- **F8.7 — Cardápio com IA (texto | planilha | foto | voz)**: ver Etapa 7 + **voz** via Gemini multimodal (transcrição embutida — ditar cardápio). Possibilidades apresentadas ao usuário antes de implementar.
- **F8.8 — Planos de assinatura**: `Lanchonete.plano String?` (`trial|pago`) + `planoExpira DateTime?`; loja nova nasce `trial` (30d); admin-sistema alterna para `pago` (R$ 149,90/mês) quando assinar. Landing page e gateway depois.
- **F8.9 — Segurança (preliminar)**: CORS liberado em `main.ts`, sem rate limit, sem Helmet, cuidado com secrets em logs. Fase dedicada depois que o usuário trouxer mais detalhes.
- **F8.10 — LGPD + Termo de Uso**: página pública `/termos` + checkbox de consentimento no cadastro; modelo do termo em debate (ver bate-papo).

### Etapa 11 — Separação de perfis: Lanchonete × Cliente × Admin (planejada — fica por último)

**Pedido do dono (2026-09-21)**: separar bem as responsabilidades por perfil. Cada perfil só deve ver o que lhe convém (ex.: dono de lanchonete não deve cair na área do cliente).

**Causa do bug relatado**: o `authGuard` do front (`front/src/app/guards/auth.guard.ts`) só checa **autenticação** (`isAuthenticated`), sem saber o perfil — então qualquer logado navega para qualquer rota protegida: `/home` e `/meus-pedidos` (área cliente), `/onboarding`, `/admin` e `/admin/:slug/*` (área dono), `/painel-admin` (área plataforma). Com o login de uma lanchonete o dono consegue abrir a área do cliente (`/home`).

**O que já está protegido (back, defense in depth)**:
- `/admin/*`: dono-check no `AdminModule` (quem não é dono recebe 404) + `POST /admin/lanchonetes` aberto a qualquer logado (é assim que alguém vira dono).
- `/admin-sistema/*`: `AdminSistemaGuard` (403 para quem não está na tabela `admin_sistema`).
- Áreas de cliente (`/me*`, `/favoritas`, `POST /l/:slug/pedidos`): abertas a qualquer autenticado — todo usuário Neon vira registro em `clientes` automaticamente (design atual).

**Ressalva do modelo**: um mesmo usuário pode **acumular perfis** (ex.: dono que também tem registro de cliente e/ou `admin_sistema`). "Perfil exclusivo" é impossível no modelo atual; o objetivo realista é: **redirecionar para o perfil principal** e **bloquear/explicar** áreas de outros perfis que o usuário não tem.

**Passo a passo (sugestão para quando for implementar)**:
1. **Fonte dos perfis**: `GET /me` já retorna `cliente`, `lanchonetes`, `adminSistema` e `adminSistemaFuncao` — suficiente, sem mudança de schema.
2. **Centralizar perfis no front**: criar `front/src/app/services/perfil.service.ts` (computeds: `ehCliente`, `ehDono`, `ehAdminSistema`, `perfilPrincipal()` = admin-sistema > dono > cliente) consumindo `AuthService` + `/me` — consolida a regra que hoje vive espalhada em `posLogin` (auth.component.ts), `admin-home`, `admin-shell` e painel.
3. **Guard por perfil** (ex.: `perfilGuard('dono')`) que carrega `/me` e libera só as rotas do perfil:
   - cliente → `/home`, `/meus-pedidos`, `/favoritas` (via `/home`);
   - dono → `/admin`, `/admin/:slug/*`;
   - admin-sistema → `/painel-admin`.
   Quem não tem o perfil: redireciona para o perfil principal (ex.: cliente tentando `/admin` → convite "Quer vender pelo Peditto?"; dono tentando `/home` → volta pro `/admin/:slug/config`).
4. **Decidir o caso multi-perfil** (ex.: dono que também é cliente): manter acesso explícito via link "Área do cliente" no painel do dono vs. bloqueio total — **definir com o dono na fase**.
5. **Navegação/UI**: mostrar apenas os links/menus do perfil atual (home do cliente, abas do shell do dono, painel da plataforma).
6. **Verificação**: com as contas de teste (`lojista.duarte@…`, `cliente.teste@…`, `admin@…`) conferir que cada uma só abre as rotas do próprio perfil e, fora delas, cai no redirect correto (sem tela em branco/erros).

---

### Etapa 7 — Importação de cardápio com IA (planejada, 2026-09-20)
Dono monta o cardápio mandando **texto corrido, planilha ou fotos do menu físico**; a IA estrutura tudo no schema existente (categorias/produtos/grupos/opções) e grava via o mesmo pipeline do `AdminService`, depois de uma **revisão em rascunho** (nada publicado direto).

- **Custo de API ≈ zero**: gpt-5-mini paga U$0,25/M entrada + U$2/M saída; Gemini 2.5 Flash U$0,30/M (texto/imagem) + U$2,50/M, com free tier. Um cardápio de 3–8 fotos custa **~U$0,02–0,05**; texto/planilha, frações de centavo. O custo real é o tempo de dev (~2–4 semanas para v1 sólida; MVP só de texto ~1 semana).
- **Arquitetura p/ este codebase**: tudo **server-side** no NestJS (`src/importacao-cardapio/`), `POST /l/:slug/cardapio/importacao` (multipart p/ fotos; JSON/form p/ texto e `.xlsx`). Prompt forçando **JSON no schema exato** do app; validação reaproveitada do CRUD atual. Provider recomendado: **Gemini Flash** (visão barata/boa p/ cardápio físico). Chaves só em `back/.env` (nunca no Angular).
- **Ordem sugerida**: 1º texto colado → 2º planilha (parse `.xlsx` server-side + mapeamento de colunas) → 3º fotos (visão). Bônus grátis: sugerir imagens da galeria já existente (`GET /galeria`) por categoria.
- **Provider escolhido (2026-09-20): Gemini Flash** — visão barata/boa para cardápio físico. Em aberto: profundidade do fluxo de revisão (rascunho em modal vs. wizard) e se entra na Fase 1 ou vira diferencial pós-lançamento.
- **A avaliar — comando de voz (2026-09-20)**: estudar viabilidade de o dono **ditar o cardápio por voz** (nomes/preços/descrições) como input para a criação assistida, além de texto/planilha/fotos — ex.: `Nova categoria "bebidas"...`, `Adiciona Coca-Cola a R$ 6...`. Apostas: transcrição (STT) no próprio Gemini (multimodal recebe áudio direto) eliminaria dependência de STT externo; validar precisão com sotaques/nomes de produtos e ruído ao vivo, enquadrar como mais um modo de entrada da Etapa 7, e decidir se entra no MVP ou só após validar texto/planilha/fotos.

---

## 1. Visão

Plataforma para lanchonetes pequenas criarem e operarem seu próprio cardápio online, com pedidos, PIX e personalização visual (logo, nome, fonte, cores). Sem custo de aluguel de aplicativo e com controle total do dono.

### Público
- **Donos de lanchonetes**: criam a página, cadastram o cardápio e acompanham pedidos.
- **Clientes finais**: navegam, montam o pedido e pagam via PIX.

---

## 2. Escopo da Fase 1 (MVP)

### Módulo cliente (página pública)
- URL única por lanchonete: `/{slug}` (ex: `sabor-da-vila`).
- Cardápio por categorias; produto com: nome, descrição, preço, imagem (galeria própria) e grupos de opções.
- **Grupos de opções** ("adicionais e remoções"):
  - seleção única (ex: ponto da carne) ou múltipla (ex: adicionais);
  - opções com preço adicional ou remoção de ingrediente.
- Carrinho lateral + checkout.
- **Login do cliente**: **Neon Auth** (Managed Better Auth) — e-mail/senha, Google/Facebook, magic link e OTP; usuários e sessões gravados na própria base.
- Endereço de entrega (salvo ou novo) e observações.
- Pagamento **PIX estático**: QR Code + código copia-e-cola.

### Módulo lanchonete (painel `/admin`)
- **Pedidos em tempo real** (WebSocket + fallback de polling) com gestão de status (recebido → em preparo → enviado → entregue → finalizado; cancelado com justificativa).
- CRUD de categorias, produtos e grupos de opções.
- Configurações visuais: **logo (tamanho padrão)**, **nome**, **fonte estilizada**, cores.
- Informações de contato: WhatsApp, e-mail, endereço da loja.
- Chave PIX (chave + nome do titular).
- **Preferências de notificação**: o dono marca os canais que deseja de uma lista definida:
  - **Painel** (padrão; tempo real via WebSocket);
  - **WhatsApp**;
  - **E-mail**.

### Pagamento (Fase 1)
- **PIX estático**: geramos o "BR Code" (código copia-e-cola) a partir da chave fixa da loja, já com o valor total, e renderizamos o QR.
- Confirmação manual: a lanchonete marca o pedido como pago no painel.
- **Fase 2 (candidata)**: integração com gateway (Mercado Pago / PagSeguro) para cobrança dinâmica e confirmação automática — será validada depois com algo prático e gratuito/barato.

### Imagens
- **Galeria própria** curada por categoria (hambúrguer, pizza, batata, bebidas...), armazenada no **Cloudflare R2**.
- A imagem escolhida já fica persistida no nosso storage — sem depender de URL externa (evita link quebrado, hotlink bloqueado e mudança de licença).
- Acesso público no MVP via subdomínio `*.r2.dev` do R2; custom domain quando formos para produção.
- Banco de imagens gratuito usado como fonte inicial (Unsplash/Pexels), com download para o R2.

---

## 3. Fora de escopo (Fase 1)

- Confirmação automática de pagamento (PIX dinâmico/gateway).
- Cupons, fidelidade ou vouchers.
- Mínimo de pedido / taxa de entrega por distância.
- Roteirização de entrega ou mapa em tempo real.
- App nativo (potencial PWA depois).
- Upload de fotos próprias pela lanchonete (por enquanto, só galeria).

---

## 4. Arquitetura

| Camada      | Stack                                                        | Hospedagem |
|-------------|--------------------------------------------------------------|------------|
| Front       | Angular 20 (standalone + signals)                            | Vercel     |
| Back/API    | Node.js + NestJS 12 (REST + WebSocket, TypeScript)           | Render     |
| Banco       | PostgreSQL serverless (**Neon**) via **Prisma**              | Neon       |
| Auth        | **Neon Auth** (Managed Better Auth, beta)                    | Neon       |
| Storage     | Cloudflare **R2** (galeria de imagens)                       | Cloudflare |
| E-mail      | Reset de senha enviado pelo **Neon Auth** (SMTP no console da Neon) | Neon     |
| Realtime    | Socket.io (gateway no NestJS), fallback de polling           | Render     |

### Responsabilidades (back é o dono dos dados)
- Sem Supabase: **Auth via Neon Auth** (gerenciado e grátis até 60k MAU/mês), **Storage e Realtime próprios** no NestJS.
- **Auth**: usuários, sessões e configuração OAuth ficam no Postgres, schema `neon_auth` (o Neon cria automaticamente). O front usa o SDK `@neondatabase/neon-js` (login e-mail/senha, Google/Facebook, OTP); o back valida as sessões pelas tabelas `neon_auth` nas rotas protegidas.
- **Acesso a dados**: a API é a única camada que toca as tabelas de negócio (via Prisma), então não usamos RLS nessas tabelas.
- **Notificações**: feitas pelo back após a criação do pedido, conforme canais ativos na loja.

---

## 5. Modelo de dados (core)

### Configuração / catálogo
- `lanchonetes` — nome, `slug` único, logo_url, fonte, cor_principal, chave_pix, nome_pix, whatsapp, email_contato, endereco_loja, `notificacao_prefs` (painel/whatsapp/email), ativa.
- `categorias` — lanchonete_id, nome, posicao, imagem_url, ativa.
- `produtos` — categoria_id, nome, descricao, preco, imagem_url, destaque, ativo.
- `grupos_opcoes` — lanchonete_id, nome, `tipo` (unica | multipla), `obrigatorio`, min/max seleções.
- `opcoes` — grupo_id, nome, preco_adicional, ativa (remoções são opções com preço 0 e flag `remove`).
- `produto_grupos` — pivô produto ↔ grupo de opções (com ordem).

### Cliente
- `clientes` — id, nome, telefone, email (único).
- `enderecos` — cliente_id, rua, numero, complemento, bairro, cidade, uf, cep, lat/lng (quando possível), apelido, padrao.

### Pedidos
- `pedidos` — numero (sequencial por loja), lanchonete_id, cliente_id, status, subtotal, total, forma_pagamento, br_code_pix, endereco_entrega (snapshot), observacao, created_at.
- `pedido_itens` — pedido_id, produto_id, nome_snapshot, preco_unit, qtd.
- `pedido_item_opcoes` — pedido_item_id, opcao_id, nome_snapshot, preco_adicional.

> Snapshot de nome/preço: histórico fica preservado mesmo se o cardápio mudar.
> Migrations versionadas no Prisma (`prisma/migrations/`).

---

## 6. API (principais rotas)

### Público
- `GET /l/:slug/cardapio` — categorias + produtos + grupos de opções ativos.
- `POST /l/:slug/pedidos` — cria pedido (autenticado).
- `GET /l/:slug/config` — dados públicos de exibição (nome, logo, fonte, cores, horários).

### Autenticado (cliente)
- `GET /me` / `PUT /me` — perfil do cliente.
- `GET / POST /me/enderecos`, `DELETE /me/enderecos/:id`.
- `GET /me/pedidos` — histórico.

### Autenticado (dono)
- CRUD `categorias`, `produtos`, `grupos_opcoes`, `opcoes`.
- `GET/PUT /admin/config` — configurações visuais, contato, PIX, notificações.
- `GET /admin/pedidos` + `PATCH /admin/pedidos/:id/status`.

### Auth
- Fluxos de login/registro via **Neon Auth** (SDK `@neondatabase/neon-js` no front; e-mail/senha + OAuth configurados na Console da Neon).
- Rotas protegidas: o back valida a sessão nas tabelas `neon_auth` (mesmo banco, via Prisma).
- Infra: `GET /health` — verificação de conexão com o banco (Neon via Prisma).

---

## 7. Fluxos principais

### Pedido
1. Cliente abre `/{slug}`, vê categorias/produtos e adiciona ao carrinho.
2. No checkout, faz login (e-mail/senha; Google/Facebook depois) e escolhe/reusa endereço.
3. Sistema gera PIX estático (QR + copia-e-cola) com o valor total.
4. Pedido criado → notificação para os canais ativos da loja (painel em tempo real via WebSocket, WhatsApp e/ou e-mail).
5. Dono atualiza status; cliente vê o status no seu histórico.

### PIX estático
- Preço total é embutido no código offline (BR Code).
- Não há confirmação automática: o dono valida a entrada no painel.

### Notificações
- Lista fixa de canais: **painel**, **whatsapp**, **email** — o dono ativa os que quiser.
- WebSocket (Socket.io) no NestJS para o painel; fallback de polling se a conexão persistente cair.

---

## 8. Milestones

- **M0 — Setup**: monorepo `front/` + `back/`, lint, Neon + Prisma conectado, `GET /health` checando o banco.
- **M1 — Auth e página pública**: integrar **Neon Auth** (login dono e cliente), `slug`, cardápio público lendo do banco.
- **M2 — Painel de configuração**: logo, nome, fonte, cores, contato, PIX + CRUD completo do cardápio com grupos de opções.
- **M3 — Checkout**: carrinho, login cliente, endereços salvos, pedido persistido, PIX estático.
- **M4 — Pedidos e notificações**: painel em tempo real (WebSocket), WhatsApp (Evolution API a validar), gestão de status. (Sem e-mail de pedido — decisão do dono.)
- **M5 — Imagens e deploy**: seed da galeria no R2, polimento visual, deploy Vercel + Render.

---

## 9. Riscos e decisões em aberto

- **WhatsApp**: validar API gratuita/barata (Evolution API self-host vs. alternativas). Painel é o canal padrão e não depende disso.
- **Neon Auth**: produto em **beta**; documentação ainda centrada em Next.js/React — no NestJS, validamos a sessão pelas tabelas `neon_auth` (mesmo banco) ou pelo adaptador vanilla do SDK. Se a beta der problema na fase inicial, voltamos ao plano de auth próprio (JWT no back).
- **Render free tier**: serviço "dorme" e tem latência no primeiro acesso (~50s); contornar com ping periódico ou plano mínimo. Conexões WebSocket caem no idle — por isso o fallback de polling.
- **Fonte/dependências do host**: hospedar as fontes estilizadas localmente (evitar depender do Google Fonts).
- **Neon free tier**: limitações de tamanho de dados e de "compute" no plano grátis — suficiente para o MVP; revisar quando precisar crescer.
- **R2**: acesso público por custom domain na produção (o `r2.dev` serve para o MVP).
- **Modelo de receita (futuro)**: mensalidade por lanchonete vs. percentual — fora da fase 1.
- **Nomes**: definir nome/domínio da plataforma e padrão de subdomínio/rota por loja.

---

## 10. Estrutura do repositório

```
cardapio-online/
├── PLAN.md
├── README.md
├── front/                      # Angular 20 (Vercel)
│   └── src/environments/       # apiUrl
└── back/                       # NestJS API (Render)
    ├── .env.example            # DATABASE_URL, PORT
    ├── prisma/schema.prisma    # modelo de dados + migrations
    └── src/prisma/             # PrismaService (conector global)
```