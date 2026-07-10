-- Migración SQL para añadir el sistema de dispositivos recordados
-- Compatible con NeonDB (PostgreSQL)

CREATE TABLE IF NOT EXISTS "DispositivoRecordado" (
    "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId"      TEXT NOT NULL,
    "tokenHash"   TEXT NOT NULL,
    "userAgent"   TEXT,
    "ipAddress"   TEXT,
    "deviceName"  TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt"  TIMESTAMP(3),
    "expiresAt"   TIMESTAMP(3) NOT NULL,
    "revokedAt"   TIMESTAMP(3),

    CONSTRAINT "DispositivoRecordado_pkey" PRIMARY KEY ("id")
);

-- Índices para optimizar las consultas y búsquedas de tokens persistentes
CREATE UNIQUE INDEX IF NOT EXISTS "DispositivoRecordado_tokenHash_key" 
    ON "DispositivoRecordado"("tokenHash");

CREATE INDEX IF NOT EXISTS "DispositivoRecordado_userId_idx" 
    ON "DispositivoRecordado"("userId");

CREATE INDEX IF NOT EXISTS "DispositivoRecordado_tokenHash_idx" 
    ON "DispositivoRecordado"("tokenHash");

CREATE INDEX IF NOT EXISTS "DispositivoRecordado_expiresAt_idx" 
    ON "DispositivoRecordado"("expiresAt");

-- Llave foránea que referencia al Empleado (Usuario) con cascada en borrado
ALTER TABLE "DispositivoRecordado"
    ADD CONSTRAINT "DispositivoRecordado_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "Empleado"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
