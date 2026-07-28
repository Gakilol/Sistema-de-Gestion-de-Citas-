import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Correo electrónico no válido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

export const CrearServicioSchema = z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio'),
  descripcion: z.string().optional(),
  categoria: z.string().optional(),
  duracion: z.number().min(5, 'La duración debe ser mayor a 5 minutos'),
});

export const CrearCitaSchema = z.object({
  cliente_nombre: z.string().min(2, 'El nombre del cliente es obligatorio'),
  cliente_telefono: z.string().optional(),
  empleado_id: z.string().uuid('ID de empleado inválido'),
  servicio_id: z.string().uuid('ID de servicio inválido'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  hora: z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido (HH:MM)'),
  notas: z.string().optional(),
});

const optionalText = (max: number) => z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? null : value,
  z.string().max(max).trim().optional().nullable()
);

export const ClienteBaseSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(150).trim(),
  telefono: optionalText(30),
  cedula: optionalText(50),
  correo: z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? null : value,
    z.string().email('Correo inválido').max(254).trim().optional().nullable()
  ),
  notas: optionalText(1000),
});

export const CrearClienteSchema = ClienteBaseSchema.extend({
  confirmarDuplicadoNombre: z.boolean().optional(),
});

export const ActualizarClienteSchema = ClienteBaseSchema;
