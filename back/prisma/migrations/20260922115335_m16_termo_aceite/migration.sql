-- CreateTable
CREATE TABLE "termos_aceite" (
    "usuarioId" UUID NOT NULL,
    "versao" TEXT NOT NULL,
    "aceitoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "termos_aceite_pkey" PRIMARY KEY ("usuarioId","versao")
);
