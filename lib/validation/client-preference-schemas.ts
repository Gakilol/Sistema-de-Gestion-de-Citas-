import { TipoPreferenciaCliente } from '@prisma/client';
import { z } from 'zod';

export const createClientPreferenceSchema = z.object({
  tipo: z.nativeEnum(TipoPreferenciaCliente),
  titulo: z.string().trim().min(2).max(80),
  detalle: z.string().trim().min(2).max(1000),
});

