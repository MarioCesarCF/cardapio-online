-- CreateTable
CREATE TABLE "respostas_encerramento" (
    "id" VARCHAR(30) NOT NULL,
    "perfil" TEXT NOT NULL,
    "usuarioId" UUID NOT NULL,
    "lanchoneteId" VARCHAR(30),
    "lanchoneteNome" VARCHAR(80),
    "lanchoneteSlug" VARCHAR(80),
    "motivoPrincipal" TEXT NOT NULL,
    "motivosSecundarios" TEXT[],
    "ajudouPedidos" TEXT,
    "precoAdequado" TEXT,
    "funcionalidadeFaltante" TEXT,
    "satisfacao" INTEGER,
    "voltaria" TEXT,
    "contatoLiberado" BOOLEAN NOT NULL DEFAULT false,
    "contato" VARCHAR(120),
    "melhorar" TEXT,
    "paraContinuar" TEXT,
    "experiencia" TEXT,
    "pedidosRecebidos" INTEGER NOT NULL DEFAULT 0,
    "diasAtivo" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "respostas_encerramento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "respostas_encerramento_perfil_motivoPrincipal_idx" ON "respostas_encerramento"("perfil", "motivoPrincipal");

-- CreateIndex
CREATE INDEX "respostas_encerramento_perfil_createdAt_idx" ON "respostas_encerramento"("perfil", "createdAt");

-- CreateIndex
CREATE INDEX "respostas_encerramento_lanchoneteId_idx" ON "respostas_encerramento"("lanchoneteId");
