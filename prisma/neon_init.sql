-- =====================================================
-- Sistema de Gestión de Citas - Script de Inicialización
-- Base de datos PostgreSQL para Neon
-- =====================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE "RolUsuario" AS ENUM ('CLIENTE', 'EMPLEADO', 'ADMIN');
CREATE TYPE "EstadoCita" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'COMPLETADA', 'NO_ASISTIO');

-- =====================================================
-- TABLAS
-- =====================================================

-- Tabla: Usuario
CREATE TABLE "Usuario" (
    "id"           TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nombre"       TEXT NOT NULL,
    "email"        TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "telefono"     TEXT,
    "rol"          "RolUsuario" NOT NULL DEFAULT 'CLIENTE',
    "activo"       BOOLEAN NOT NULL DEFAULT true,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- Tabla: PerfilNegocio
CREATE TABLE "PerfilNegocio" (
    "id"            TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nombreNegocio" TEXT NOT NULL,
    "direccion"     TEXT NOT NULL,
    "telefono"      TEXT NOT NULL,
    "email"         TEXT NOT NULL,
    "moneda"        TEXT NOT NULL DEFAULT 'USD',
    "zonaHoraria"   TEXT NOT NULL DEFAULT 'UTC',

    CONSTRAINT "PerfilNegocio_pkey" PRIMARY KEY ("id")
);

-- Tabla: Servicio
CREATE TABLE "Servicio" (
    "id"              TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nombre"          TEXT NOT NULL,
    "descripcion"     TEXT,
    "duracionMinutos" INTEGER NOT NULL,
    "precio"          DOUBLE PRECISION NOT NULL,
    "activo"          BOOLEAN NOT NULL DEFAULT true,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Servicio_pkey" PRIMARY KEY ("id")
);

-- Tabla: PerfilEmpleado
CREATE TABLE "PerfilEmpleado" (
    "id"              TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId"          TEXT NOT NULL,
    "especialidad"    TEXT,
    "colorCalendario" TEXT,

    CONSTRAINT "PerfilEmpleado_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PerfilEmpleado_userId_key" ON "PerfilEmpleado"("userId");

-- Tabla: Horario
CREATE TABLE "Horario" (
    "id"         TEXT NOT NULL DEFAULT gen_random_uuid(),
    "empleadoId" TEXT NOT NULL,
    "diaSemana"  INTEGER NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin"    TEXT NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Horario_pkey" PRIMARY KEY ("id")
);

-- Tabla: Cita
CREATE TABLE "Cita" (
    "id"            TEXT NOT NULL DEFAULT gen_random_uuid(),
    "clienteId"     TEXT NOT NULL,
    "empleadoId"    TEXT NOT NULL,
    "servicioId"    TEXT NOT NULL,
    "fecha"         DATE NOT NULL,
    "horaInicio"    TEXT NOT NULL,
    "horaFin"       TEXT NOT NULL,
    "estado"        "EstadoCita" NOT NULL DEFAULT 'PENDIENTE',
    "notasCliente"  TEXT,
    "notasInternas" TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cita_pkey" PRIMARY KEY ("id")
);

-- Tabla: Pago
CREATE TABLE "Pago" (
    "id"         TEXT NOT NULL DEFAULT gen_random_uuid(),
    "citaId"     TEXT NOT NULL,
    "monto"      DOUBLE PRECISION NOT NULL,
    "metodoPago" TEXT,
    "estadoPago" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "referencia" TEXT,
    "fechaPago"  TIMESTAMP(3),

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- Tabla: Notificacion
CREATE TABLE "Notificacion" (
    "id"        TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId"    TEXT NOT NULL,
    "tipo"      TEXT NOT NULL,
    "titulo"    TEXT NOT NULL,
    "mensaje"   TEXT NOT NULL,
    "leida"     BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- FOREIGN KEYS (Relaciones)
-- =====================================================

-- PerfilEmpleado -> Usuario (CASCADE)
ALTER TABLE "PerfilEmpleado" ADD CONSTRAINT "PerfilEmpleado_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Horario -> PerfilEmpleado (CASCADE)
ALTER TABLE "Horario" ADD CONSTRAINT "Horario_empleadoId_fkey"
    FOREIGN KEY ("empleadoId") REFERENCES "PerfilEmpleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cita -> Usuario (Cliente) (CASCADE)
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cita -> PerfilEmpleado (CASCADE)
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_empleadoId_fkey"
    FOREIGN KEY ("empleadoId") REFERENCES "PerfilEmpleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cita -> Servicio (RESTRICT - no borrar servicio con citas)
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_servicioId_fkey"
    FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Pago -> Cita (CASCADE)
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_citaId_fkey"
    FOREIGN KEY ("citaId") REFERENCES "Cita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Notificacion -> Usuario (CASCADE)
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================
-- ÍNDICES DE RENDIMIENTO
-- =====================================================

CREATE INDEX "Cita_clienteId_idx" ON "Cita"("clienteId");
CREATE INDEX "Cita_empleadoId_idx" ON "Cita"("empleadoId");
CREATE INDEX "Cita_fecha_idx" ON "Cita"("fecha");
CREATE INDEX "Cita_estado_idx" ON "Cita"("estado");
CREATE INDEX "Horario_empleadoId_idx" ON "Horario"("empleadoId");
CREATE INDEX "Notificacion_userId_idx" ON "Notificacion"("userId");
CREATE INDEX "Pago_citaId_idx" ON "Pago"("citaId");

-- =====================================================
-- DATOS INICIALES (Seed)
-- =====================================================

-- Admin por defecto (contraseña: Admin123!)
-- Hash bcrypt generado con 10 salt rounds
INSERT INTO "Usuario" ("id", "nombre", "email", "passwordHash", "telefono", "rol", "activo", "createdAt", "updatedAt")
VALUES (
    gen_random_uuid(),
    'Administrador Principal',
    'admin@sistema.com',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    '555-0000',
    'ADMIN',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Perfil de negocio por defecto
INSERT INTO "PerfilNegocio" ("id", "nombreNegocio", "direccion", "telefono", "email", "moneda", "zonaHoraria")
VALUES (
    gen_random_uuid(),
    'Mi Negocio de Citas',
    'Calle Principal 123',
    '+1234567890',
    'contacto@minegocio.com',
    'USD',
    'America/Mexico_City'
);

-- Servicios de ejemplo
INSERT INTO "Servicio" ("id", "nombre", "descripcion", "duracionMinutos", "precio", "activo", "createdAt")
VALUES
    (gen_random_uuid(), 'Corte Básico', 'Corte de cabello estándar', 30, 15.00, true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Corte y Lavado', 'Corte de cabello y lavado profundo', 45, 25.00, true, CURRENT_TIMESTAMP),
    (gen_random_uuid(), 'Tinte Completo', 'Aplicación de tinte en todo el cabello', 120, 60.00, true, CURRENT_TIMESTAMP);
