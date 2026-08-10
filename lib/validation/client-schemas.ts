import { z } from 'zod';

const optionalText = (maxLength: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().max(maxLength).trim().optional().nullable()
  );

export const clientBaseSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(150).trim(),
  telefono: optionalText(30),
  cedula: optionalText(50),
  correo: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().email('Correo inválido').max(254).trim().optional().nullable()
  ),
  notas: optionalText(1000),
});

export const createClientSchema = z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio (mínimo 2 caracteres)').max(150).trim(),
  telefono: z.string().max(30).trim().optional().nullable(),
  cedula: z.string().max(50).trim().optional().nullable(),
  correo: z.preprocess(
    (value) => (value === '' ? null : value),
    z.string().email('Correo inválido').max(254).trim().optional().nullable()
  ),
  notas: z.string().max(1000).trim().optional().nullable(),
  confirmarDuplicadoNombre: z.boolean().optional(),
});

export const updateClientSchema = clientBaseSchema;
