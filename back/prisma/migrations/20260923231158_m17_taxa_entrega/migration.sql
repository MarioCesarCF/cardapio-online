-- AlterTable
ALTER TABLE "lanchonetes" ADD COLUMN     "cobraTaxaEntrega" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "taxaEntrega" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "taxaEntrega" DECIMAL(10,2) NOT NULL DEFAULT 0;
