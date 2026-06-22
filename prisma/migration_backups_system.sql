-- AlterTable for Configuracion
ALTER TABLE "Configuracion" 
ADD COLUMN "mantenimientoActivo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mensajeMantenimiento" TEXT,
ADD COLUMN "mantenimientoDesde" TIMESTAMP(3),
ADD COLUMN "backups" JSONB;

-- CreateTable for HistorialBackup
CREATE TABLE "HistorialBackup" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fileName" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdById" TEXT,
    "createdByRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "deleteReason" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,

    CONSTRAINT "HistorialBackup_pkey" PRIMARY KEY ("id")
);

-- CreateTable for TrabajoBackup
CREATE TABLE "TrabajoBackup" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "backupId" TEXT,
    "solicitadoPorId" TEXT,
    "solicitadoPorRol" TEXT,
    "payload" JSONB,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "maxIntentos" INTEGER NOT NULL DEFAULT 3,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrabajoBackup_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX "HistorialBackup_createdAt_idx" ON "HistorialBackup"("createdAt");
CREATE INDEX "HistorialBackup_status_idx" ON "HistorialBackup"("status");

CREATE INDEX "TrabajoBackup_estado_idx" ON "TrabajoBackup"("estado");
CREATE INDEX "TrabajoBackup_tipo_idx" ON "TrabajoBackup"("tipo");
CREATE INDEX "TrabajoBackup_createdAt_idx" ON "TrabajoBackup"("createdAt");
CREATE INDEX "TrabajoBackup_backupId_idx" ON "TrabajoBackup"("backupId");
CREATE INDEX "TrabajoBackup_solicitadoPorId_idx" ON "TrabajoBackup"("solicitadoPorId");
