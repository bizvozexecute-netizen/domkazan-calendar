CREATE TABLE "ClientUiSettings" (
    "id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "settings" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClientUiSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClientUiSettings_singleton" CHECK ("id" = 'public'),
    CONSTRAINT "ClientUiSettings_revision_positive" CHECK ("revision" > 0)
);
