-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "arquivado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pagamentoInfo" TEXT;

-- CreateIndex
CREATE INDEX "pedidos_arquivado_createdAt_idx" ON "pedidos"("arquivado", "createdAt");
