-- ============================================================================
-- NOVACITA - SCRIPT DE ESQUEMA COMPLETO Y CONTROLADO PARA POSTGRESQL / NEONDB
-- ============================================================================
-- Sistema: NovaCita (Gestión de Citas, Empleados, Auditoría, Notificaciones y Reportes)
-- Versión del Sistema: 1.0.0
-- Fecha de Generación: 2026-06-22
--
-- ADVERTENCIA:
-- Este script recrea la estructura de la base de datos desde cero.
-- No ejecutar directamente en producción si existen datos importantes, sin
-- realizar previamente un respaldo completo (backup).
-- ============================================================================

-- Habilitar extensión UUID si no existe
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. FUNCIONES Y TRIGGERS GLOBALES
-- ============================================================================

-- Función para actualizar automáticamente la columna "updatedAt" o "updated_at"
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_ARGV[0] = 'updated_at' THEN
        NEW.updated_at = CURRENT_TIMESTAMP;
    ELSE
        NEW."updatedAt" = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. ENUMS (Tipos Definidos)
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RolUsuario') THEN
        CREATE TYPE "RolUsuario" AS ENUM ('EMPLEADO', 'ADMIN', 'TECH_SUPPORT');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoCita') THEN
        CREATE TYPE "EstadoCita" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'EN_PROGRESO', 'COMPLETADA', 'CANCELADA', 'NO_SHOW', 'REPROGRAMADA');
    END IF;
END
$$;

-- ============================================================================
-- 3. TABLAS
-- ============================================================================

-- --- TABLA: Empleado ---
CREATE TABLE IF NOT EXISTS "Empleado" (
    "id"           TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nombre"       TEXT NOT NULL,
    "correo"       TEXT NOT NULL,
    "telefono"     TEXT,
    "passwordHash" TEXT NOT NULL,
    "especialidad" TEXT,
    "horario"      JSONB,
    "rol"          "RolUsuario" NOT NULL DEFAULT 'EMPLEADO',
    "activo"       BOOLEAN NOT NULL DEFAULT true,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Empleado_pkey" PRIMARY KEY ("id")
);

-- Índices Únicos
CREATE UNIQUE INDEX IF NOT EXISTS "Empleado_correo_key" ON "Empleado"("correo");

-- Trigger para Empleado
DROP TRIGGER IF EXISTS tr_update_Empleado ON "Empleado";
CREATE TRIGGER tr_update_Empleado
BEFORE UPDATE ON "Empleado"
FOR EACH ROW EXECUTE PROCEDURE fn_update_timestamp();


