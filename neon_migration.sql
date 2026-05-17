-- 1. Crear la tabla Cliente
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- 2. Agregar la columna a la tabla Cita
ALTER TABLE "Cita" ADD COLUMN "cliente_id" TEXT;

-- 3. Crear la relación de clave foránea
ALTER TABLE "Cita" ADD CONSTRAINT "Cita_cliente_id_fkey" 
  FOREIGN KEY ("cliente_id") REFERENCES "Cliente"("id") 
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Migrar los clientes únicos de Cita a la nueva tabla Cliente
INSERT INTO "Cliente" ("nombre", "telefono", "updatedAt")
SELECT DISTINCT 
  trim("cliente_nombre"), 
  trim(COALESCE("cliente_telefono", '')), 
  CURRENT_TIMESTAMP
FROM "Cita"
WHERE "cliente_nombre" IS NOT NULL AND "cliente_nombre" != '';

-- 5. Actualizar la tabla Cita para asignar los nuevos cliente_id
UPDATE "Cita" c
SET "cliente_id" = cl."id"
FROM "Cliente" cl
WHERE trim(c."cliente_nombre") = cl."nombre"
  AND trim(COALESCE(c."cliente_telefono", '')) = COALESCE(cl."telefono", '');
