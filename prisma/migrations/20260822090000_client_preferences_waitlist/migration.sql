-- Preferencias estructuradas del cliente y lista de espera para cancelaciones.
CREATE TYPE "TipoPreferenciaCliente" AS ENUM ('CORTE', 'TINTE', 'ALERGIA', 'PREFERENCIA', 'NOTA');
CREATE TYPE "EstadoListaEspera" AS ENUM ('ESPERANDO', 'CONTACTADO', 'AGENDADO', 'CANCELADO');

CREATE TABLE "ClientePreferencia" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "clienteId" TEXT NOT NULL,
    "tipo" "TipoPreferenciaCliente" NOT NULL,
    "titulo" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClientePreferencia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ListaEspera" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "clienteId" TEXT NOT NULL,
    "servicioId" TEXT,
    "empleadoId" TEXT,
    "fechaDesde" DATE,
    "fechaHasta" DATE,
    "jornadaPreferida" TEXT,
    "notas" TEXT,
    "prioridad" INTEGER NOT NULL DEFAULT 0,
    "estado" "EstadoListaEspera" NOT NULL DEFAULT 'ESPERANDO',
    "createdBy" TEXT NOT NULL,
    "contactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ListaEspera_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientePreferencia_clienteId_createdAt_idx" ON "ClientePreferencia"("clienteId", "createdAt");
CREATE INDEX "ClientePreferencia_tipo_idx" ON "ClientePreferencia"("tipo");
CREATE INDEX "ListaEspera_estado_prioridad_createdAt_idx" ON "ListaEspera"("estado", "prioridad", "createdAt");
CREATE INDEX "ListaEspera_clienteId_idx" ON "ListaEspera"("clienteId");
CREATE INDEX "ListaEspera_servicioId_idx" ON "ListaEspera"("servicioId");
CREATE INDEX "ListaEspera_empleadoId_idx" ON "ListaEspera"("empleadoId");

ALTER TABLE "ClientePreferencia" ADD CONSTRAINT "ClientePreferencia_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientePreferencia" ADD CONSTRAINT "ClientePreferencia_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ListaEspera" ADD CONSTRAINT "ListaEspera_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListaEspera" ADD CONSTRAINT "ListaEspera_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ListaEspera" ADD CONSTRAINT "ListaEspera_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ListaEspera" ADD CONSTRAINT "ListaEspera_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
