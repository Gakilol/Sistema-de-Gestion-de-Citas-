import { z } from 'zod';

export const RegistroSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Correo electrónico no válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  telefono: z.string().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email('Correo electrónico no válido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

export const CrearServicioSchema = z.object({
  nombre: z.string().min(2, 'El nombre es obligatorio'),
  descripcion: z.string().optional(),
  duracionMinutos: z.number().min(5, 'La duración debe ser mayor a 5 minutos'),
  precio: z.number().min(0, 'El precio no puede ser negativo'),
});

export const CrearCitaSchema = z.object({
  empleadoId: z.string().uuid('ID de empleado inválido'),
  servicioId: z.string().uuid('ID de servicio inválido'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido (HH:MM)'),
  notasCliente: z.string().optional(),
});
