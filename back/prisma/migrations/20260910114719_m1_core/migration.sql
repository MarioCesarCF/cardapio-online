-- CreateTable
CREATE TABLE "lanchonetes" (
    "id" VARCHAR(30) NOT NULL,
    "donoId" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "fonte" TEXT,
    "corPrincipal" TEXT,
    "chavePix" TEXT,
    "nomePix" TEXT,
    "whatsapp" TEXT,
    "emailContato" TEXT,
    "enderecoLoja" TEXT,
    "notifPainel" BOOLEAN NOT NULL DEFAULT true,
    "notifWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "notifEmail" BOOLEAN NOT NULL DEFAULT false,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lanchonetes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id" VARCHAR(30) NOT NULL,
    "lanchoneteId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "posicao" INTEGER NOT NULL DEFAULT 0,
    "imagemUrl" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" VARCHAR(30) NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "preco" DECIMAL(10,2) NOT NULL,
    "imagemUrl" TEXT,
    "destaque" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupos_opcoes" (
    "id" VARCHAR(30) NOT NULL,
    "lanchoneteId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'multipla',
    "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
    "minSelecoes" INTEGER NOT NULL DEFAULT 0,
    "maxSelecoes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grupos_opcoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opcoes" (
    "id" VARCHAR(30) NOT NULL,
    "grupoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "precoAdicional" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "remove" BOOLEAN NOT NULL DEFAULT false,
    "ativa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "opcoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produto_grupos" (
    "produtoId" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "produto_grupos_pkey" PRIMARY KEY ("produtoId","grupoId")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL,
    "nome" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enderecos" (
    "id" VARCHAR(30) NOT NULL,
    "clienteId" UUID NOT NULL,
    "rua" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "complemento" TEXT,
    "bairro" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "uf" VARCHAR(2) NOT NULL,
    "cep" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "apelido" TEXT,
    "padrao" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enderecos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" VARCHAR(30) NOT NULL,
    "numero" INTEGER NOT NULL,
    "lanchoneteId" TEXT NOT NULL,
    "clienteId" UUID,
    "status" TEXT NOT NULL DEFAULT 'recebido',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "formaPagamento" TEXT NOT NULL DEFAULT 'pix',
    "brCodePix" TEXT,
    "enderecoEntrega" JSONB,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_itens" (
    "id" VARCHAR(30) NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "produtoId" TEXT,
    "nomeSnapshot" TEXT NOT NULL,
    "precoUnit" DECIMAL(10,2) NOT NULL,
    "qtd" INTEGER NOT NULL,

    CONSTRAINT "pedido_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_item_opcoes" (
    "id" VARCHAR(30) NOT NULL,
    "pedidoItemId" TEXT NOT NULL,
    "opcaoId" TEXT,
    "nomeSnapshot" TEXT NOT NULL,
    "precoAdicional" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "remove" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "pedido_item_opcoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lanchonetes_slug_key" ON "lanchonetes"("slug");

-- CreateIndex
CREATE INDEX "lanchonetes_donoId_idx" ON "lanchonetes"("donoId");

-- CreateIndex
CREATE INDEX "categorias_lanchoneteId_idx" ON "categorias"("lanchoneteId");

-- CreateIndex
CREATE INDEX "produtos_categoriaId_idx" ON "produtos"("categoriaId");

-- CreateIndex
CREATE INDEX "grupos_opcoes_lanchoneteId_idx" ON "grupos_opcoes"("lanchoneteId");

-- CreateIndex
CREATE INDEX "opcoes_grupoId_idx" ON "opcoes"("grupoId");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_email_key" ON "clientes"("email");

-- CreateIndex
CREATE INDEX "enderecos_clienteId_idx" ON "enderecos"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_lanchoneteId_numero_key" ON "pedidos"("lanchoneteId", "numero");

-- CreateIndex
CREATE INDEX "pedido_itens_pedidoId_idx" ON "pedido_itens"("pedidoId");

-- CreateIndex
CREATE INDEX "pedido_item_opcoes_pedidoItemId_idx" ON "pedido_item_opcoes"("pedidoItemId");

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_lanchoneteId_fkey" FOREIGN KEY ("lanchoneteId") REFERENCES "lanchonetes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupos_opcoes" ADD CONSTRAINT "grupos_opcoes_lanchoneteId_fkey" FOREIGN KEY ("lanchoneteId") REFERENCES "lanchonetes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opcoes" ADD CONSTRAINT "opcoes_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "grupos_opcoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produto_grupos" ADD CONSTRAINT "produto_grupos_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produto_grupos" ADD CONSTRAINT "produto_grupos_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "grupos_opcoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enderecos" ADD CONSTRAINT "enderecos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_lanchoneteId_fkey" FOREIGN KEY ("lanchoneteId") REFERENCES "lanchonetes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_item_opcoes" ADD CONSTRAINT "pedido_item_opcoes_pedidoItemId_fkey" FOREIGN KEY ("pedidoItemId") REFERENCES "pedido_itens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_item_opcoes" ADD CONSTRAINT "pedido_item_opcoes_opcaoId_fkey" FOREIGN KEY ("opcaoId") REFERENCES "opcoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