-- --- TABLA: Categoria ---
CREATE TABLE IF NOT EXISTS "Categoria" (
    "id"        TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nombre"    TEXT NOT NULL,
    "color"     TEXT DEFAULT '#6366f1',
    "activo"    BOOLEAN NOT NULL DEFAULT true,
    "orden"     INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- Índices Únicos
CREATE UNIQUE INDEX IF NOT EXISTS "Categoria_nombre_key" ON "Categoria"("nombre");

-- Trigger para Categoria
DROP TRIGGER IF EXISTS tr_update_Categoria ON "Categoria";
CREATE TRIGGER tr_update_Categoria
BEFORE UPDATE ON "Categoria"
FOR EACH ROW EXECUTE PROCEDURE fn_update_timestamp();


-- --- TABLA: Servicio ---
CREATE TABLE IF NOT EXISTS "Servicio" (
    "id"           TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nombre"       TEXT NOT NULL,
    "descripcion"  TEXT,
    "duracion"     INTEGER NOT NULL,
    "categoria"    TEXT,
    "categoria_id" TEXT,
    "activo"       BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Servicio_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Servicio_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "Categoria" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);


-- --- TABLA: Cliente ---
CREATE TABLE IF NOT EXISTS "Cliente" (
    "id"        TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nombre"    TEXT NOT NULL,
    "telefono"  TEXT,
    "correo"    TEXT,
    "notas"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- Trigger para Cliente
DROP TRIGGER IF EXISTS tr_update_Cliente ON "Cliente";
CREATE TRIGGER tr_update_Cliente
BEFORE UPDATE ON "Cliente"
FOR EACH ROW EXECUTE PROCEDURE fn_update_timestamp();


-- --- TABLA: Cita ---
CREATE TABLE IF NOT EXISTS "Cita" (
    "id"               TEXT NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id"       TEXT,
    "cliente_nombre"   TEXT NOT NULL,
    "cliente_telefono" TEXT,
    "servicio_id"      TEXT NOT NULL,
    "empleado_id"      TEXT NOT NULL,
    "fecha"            DATE NOT NULL,
    "hora"             TEXT NOT NULL,
    "duracion"         INTEGER NOT NULL,
    "estado"           "EstadoCita" NOT NULL DEFAULT 'PENDIENTE',
    "notas"            TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by"       TEXT NOT NULL,
    
    -- Campos de Analytics
    "cancelled_at"     TIMESTAMP(3),
    "completed_at"     TIMESTAMP(3),
    "no_show_at"       TIMESTAMP(3),
    "cancel_reason"    TEXT,

    -- WhatsApp Reminders
    "whatsapp_reminder_sent"    BOOLEAN NOT NULL DEFAULT false,
    "whatsapp_reminder_sent_at" TIMESTAMP(3),

    CONSTRAINT "Cita_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Cita_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Cita_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "Servicio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Cita_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Cita_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Empleado" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Trigger para Cita
DROP TRIGGER IF EXISTS tr_update_Cita ON "Cita";
CREATE TRIGGER tr_update_Cita
BEFORE UPDATE ON "Cita"
FOR EACH ROW EXECUTE PROCEDURE fn_update_timestamp('updated_at');


-- --- TABLA: CitaServicio (Soporte Multiservicio) ---
CREATE TABLE IF NOT EXISTS "CitaServicio" (
    "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
    "cita_id"     TEXT NOT NULL,
    "servicio_id" TEXT NOT NULL,
    "duracion"    INTEGER NOT NULL,
    "orden"       INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CitaServicio_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CitaServicio_cita_id_fkey" FOREIGN KEY ("cita_id") REFERENCES "Cita" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CitaServicio_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "Servicio" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);


-- --- TABLA: DescansoEmpleado ---
CREATE TABLE IF NOT EXISTS "DescansoEmpleado" (
    "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
    "empleado_id" TEXT NOT NULL,
    "dia_semana"  INTEGER NOT NULL, -- 0=Domingo, 1=Lunes, ..., 6=Sábado
    "hora_inicio" TEXT NOT NULL,
    "hora_fin"    TEXT NOT NULL,

    CONSTRAINT "DescansoEmpleado_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DescansoEmpleado_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);


-- --- TABLA: BloqueoHorario ---
CREATE TABLE IF NOT EXISTS "BloqueoHorario" (
    "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
    "empleado_id" TEXT NOT NULL,
    "fecha"       DATE NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin"    TEXT NOT NULL,
    "motivo"      TEXT,

    CONSTRAINT "BloqueoHorario_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BloqueoHorario_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);


-- --- TABLA: VacacionesEmpleado ---
CREATE TABLE IF NOT EXISTS "VacacionesEmpleado" (
    "id"           TEXT NOT NULL DEFAULT gen_random_uuid(),
    "empleado_id"  TEXT NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin"    DATE NOT NULL,
    "estado"       TEXT NOT NULL DEFAULT 'APROBADO',

    CONSTRAINT "VacacionesEmpleado_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "VacacionesEmpleado_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "Empleado" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);


-- --- TABLA: PasswordResetToken ---
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id"         TEXT NOT NULL DEFAULT gen_random_uuid(),
    "user_id"    TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at"    TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "request_ip" TEXT,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PasswordResetToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Empleado" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Índices Únicos
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_token_hash_key" ON "PasswordResetToken"("token_hash");


-- --- TABLA: Configuracion ---
CREATE TABLE IF NOT EXISTS "Configuracion" (
    "id"         TEXT NOT NULL DEFAULT 'default',
    "negocio"    JSONB,
    "horarios"   JSONB,
    "whatsapp"   JSONB,
    "apariencia" JSONB,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("id")
);

-- Trigger para Configuracion
DROP TRIGGER IF EXISTS tr_update_Configuracion ON "Configuracion";
CREATE TRIGGER tr_update_Configuracion
BEFORE UPDATE ON "Configuracion"
FOR EACH ROW EXECUTE PROCEDURE fn_update_timestamp();


-- --- TABLA: AuditLog (Auditoría Avanzada) ---
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id"           TEXT NOT NULL DEFAULT gen_random_uuid(),
    "entidad"      TEXT NOT NULL,
    "entidadId"    TEXT NOT NULL,
    "accion"       TEXT NOT NULL,
    "detalles"     JSONB,
    "realizadoPor" TEXT,
    "fecha"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Campos extendidos de la versión avanzada
    "userId"       TEXT,
    "userName"     TEXT,
    "userEmail"    TEXT,
    "userRole"     TEXT,
    "action"       TEXT,
    "module"       TEXT,
    "entityType"   TEXT,
    "entityName"   TEXT,
    "description"  TEXT,
    "status"       TEXT,
    "ipAddress"    TEXT,
    "userAgent"    TEXT,
    "requestId"    TEXT,
    "beforeData"   JSONB,
    "afterData"    JSONB,
    "metadata"     JSONB,
    "errorMessage" TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- 4. ÍNDICES DE RENDIMIENTO (Optimización de Consultas)
-- ============================================================================

-- Índices en Cita (Frecuentemente filtrado en vistas y calendarios)
CREATE INDEX IF NOT EXISTS "Cita_empleado_id_idx" ON "Cita"("empleado_id");
CREATE INDEX IF NOT EXISTS "Cita_estado_idx" ON "Cita"("estado");
CREATE INDEX IF NOT EXISTS "Cita_fecha_idx" ON "Cita"("fecha");
CREATE INDEX IF NOT EXISTS "Cita_cliente_id_idx" ON "Cita"("cliente_id");
CREATE INDEX IF NOT EXISTS "Cita_servicio_id_idx" ON "Cita"("servicio_id");
CREATE INDEX IF NOT EXISTS "Cita_created_at_idx" ON "Cita"("created_at");
CREATE INDEX IF NOT EXISTS "Cita_cancelled_at_idx" ON "Cita"("cancelled_at");
CREATE INDEX IF NOT EXISTS "Cita_completed_at_idx" ON "Cita"("completed_at");
CREATE INDEX IF NOT EXISTS "Cita_whatsapp_reminder_sent_fecha_estado_idx" ON "Cita"("whatsapp_reminder_sent", "fecha", "estado");

-- Índices en Relaciones de Empleados
CREATE INDEX IF NOT EXISTS "DescansoEmpleado_empleado_id_idx" ON "DescansoEmpleado"("empleado_id");
CREATE INDEX IF NOT EXISTS "BloqueoHorario_empleado_id_fecha_idx" ON "BloqueoHorario"("empleado_id", "fecha");
CREATE INDEX IF NOT EXISTS "VacacionesEmpleado_empleado_id_idx" ON "VacacionesEmpleado"("empleado_id");

-- Índices en CitaServicio (Soporte multiservicios ágil)
CREATE INDEX IF NOT EXISTS "CitaServicio_cita_id_idx" ON "CitaServicio"("cita_id");

-- Índices en Recuperación de Contraseña
CREATE INDEX IF NOT EXISTS "PasswordResetToken_user_id_idx" ON "PasswordResetToken"("user_id");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_token_hash_idx" ON "PasswordResetToken"("token_hash");

-- Índices en AuditLog (Filtros masivos en el panel de auditoría)
CREATE INDEX IF NOT EXISTS "AuditLog_entidad_entidadId_idx" ON "AuditLog"("entidad", "entidadId");
CREATE INDEX IF NOT EXISTS "AuditLog_fecha_idx" ON "AuditLog"("fecha");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS "AuditLog_module_idx" ON "AuditLog"("module");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX IF NOT EXISTS "AuditLog_status_idx" ON "AuditLog"("status");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- ============================================================================
-- 5. SEMILLA DE DATOS (Seed)
-- ============================================================================

-- Inserción de Usuario Administrador Principal por Defecto (contraseña: Admin123!)
-- Hash bcryptjs con 10 rounds: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
INSERT INTO "Empleado" ("id", "nombre", "correo", "telefono", "passwordHash", "rol", "activo", "createdAt", "updatedAt")
VALUES (
    'admin-init-uuid-0000-000000000000',
    'Administrador Principal',
    'admin@sistema.com',
    '000000000',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'ADMIN',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("correo") DO UPDATE
SET "passwordHash" = EXCLUDED."passwordHash", "rol" = 'ADMIN';

-- Inserción de Configuración Global Inicial
INSERT INTO "Configuracion" ("id", "negocio", "horarios", "whatsapp", "apariencia", "updatedAt")
VALUES (
    'default',
    '{
        "nombre": "HAIR STYLE",
        "subtitulo": "Salón & Barber",
        "telefono": "",
        "whatsapp": "",
        "direccion": "",
        "web": "",
        "moneda": "USD",
        "zona_horaria": "America/Managua",
        "tipoCambio": 36.5
    }'::jsonb,
    '{
        "lunes":     { "activo": true,  "inicio": "08:00", "fin": "18:00" },
        "martes":    { "activo": true,  "inicio": "08:00", "fin": "18:00" },
        "miercoles": { "activo": true,  "inicio": "08:00", "fin": "18:00" },
        "jueves":    { "activo": true,  "inicio": "08:00", "fin": "18:00" },
        "viernes":   { "activo": true,  "inicio": "08:00", "fin": "18:00" },
        "sabado":    { "activo": true,  "inicio": "08:00", "fin": "14:00" },
        "domingo":   { "activo": false, "inicio": "09:00", "fin": "13:00" }
    }'::jsonb,
    '{
        "numero": "",
        "confirmar": true,
        "recordatorio": true,
        "cancelacion": true,
        "msgExtra": ""
    }'::jsonb,
    '{
        "tema": "system",
        "branding": true
    }'::jsonb,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

-- ============================================================================
-- 6. BLOQUE DE VERIFICACIÓN FINAL
-- ============================================================================
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
ORDER BY table_name, ordinal_position;
