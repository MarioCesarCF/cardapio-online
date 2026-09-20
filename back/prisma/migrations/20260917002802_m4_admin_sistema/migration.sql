-- CreateTable
CREATE TABLE "admin_sistema" (
    "id" UUID NOT NULL,
    "nome" TEXT,
    "email" TEXT NOT NULL,
    "funcao" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_sistema_pkey" PRIMARY KEY ("id")
);
