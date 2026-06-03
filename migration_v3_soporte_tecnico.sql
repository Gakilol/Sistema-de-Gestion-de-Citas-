-- ============================================================
-- MIGRACIÓN v3: Soporte Técnico, Correo Cliente, Servicios Duplicados
-- Sistema de Gestión de Citas
-- Ejecutar en pgAdmin o consola de NeonDB
-- Compatible con PostgreSQL 15+ y NeonDB
-- ============================================================

-- 1. Agregar columna correo (opcional) a la tabla Cliente
ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "correo" TEXT;

-- 2. Hacer la columna telefono opcional en la tabla Cliente (DROP NOT NULL si existiese)
ALTER TABLE "Cliente" ALTER COLUMN "telefono" DROP NOT NULL;

-- 3. Eliminar restricción de llave única en CitaServicio
--    para permitir múltiples registros del mismo servicio en la misma cita
ALTER TABLE "CitaServicio" DROP CONSTRAINT IF EXISTS "CitaServicio_cita_servicio_key";
DROP INDEX IF EXISTS "CitaServicio_cita_servicio_key";

-- 4. Registrar valor 'TECH_SUPPORT' en el tipo ENUM "RolUsuario" si no existe aún
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE t.typname = 'RolUsuario' AND e.enumlabel = 'TECH_SUPPORT'
    ) THEN
        ALTER TYPE "RolUsuario" ADD VALUE 'TECH_SUPPORT';
    END IF;
END
$$;

-- ============================================================
-- FIN DE MIGRACIÓN v3
-- ============================================================
