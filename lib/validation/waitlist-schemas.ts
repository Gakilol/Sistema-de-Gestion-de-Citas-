import { EstadoListaEspera } from '@prisma/client';
import { z } from 'zod';
import { isValidBusinessDateString } from '@/lib/timezone';

const optionalId = z.string().uuid().optional().nullable();
const optionalDate = z.string().refine(isValidBusinessDateString, 'Fecha inválida').optional().nullable();

export const createWaitlistSchema = z.object({
  clienteId: z.string().uuid(),
  servicioId: optionalId,
  empleadoId: optionalId,
  fechaDesde: optionalDate,
  fechaHasta: optionalDate,
  jornadaPreferida: z.enum(['MANANA', 'TARDE', 'CUALQUIERA']).optional().nullable(),
  notas: z.string().trim().max(500).optional().nullable(),
  prioridad: z.number().int().min(0).max(2).optional().default(0),
}).refine((value) => !value.fechaDesde || !value.fechaHasta || value.fechaDesde <= value.fechaHasta, {
  message: 'La fecha final debe ser igual o posterior a la fecha inicial.',
  path: ['fechaHasta'],
});

export const updateWaitlistSchema = z.object({
  estado: z.nativeEnum(EstadoListaEspera).optional(),
  prioridad: z.number().int().min(0).max(2).optional(),
  notas: z.string().trim().max(500).optional().nullable(),
}).refine((value) => Object.keys(value).length > 0, 'No hay cambios para guardar.');

