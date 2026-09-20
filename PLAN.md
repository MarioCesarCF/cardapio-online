# Cardápio Online — Plano do Projeto

## 0. Andamento (atualizado em 2026-09-20)

> O app foi reconstruído por papel (plataforma → dono → cliente). Docs técnicos dos módulos em `AGENTS.md`; contas de teste em `CREDENCIAIS-TESTE.md`.

### Concluído
- **Etapa 1 — Painel da plataforma (super-admin)**: teve 2 faixas; as decisões do usuário que prevalecem:
  - consulta read-only (`/admin-sistema/lanchonetes[:id]` + `/cardapio` + `/pedidos`), situação `pendente|ativa|pausada`, logs de ação/erro (inclusive 5xx automáticos), gestão de admins e exclusão **só por mim (`super`)** — com log.
  - app do dono SEM o "meu cadastro" da seção Loja (dono não gerencia situação).
- **Etapa 2 — Dono pendente + diretório**: lanchonete nova nasce `pendente`; dono prepara config/cardápio mas a aba Pedidos mostra "Loja indisponível"; diretório (`GET /l`) = só lojas **ativas**, mas **sem página pública** — a **home (`/`) virou a tela de login** e só o link `/{slug}` é aberto sem conta; `slug` editável + botão copiar link.
- **Etapa 3 — Fluxo do cliente**: WhatsApp no checkout (obrigatório na 1ª compra, salvo em `PATCH /me` + snapshot `pedido.clienteTelefone`), login Google, sessão ~7 dias, `/me` perfil+endereços, `meus-pedidos` com QR PIX, link da loja e "Pedir de novo".
- **Etapa 4 — Cadeia nova de status dos pedidos (concluída)**: status agora `recebido→aceito→em_preparo→concluido→enviado→entregue→finalizado`, com `cancelado` (só antes de sair pra entrega) e **justificativa obrigatória** em `pedido.justificativaCancelamento`. Dono avança uma etapa por vez no painel (`admin-pedidos` tem fluxo "próximo status" + botão "Cancelar pedido" com textarea de motivo); `PATCH /admin/pedidos/:idPedido/status` valida transições/justificativa e o realtime segue com `pedido:status`. Cliente vê o motivo do cancelamento e o PIX fica disponível de `recebido` até `enviado` (`STATUS_COM_PIX`).
- **Etapa 5 — Identidade da home + contato para lojistas (concluída)**: tabela `config_plataforma` (`m9_plataforma_email_lojista`, linha única) guarda o **e-mail de contato** que aparece na página principal do cliente para quem quer abrir loja; editável pelo admin no painel (aba Configurações) via `GET/PATCH /admin-sistema/plataforma` e exposto publicamente em `GET /plataforma/email-lojista`. A home passou a se chamar **"Página principal"**, ganhou "Lanchonetes favoritas" como subtítulo antes do filtro e uma seção `mailto` "Quer vender pelo Cardápio Online?"; o link do cardápio virou "Página principal". Default do e-mail no boot = e-mail do admin raiz.
- **Etapa 6 — Login: olhinho, lembrar de mim e recuperação de senha (concluída)**: tela de auth ganhou botão de **mostrar/ocultar senha**, checkbox **"Lembrar de mim"** (persiste e-mail + `rememberMe` no sign-in) e **"Esqueci senha"** que pede o e-mail, confirma cadastro via novo `POST /auth/verificar-email` e dispara o link de redefinição do Neon Auth (`requestPasswordReset`). O link cai em `/auth?esqueci=1&token=…` com tela própria de **nova senha + confirmação** → `resetPassword` sobrescreve a senha. Fluxo de link+reset 100% validado em smoke (senha do `cliente.teste` trocada e revertida); entrega real do e-mail depende da config de e-mail da Neon (infra em aberto).
- **Bases**: M1 (core), `m4*` (admin_sistema), `m5` (situacao+logs, backfill), `m6` (cliente_telefone), `m7` (lanchonetes_favoritas), `m8` (pedido_status_justificativa), `m9` (plataforma_email_lojista). Seed `npm run seed:teste` e galeria `npm run seed:galeria` (Pexels → URL, R2 só com env).

### Falta fazer
- **Infra/higiene**: configurar OAuth Google no console Neon (hoje dev usa usuários compartilhados); ativar R2 real (galeria evolui de URL Pexels → upload do `R2Service`); notificações WhatsApp (Evolution API a validar) e e-mail (Resend); deploy Vercel (front) + Render (back); correr testes karma do front (precisam de Chrome).

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
- **Pedidos em tempo real** (WebSocket + fallback de polling) com gestão de status (recebido → aceito → em preparo → concluído → enviado → entregue → finalizado; cancelado com justificativa).
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
| E-mail      | Resend (reset de senha, notificações)                        | Resend     |
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
- **M4 — Pedidos e notificações**: painel em tempo real (WebSocket), WhatsApp (Evolution API a validar), e-mail (Resend), gestão de status.
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