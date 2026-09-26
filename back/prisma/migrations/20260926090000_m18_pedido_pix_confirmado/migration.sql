-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "pixConfirmado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pixConfirmadoEm" TIMESTAMP(3);
