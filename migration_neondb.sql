-- ==============================================================================
-- SCRIPT DE MIGRACIÓN SQL PARA NEONDB (HAIR STYLE Salón & Barber)
-- Fase 1 & 2: Limpieza de Facturación, Precios y Estabilización de Horarios
-- ==============================================================================

-- 1. ELIMINACIÓN DE DATOS Y COLUMNAS RELACIONADOS A PRECIOS Y PAGOS
-- Eliminamos la tabla "Pago" si existe (y sus dependencias en cascada)
DROP TABLE IF EXISTS "Pago" CASCADE;

-- Eliminamos el enum "EstadoPago" si existe en la base de datos
DROP TYPE IF EXISTS "EstadoPago" CASCADE;

-- Eliminamos las columnas obsoletas en las tablas "Servicio" y "Cita"
ALTER TABLE "Servicio" DROP COLUMN IF EXISTS "precio";
ALTER TABLE "Cita" DROP COLUMN IF EXISTS "precio";
ALTER TABLE "Cita" DROP COLUMN IF EXISTS "metodo_pago";

-- 2. CREACIÓN DE LAS NUEVAS TABLAS DE GESTIÓN DE HORARIOS DE EMPLEADOS
-- Tabla para descansos recurrentes del personal (días y horas específicas)
CREATE TABLE IF NOT EXISTS "DescansoEmpleado" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "empleado_id" TEXT NOT NULL,
    "dia_semana" INTEGER NOT NULL, -- 0=Domingo, 1=Lunes, ..., 6=Sábado
    "hora_inicio" TEXT NOT NULL,   -- e.g. "13:00"
    "hora_fin" TEXT NOT NULL,      -- e.g. "14:00"

    CONSTRAINT "DescansoEmpleado_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DescansoEmpleado_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Tabla para bloqueos puntuales de horarios (horas de un día en específico)
CREATE TABLE IF NOT EXISTS "BloqueoHorario" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "empleado_id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "hora_inicio" TEXT NOT NULL,   -- e.g. "10:00"
    "hora_fin" TEXT NOT NULL,      -- e.g. "12:00"
    "motivo" TEXT,

    CONSTRAINT "BloqueoHorario_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BloqueoHorario_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Tabla para periodos de vacaciones y días libres del personal
CREATE TABLE IF NOT EXISTS "VacacionesEmpleado" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "empleado_id" TEXT NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'APROBADO',

    CONSTRAINT "VacacionesEmpleado_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "VacacionesEmpleado_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 3. CREACIÓN DE ÍNDICES PARA OPTIMIZAR LAS CONSULTAS DE DISPONIBILIDAD
CREATE INDEX IF NOT EXISTS "DescansoEmpleado_empleado_id_idx" ON "DescansoEmpleado"("empleado_id");
CREATE INDEX IF NOT EXISTS "BloqueoHorario_empleado_id_fecha_idx" ON "BloqueoHorario"("empleado_id", "fecha");
CREATE INDEX IF NOT EXISTS "VacacionesEmpleado_empleado_id_idx" ON "VacacionesEmpleado"("empleado_id");
