-- Migración incremental segura para NovaCita
-- Añade campos faltantes e índice de DispositivoRecordado en Prisma

ALTER TABLE "Empleado" ADD COLUMN IF NOT EXISTS "tituloCliente" TEXT;
ALTER TABLE "Empleado" ADD COLUMN IF NOT EXISTS "esAgendable" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Cliente_createdByUserId_fkey') THEN
        ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "DispositivoRecordado" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "deviceName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "DispositivoRecordado_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DispositivoRecordado_tokenHash_key" ON "DispositivoRecordado"("tokenHash");
CREATE INDEX IF NOT EXISTS "DispositivoRecordado_userId_idx" ON "DispositivoRecordado"("userId");
CREATE INDEX IF NOT EXISTS "DispositivoRecordado_tokenHash_idx" ON "DispositivoRecordado"("tokenHash");
CREATE INDEX IF NOT EXISTS "DispositivoRecordado_expiresAt_idx" ON "DispositivoRecordado"("expiresAt");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DispositivoRecordado_userId_fkey') THEN
        ALTER TABLE "DispositivoRecordado" ADD CONSTRAINT "DispositivoRecordado_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
