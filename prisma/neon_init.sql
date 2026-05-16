-- =====================================================
-- Sistema de Gestión de Citas - Script de Inicialización Avanzado
-- Base de datos PostgreSQL para Neon & Prisma
-- =====================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. FUNCIONES Y TRIGGERS BASE
-- =====================================================

-- Función para actualizar automáticamente el timestamp `updatedAt`
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================================
-- 2. ENUMS
-- =====================================================

CREATE TYPE "RolUsuario" AS ENUM ('CLIENTE', 'EMPLEADO', 'ADMIN');
CREATE TYPE "EstadoCita" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'EN_PROGRESO', 'COMPLETADA', 'CANCELADA', 'NO_ASISTIO', 'REPROGRAMADA');
CREATE TYPE "TipoAusencia" AS ENUM ('VACACIONES', 'ENFERMEDAD', 'PERMISO_PERSONAL', 'OTRO');
CREATE TYPE "AccionAuditoria" AS ENUM ('INSERT', 'UPDATE', 'DELETE');
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'COMPLETADO', 'FALLIDO', 'REEMBOLSADO');

-- =====================================================
-- 3. TABLAS: USUARIOS Y PERFILES
-- =====================================================

CREATE TABLE "Usuario" (
    "id"           TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nombre"       TEXT NOT NULL,
    "email"        TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "telefono"     TEXT,
    "rol"          "RolUsuario" NOT NULL DEFAULT 'CLIENTE',
    "activo"       BOOLEAN NOT NULL DEFAULT true,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt"    TIMESTAMP(3), -- Soft delete para mantener historial

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- Trigger para Usuario
CREATE TRIGGER set_timestamp_Usuario
BEFORE UPDATE ON "Usuario" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();


CREATE TABLE "PerfilCliente" (
    "id"                 TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId"             TEXT NOT NULL,
    "preferencias"       TEXT,
    "observaciones"      TEXT,
    "historialMedico"    TEXT,
    "totalCitas"         INTEGER NOT NULL DEFAULT 0,
    "totalInasistencias" INTEGER NOT NULL DEFAULT 0,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerfilCliente_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PerfilCliente_userId_key" ON "PerfilCliente"("userId");

CREATE TRIGGER set_timestamp_PerfilCliente
BEFORE UPDATE ON "PerfilCliente" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();


CREATE TABLE "PerfilEmpleado" (
    "id"              TEXT NOT NULL DEFAULT gen_random_uuid(),
    "userId"          TEXT NOT NULL,
    "colorCalendario" TEXT,
    "disponible"      BOOLEAN NOT NULL DEFAULT true,
    "rendimiento"     DOUBLE PRECISION, -- Ejemplo: rating 1-5
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerfilEmpleado_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PerfilEmpleado_userId_key" ON "PerfilEmpleado"("userId");

CREATE TRIGGER set_timestamp_PerfilEmpleado
BEFORE UPDATE ON "PerfilEmpleado" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();


CREATE TABLE "Especialidad" (
    "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nombre"      TEXT NOT NULL,
    "descripcion" TEXT,
    "activo"      BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Especialidad_pkey" PRIMARY KEY ("id")
);


CREATE TABLE "EmpleadoEspecialidad" (
    "empleadoId"     TEXT NOT NULL,
    "especialidadId" TEXT NOT NULL,

    CONSTRAINT "EmpleadoEspecialidad_pkey" PRIMARY KEY ("empleadoId", "especialidadId")
);


-- =====================================================
-- 4. TABLAS: CONFIGURACIÓN DEL NEGOCIO
-- =====================================================

CREATE TABLE "ConfiguracionGeneral" (
    "id"                     TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nombreNegocio"          TEXT NOT NULL,
    "direccion"              TEXT NOT NULL,
    "telefono"               TEXT NOT NULL,
    "email"                  TEXT NOT NULL,
    "sitioWeb"               TEXT,
    "logoUrl"                TEXT,
    "moneda"                 TEXT NOT NULL DEFAULT 'USD',
    "zonaHoraria"            TEXT NOT NULL DEFAULT 'UTC',
    "tiempoMinCancelacion"   INTEGER NOT NULL DEFAULT 24, -- Horas mínimas para cancelar sin penalidad
    "notificacionesEmail"    BOOLEAN NOT NULL DEFAULT true,
    "notificacionesSms"      BOOLEAN NOT NULL DEFAULT false,
    "notificacionesWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfiguracionGeneral_pkey" PRIMARY KEY ("id")
);

CREATE TRIGGER set_timestamp_ConfiguracionGeneral
BEFORE UPDATE ON "ConfiguracionGeneral" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();


CREATE TABLE "HorarioGlobal" (
    "id"           TEXT NOT NULL DEFAULT gen_random_uuid(),
    "diaSemana"    INTEGER NOT NULL, -- 0=Domingo, 1=Lunes, ...
    "horaApertura" TEXT NOT NULL,    -- Formato HH:MM
    "horaCierre"   TEXT NOT NULL,    -- Formato HH:MM
    "activo"       BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "HorarioGlobal_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "check_dia_semana" CHECK ("diaSemana" >= 0 AND "diaSemana" <= 6),
    CONSTRAINT "check_hora_valida" CHECK ("horaApertura" <= "horaCierre")
);


CREATE TABLE "DiaFeriado" (
    "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
    "fecha"       DATE NOT NULL,
    "descripcion" TEXT NOT NULL,
    "recurrente"  BOOLEAN NOT NULL DEFAULT false, -- Si se repite todos los años

    CONSTRAINT "DiaFeriado_pkey" PRIMARY KEY ("id")
);


CREATE TABLE "MetodoPago" (
    "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nombre"      TEXT NOT NULL,
    "descripcion" TEXT,
    "activo"      BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MetodoPago_pkey" PRIMARY KEY ("id")
);


-- =====================================================
-- 5. TABLAS: HORARIOS DE EMPLEADOS
-- =====================================================

CREATE TABLE "HorarioEmpleado" (
    "id"         TEXT NOT NULL DEFAULT gen_random_uuid(),
    "empleadoId" TEXT NOT NULL,
    "diaSemana"  INTEGER NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin"    TEXT NOT NULL,
    "activo"     BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "HorarioEmpleado_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "check_dia_semana_emp" CHECK ("diaSemana" >= 0 AND "diaSemana" <= 6),
    CONSTRAINT "check_hora_valida_emp" CHECK ("horaInicio" < "horaFin")
);


CREATE TABLE "AusenciaEmpleado" (
    "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
    "empleadoId"  TEXT NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaFin"    DATE NOT NULL,
    "tipo"        "TipoAusencia" NOT NULL,
    "motivo"      TEXT,
    "aprobado"    BOOLEAN NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AusenciaEmpleado_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "check_fecha_ausencia" CHECK ("fechaInicio" <= "fechaFin")
);


CREATE TABLE "BloqueoHorario" (
    "id"         TEXT NOT NULL DEFAULT gen_random_uuid(),
    "empleadoId" TEXT NOT NULL,
    "fecha"      DATE NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin"    TEXT NOT NULL,
    "motivo"     TEXT,

    CONSTRAINT "BloqueoHorario_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "check_bloqueo_hora" CHECK ("horaInicio" < "horaFin")
);


-- =====================================================
-- 6. TABLAS: SERVICIOS Y CITAS
-- =====================================================

CREATE TABLE "Servicio" (
    "id"              TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nombre"          TEXT NOT NULL,
    "descripcion"     TEXT,
    "duracionMinutos" INTEGER NOT NULL,
    "precio"          DOUBLE PRECISION NOT NULL,
    "activo"          BOOLEAN NOT NULL DEFAULT true,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt"       TIMESTAMP(3),

    CONSTRAINT "Servicio_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "check_duracion_positiva" CHECK ("duracionMinutos" > 0),
    CONSTRAINT "check_precio_positivo" CHECK ("precio" >= 0)
);

CREATE TRIGGER set_timestamp_Servicio
BEFORE UPDATE ON "Servicio" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();


CREATE TABLE "Cita" (
    "id"                 TEXT NOT NULL DEFAULT gen_random_uuid(),
    "clienteId"          TEXT NOT NULL,
    "empleadoId"         TEXT NOT NULL,
    "servicioId"         TEXT NOT NULL,
    "fecha"              DATE NOT NULL,
    "horaInicio"         TEXT NOT NULL,
    "horaFin"            TEXT NOT NULL,
    "estado"             "EstadoCita" NOT NULL DEFAULT 'PENDIENTE',
    "notasCliente"       TEXT,
    "notasInternas"      TEXT,
    "motivoCancelacion"  TEXT,
    "recordatorioEnviado" BOOLEAN NOT NULL DEFAULT false,
    "citaOriginalId"     TEXT, -- Si es una reprogramación, apunta a la original
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt"          TIMESTAMP(3),

    CONSTRAINT "Cita_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "check_hora_cita" CHECK ("horaInicio" < "horaFin")
);

CREATE TRIGGER set_timestamp_Cita
BEFORE UPDATE ON "Cita" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();


CREATE TABLE "HistorialCita" (
    "id"                 TEXT NOT NULL DEFAULT gen_random_uuid(),
    "citaId"             TEXT NOT NULL,
    "usuarioCambiadorId" TEXT, -- Quién hizo el cambio (puede ser admin, empleado o el cliente mismo)
    "estadoAnterior"     "EstadoCita" NOT NULL,
    "estadoNuevo"        "EstadoCita" NOT NULL,
    "notas"              TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialCita_pkey" PRIMARY KEY ("id")
);


-- =====================================================
-- 7. TABLAS: PAGOS, NOTIFICACIONES Y AUDITORÍA
-- =====================================================

CREATE TABLE "Pago" (
    "id"            TEXT NOT NULL DEFAULT gen_random_uuid(),
    "citaId"        TEXT NOT NULL,
    "monto"         DOUBLE PRECISION NOT NULL,
    "metodoPagoId"  TEXT,
    "estadoPago"    "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "referencia"    TEXT,
    "fechaPago"     TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "check_monto_pago" CHECK ("monto" >= 0)
);

CREATE TRIGGER set_timestamp_Pago
BEFORE UPDATE ON "Pago" FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();


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


CREATE TABLE "AuditoriaLog" (
    "id"               TEXT NOT NULL DEFAULT gen_random_uuid(),
    "usuarioId"        TEXT, -- El ID del usuario que hizo la acción (si se pasa desde la app)
    "tablaAfectada"    TEXT NOT NULL,
    "registroId"       TEXT NOT NULL,
    "accion"           "AccionAuditoria" NOT NULL,
    "valoresAnteriores" JSONB,
    "valoresNuevos"    JSONB,
    "ipAddress"        TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditoriaLog_pkey" PRIMARY KEY ("id")
);


-- =====================================================
-- 8. FOREIGN KEYS (Relaciones)
-- =====================================================

-- PerfilCliente -> Usuario
ALTER TABLE "PerfilCliente" ADD CONSTRAINT "PerfilCliente_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PerfilEmpleado -> Usuario
ALTER TABLE "PerfilEmpleado" ADD CONSTRAINT "PerfilEmpleado_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EmpleadoEspecialidad -> PerfilEmpleado y Especialidad
ALTER TABLE "EmpleadoEspecialidad" ADD CONSTRAINT "EmpleadoEspecialidad_empleadoId_fkey"
    FOREIGN KEY ("empleadoId") REFERENCES "PerfilEmpleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmpleadoEspecialidad" ADD CONSTRAINT "EmpleadoEspecialidad_especialidadId_fkey"
    FOREIGN KEY ("especialidadId") REFERENCES "Especialidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Horarios, Ausencias y Bloqueos -> PerfilEmpleado
ALTER TABLE "HorarioEmpleado" ADD CONSTRAINT "HorarioEmpleado_empleadoId_fkey"
    FOREIGN KEY ("empleadoId") REFERENCES "PerfilEmpleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AusenciaEmpleado" ADD CONSTRAINT "AusenciaEmpleado_empleadoId_fkey"
    FOREIGN KEY ("empleadoId") REFERENCES "PerfilEmpleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BloqueoHorario" ADD CONSTRAINT "BloqueoHorario_empleadoId_fkey"
    FOREIGN KEY ("empleadoId") REFERENCES "PerfilEmpleado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cita -> Cliente, Empleado, Servicio, Cita (Original)
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_empleadoId_fkey"
    FOREIGN KEY ("empleadoId") REFERENCES "PerfilEmpleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_servicioId_fkey"
    FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_citaOriginalId_fkey"
    FOREIGN KEY ("citaOriginalId") REFERENCES "Cita"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- HistorialCita -> Cita, Usuario (que cambió)
ALTER TABLE "HistorialCita" ADD CONSTRAINT "HistorialCita_citaId_fkey"
    FOREIGN KEY ("citaId") REFERENCES "Cita"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HistorialCita" ADD CONSTRAINT "HistorialCita_usuarioCambiadorId_fkey"
    FOREIGN KEY ("usuarioCambiadorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Pago -> Cita, MetodoPago
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_citaId_fkey"
    FOREIGN KEY ("citaId") REFERENCES "Cita"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_metodoPagoId_fkey"
    FOREIGN KEY ("metodoPagoId") REFERENCES "MetodoPago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Notificacion -> Usuario
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================
-- 9. ÍNDICES DE RENDIMIENTO
-- =====================================================

CREATE INDEX "Usuario_deletedAt_idx" ON "Usuario"("deletedAt");
CREATE INDEX "Cita_clienteId_idx" ON "Cita"("clienteId");
CREATE INDEX "Cita_empleadoId_idx" ON "Cita"("empleadoId");
CREATE INDEX "Cita_fecha_idx" ON "Cita"("fecha");
CREATE INDEX "Cita_estado_idx" ON "Cita"("estado");
CREATE INDEX "HorarioEmpleado_empleadoId_idx" ON "HorarioEmpleado"("empleadoId");
CREATE INDEX "Notificacion_userId_idx" ON "Notificacion"("userId");
CREATE INDEX "Pago_citaId_idx" ON "Pago"("citaId");
CREATE INDEX "AuditoriaLog_tablaAfectada_idx" ON "AuditoriaLog"("tablaAfectada");
CREATE INDEX "AuditoriaLog_registroId_idx" ON "AuditoriaLog"("registroId");

-- =====================================================
-- 10. DATOS INICIALES (Seed)
-- =====================================================

-- Admin por defecto (contraseña: Admin123!)
-- Hash bcrypt generado con 10 salt rounds
INSERT INTO "Usuario" ("id", "nombre", "email", "passwordHash", "telefono", "rol", "activo", "createdAt", "updatedAt")
VALUES (
    gen_random_uuid(),
    'Administrador Principal',
    'admin@sistema.com',
    '$2b$10$qUX6Db2MeaAbZXqYLurTo.tfbNfBBx3cxMWCVmUBc.F3WoyjtAVby',
    '555-0000',
    'ADMIN',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Configuración de negocio inicial
INSERT INTO "ConfiguracionGeneral" ("id", "nombreNegocio", "direccion", "telefono", "email", "moneda", "zonaHoraria", "tiempoMinCancelacion")
VALUES (
    gen_random_uuid(),
    'Mi Negocio Profesional',
    'Calle Principal 123',
    '+1234567890',
    'contacto@minegocio.com',
    'USD',
    'America/Mexico_City',
    24
);

-- Horarios globales (Lunes a Viernes 09:00 - 18:00, Sábado 10:00 - 14:00)
INSERT INTO "HorarioGlobal" ("diaSemana", "horaApertura", "horaCierre", "activo") VALUES 
(1, '09:00', '18:00', true),
(2, '09:00', '18:00', true),
(3, '09:00', '18:00', true),
(4, '09:00', '18:00', true),
(5, '09:00', '18:00', true),
(6, '10:00', '14:00', true),
(0, '00:00', '00:00', false);

-- Métodos de pago base
INSERT INTO "MetodoPago" ("id", "nombre", "descripcion", "activo") VALUES 
(gen_random_uuid(), 'Efectivo', 'Pago en efectivo en el local', true),
(gen_random_uuid(), 'Tarjeta de Crédito', 'Pago con tarjeta Visa/Mastercard', true),
(gen_random_uuid(), 'Transferencia Bancaria', 'Transferencia electrónica', true);

-- Servicios de ejemplo
INSERT INTO "Servicio" ("id", "nombre", "descripcion", "duracionMinutos", "precio", "activo")
VALUES
    (gen_random_uuid(), 'Consulta General', 'Consulta de valoración inicial', 30, 25.00, true),
    (gen_random_uuid(), 'Servicio Premium', 'Servicio completo especializado', 60, 80.00, true),
    (gen_random_uuid(), 'Mantenimiento', 'Revisión y mantenimiento de rutina', 45, 45.00, true);
