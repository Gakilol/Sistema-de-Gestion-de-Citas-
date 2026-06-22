-- =============================================================================
-- MIGRATION: Analytics Module for NovaCita
-- Description: Adds NO_SHOW status, timestamp tracking columns, and indexes
--              to the Cita table for the Reportes y Analítica module.
-- Compatible: PostgreSQL / NeonDB
-- Date: 2026-06-22
-- =============================================================================

-- Step 1: Add NO_SHOW to the EstadoCita enum
-- PostgreSQL does not support removing enum values, only adding.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'NO_SHOW'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'EstadoCita')
  ) THEN
    ALTER TYPE "EstadoCita" ADD VALUE 'NO_SHOW';
  END IF;
END $$;

-- Step 2: Add analytics tracking columns to the Cita table
ALTER TABLE "Cita"
  ADD COLUMN IF NOT EXISTS "cancelled_at"  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "completed_at"  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "no_show_at"    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "cancel_reason" TEXT;

-- Step 3: Add missing performance indexes
CREATE INDEX IF NOT EXISTS "Cita_cliente_id_idx"    ON "Cita" ("cliente_id");
CREATE INDEX IF NOT EXISTS "Cita_servicio_id_idx"   ON "Cita" ("servicio_id");
CREATE INDEX IF NOT EXISTS "Cita_created_at_idx"    ON "Cita" ("created_at");
CREATE INDEX IF NOT EXISTS "Cita_cancelled_at_idx"  ON "Cita" ("cancelled_at");
CREATE INDEX IF NOT EXISTS "Cita_completed_at_idx"  ON "Cita" ("completed_at");

-- Step 4: Backfill completed_at for historical COMPLETADA appointments.
-- We use the appointment date + hora (stored as 'HH:MM') as the completion time.
-- This is approximate but better than NULL for reporting purposes.
UPDATE "Cita"
SET "completed_at" = (
  -- Combine the DB date with the hora string to form a UTC timestamp
  ("fecha"::DATE || ' ' || "hora" || ':00')::TIMESTAMPTZ
  + ("duracion" || ' minutes')::INTERVAL
)
WHERE "estado" = 'COMPLETADA'
  AND "completed_at" IS NULL;

-- Step 5: Backfill cancelled_at from the AuditLog table for historical cancellations.
-- This may not be complete if some cancellations were not audited, but captures what we have.
UPDATE "Cita" c
SET "cancelled_at" = (
  SELECT a."fecha"
  FROM "AuditLog" a
  WHERE a."entidad" = 'Cita'
    AND a."entidadId" = c."id"
    AND a."accion" IN ('CANCELAR', 'ACTUALIZAR')
    -- Only pick audit entries that reference a cancellation state change
    AND (a."detalles"::jsonb -> 'cambios' ->> 'estado' = 'CANCELADA'
         OR a."detalles"::jsonb ->> 'estado' = 'CANCELADA')
  ORDER BY a."fecha" DESC
  LIMIT 1
)
WHERE c."estado" = 'CANCELADA'
  AND c."cancelled_at" IS NULL;

-- =============================================================================
-- VERIFICATION QUERY
-- Run this to confirm the migration applied correctly:
-- =============================================================================
-- SELECT
--   column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'Cita'
--   AND column_name IN ('cancelled_at', 'completed_at', 'no_show_at', 'cancel_reason');
--
-- SELECT enumlabel FROM pg_enum
-- WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'EstadoCita');
