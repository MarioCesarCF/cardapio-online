-- AlterTable
ALTER TABLE "lanchonetes" ADD COLUMN "situacao" TEXT NOT NULL DEFAULT 'pendente';

-- Backfill: deriva a nova situação do campo antigo `ativa`
UPDATE "lanchonetes"
SET "situacao" = CASE WHEN "ativa" THEN 'ativa' ELSE 'pausada' END;

ALTER TABLE "lanchonetes" DROP COLUMN "ativa";

-- CreateTable
CREATE TABLE "logs_sistema" (
    "id" VARCHAR(30) NOT NULL,
    "nivel" TEXT NOT NULL DEFAULT 'info',
    "categoria" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "detalhes" JSONB,
    "usuarioId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_sistema_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "logs_sistema_createdAt_idx" ON "logs_sistema"("createdAt");