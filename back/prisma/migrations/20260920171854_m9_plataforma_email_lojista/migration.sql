-- CreateTable
CREATE TABLE "config_plataforma" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "emailLojista" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_plataforma_pkey" PRIMARY KEY ("id")
);
