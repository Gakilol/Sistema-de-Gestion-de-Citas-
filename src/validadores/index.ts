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
  precio: z.number().min(0, 'El precio no puede ser negativo'),
});

export const CrearCitaSchema = z.object({
  cliente_nombre: z.string().min(2, 'El nombre del cliente es obligatorio'),
  cliente_telefono: z.string().optional(),
  empleado_id: z.string().uuid('ID de empleado inválido'),
  servicio_id: z.string().uuid('ID de servicio inválido'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  hora: z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido (HH:MM)'),
  notas: z.string().optional(),
  metodo_pago: z.string().optional(),
});
