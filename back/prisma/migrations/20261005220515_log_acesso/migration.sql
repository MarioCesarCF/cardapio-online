-- AlterTable
ALTER TABLE "respostas_encerramento" ALTER COLUMN "usuarioId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "logs_acesso" (
    "id" VARCHAR(30) NOT NULL,
    "ip" VARCHAR(45) NOT NULL,
    "metodo" VARCHAR(8) NOT NULL,
    "rota" VARCHAR(120) NOT NULL,
    "status" INTEGER NOT NULL,
    "usuarioId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_acesso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "logs_acesso_createdAt_idx" ON "logs_acesso"("createdAt");
