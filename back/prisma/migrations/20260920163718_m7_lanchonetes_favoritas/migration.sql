-- CreateTable
CREATE TABLE "lanchonetes_favoritas" (
    "id" VARCHAR(30) NOT NULL,
    "clienteId" UUID NOT NULL,
    "lanchoneteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lanchonetes_favoritas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lanchonetes_favoritas_clienteId_createdAt_idx" ON "lanchonetes_favoritas"("clienteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "lanchonetes_favoritas_clienteId_lanchoneteId_key" ON "lanchonetes_favoritas"("clienteId", "lanchoneteId");

-- AddForeignKey
ALTER TABLE "lanchonetes_favoritas" ADD CONSTRAINT "lanchonetes_favoritas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lanchonetes_favoritas" ADD CONSTRAINT "lanchonetes_favoritas_lanchoneteId_fkey" FOREIGN KEY ("lanchoneteId") REFERENCES "lanchonetes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
