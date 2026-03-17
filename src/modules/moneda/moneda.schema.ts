import { z } from 'zod';

export const convertirQuerySchema = z.object({
  de: z.string().length(3).toUpperCase(),
  a: z.string().length(3).toUpperCase(),
  monto: z.coerce.number().positive(),
  tipo: z.enum(['blue', 'mep', 'oficial', 'tarjeta']).default('blue'),
});

export const tasasQuerySchema = z.object({
  base: z.string().length(3).toUpperCase().default('ARS'),
});

export type ConvertirQuery = z.infer<typeof convertirQuerySchema>;
