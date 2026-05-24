-- =========================================================================
-- MIGRACIÓN DE BD: SOPORTE PARA SERVICIOS REPETIDOS EN UNA SOLA CITA
-- =========================================================================
-- Ejecuta este script SQL en la consola de tu Neon Database en Vercel
-- para remover el índice de clave única y permitir la duplicidad de servicios.

-- 1. Eliminar el índice único que impide servicios duplicados en la misma cita
DROP INDEX IF EXISTS "CitaServicio_cita_servicio_key";

-- (Opcional) Si Prisma creó el índice como una restricción de tabla (constraint) en lugar de índice independiente,
-- ejecutamos la eliminación segura de la restricción para evitar fallos de llave única:
ALTER TABLE "CitaServicio" DROP CONSTRAINT IF EXISTS "CitaServicio_cita_servicio_key";

-- ¡Listo! Ahora tu base de datos de producción admite múltiples registros del mismo servicio para una sola cita.
