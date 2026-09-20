-- CreateTable
CREATE TABLE "galeria_imagens" (
    "id" VARCHAR(30) NOT NULL,
    "categoria" TEXT NOT NULL,
    "keywords" TEXT[],
    "url" VARCHAR(500) NOT NULL,
    "autor" TEXT,
    "fonte" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "galeria_imagens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "galeria_imagens_url_key" ON "galeria_imagens"("url");

-- CreateIndex
CREATE INDEX "galeria_imagens_categoria_idx" ON "galeria_imagens"("categoria");
