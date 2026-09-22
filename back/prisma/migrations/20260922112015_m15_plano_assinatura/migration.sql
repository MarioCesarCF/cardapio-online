-- AlterTable
ALTER TABLE "lanchonetes" ADD COLUMN     "plano" TEXT NOT NULL DEFAULT 'trial',
ADD COLUMN     "planoExpira" TIMESTAMP(3);

-- Backfill: lojas existentes (agora todas "trial") ganham 30 dias a partir de HOJE,
-- para não nascerem expiradas (dev/seed continuam funcionando para smokes).
UPDATE "lanchonetes" SET "planoExpira" = NOW() + INTERVAL '30 days'
WHERE "plano" = 'trial' AND "planoExpira" IS NULL;
