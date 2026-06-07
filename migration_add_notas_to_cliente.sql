-- ============================================================
-- MIGRACIÓN: Añadir campo 'notas' a la tabla Cliente
-- Fecha: 2026-06-07
-- Aplicar en producción (Vercel / PostgreSQL cloud)
-- ============================================================

-- Esta migración es segura (ADD COLUMN con IF NOT EXISTS = no rompe nada si ya existe)
ALTER TABLE "Cliente"
  ADD COLUMN IF NOT EXISTS "notas" TEXT;

-- Verificar cambio
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'Cliente' AND column_name = 'notas';
