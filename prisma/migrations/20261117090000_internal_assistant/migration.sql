-- Additive only: the production application can continue using its existing tables.
CREATE TABLE "IaBorrador" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "citaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IaBorrador_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "IaBorrador_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IaBorrador_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "Cita"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "IaBorrador_citaId_key" ON "IaBorrador"("citaId");
CREATE INDEX "IaBorrador_userId_estado_expiresAt_idx" ON "IaBorrador"("userId", "estado", "expiresAt");
CREATE TABLE "IaLimite" (
    "clave" TEXT NOT NULL,
    "ventana" TIMESTAMP(3) NOT NULL,
    "cantidad" INTEGER NOT NULL,
    CONSTRAINT "IaLimite_pkey" PRIMARY KEY ("clave")
);
