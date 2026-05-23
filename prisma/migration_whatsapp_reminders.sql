-- ==============================================================================
-- MIGRACIÓN DE BD V3: RECORDATORIOS AUTOMÁTICOS DE WHATSAPP
-- ==============================================================================

-- 1. Agregar nuevas columnas de control para los recordatorios de WhatsApp en Cita
ALTER TABLE "Cita" ADD COLUMN IF NOT EXISTS "whatsapp_reminder_sent" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "Cita" ADD COLUMN IF NOT EXISTS "whatsapp_reminder_sent_at" TIMESTAMP(3);

-- 2. Crear un índice de rendimiento para optimizar la consulta periódica de citas pendientes de envío
CREATE INDEX IF NOT EXISTS "Cita_whatsapp_reminder_sent_fecha_idx" ON "Cita"("whatsapp_reminder_sent", "fecha", "estado");
