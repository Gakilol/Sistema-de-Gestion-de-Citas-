-- ==========================================
-- MIGRACIÓN DE BD V2: CATEGORÍAS Y MULTISERVICIOS
-- ==========================================

-- ------------------------------------------
-- FASE 1: Tabla Categoria y Relaciones
-- ------------------------------------------

-- 1. Crear tabla Categoria
CREATE TABLE IF NOT EXISTS "Categoria" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "nombre" TEXT NOT NULL,
  "color" TEXT DEFAULT '#6366f1',
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- 2. Crear índice único para el nombre de la categoría
CREATE UNIQUE INDEX IF NOT EXISTS "Categoria_nombre_key" ON "Categoria"("nombre");

-- 3. Agregar columna categoria_id a la tabla Servicio
ALTER TABLE "Servicio" ADD COLUMN IF NOT EXISTS "categoria_id" TEXT;

-- 4. Agregar llave foránea a Servicio
ALTER TABLE "Servicio" 
  ADD CONSTRAINT "Servicio_categoria_id_fkey" 
  FOREIGN KEY ("categoria_id") 
  REFERENCES "Categoria"("id") 
  ON DELETE SET NULL 
  ON UPDATE CASCADE;

-- 5. Migrar las categorías existentes de tipo texto en Servicio a la nueva tabla Categoria
INSERT INTO "Categoria" ("nombre", "color", "activo", "orden")
SELECT DISTINCT "categoria", '#6366f1', true, 0
FROM "Servicio"
WHERE "categoria" IS NOT NULL AND "categoria" != ''
ON CONFLICT ("nombre") DO NOTHING;

-- 6. Actualizar categoria_id en Servicio según los registros creados
UPDATE "Servicio" s
SET "categoria_id" = c.id
FROM "Categoria" c
WHERE s."categoria" = c."nombre" AND s."categoria_id" IS NULL;


-- ------------------------------------------
-- FASE 2: Tabla CitaServicio y Relaciones
-- ------------------------------------------

-- 1. Crear tabla intermedia CitaServicio
CREATE TABLE IF NOT EXISTS "CitaServicio" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "cita_id" TEXT NOT NULL,
  "servicio_id" TEXT NOT NULL,
  "duracion" INTEGER NOT NULL,
  "orden" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "CitaServicio_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CitaServicio_cita_id_fkey"
    FOREIGN KEY ("cita_id") REFERENCES "Cita"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CitaServicio_servicio_id_fkey"
    FOREIGN KEY ("servicio_id") REFERENCES "Servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 2. Crear índices de rendimiento e integridad
CREATE INDEX IF NOT EXISTS "CitaServicio_cita_id_idx" ON "CitaServicio"("cita_id");
CREATE UNIQUE INDEX IF NOT EXISTS "CitaServicio_cita_servicio_key" ON "CitaServicio"("cita_id", "servicio_id");

-- 3. Migrar las relaciones 1:1 existentes de Citas hacia CitaServicio
INSERT INTO "CitaServicio" ("cita_id", "servicio_id", "duracion", "orden")
SELECT c.id, c.servicio_id, c.duracion, 0
FROM "Cita" c
WHERE c.servicio_id IS NOT NULL
ON CONFLICT ("cita_id", "servicio_id") DO NOTHING;
