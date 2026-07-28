-- Safe additive migration: existing clients keep their data and cedula remains optional.
ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "cedula" TEXT;
