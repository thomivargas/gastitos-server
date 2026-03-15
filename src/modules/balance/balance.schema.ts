import { z } from 'zod';

const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;

export const historialQuerySchema = z.object({
  cuentaId: z.string().uuid().optional(),
  desde: z.string().regex(fechaRegex, 'Formato YYYY-MM-DD requerido').optional(),
  hasta: z.string().regex(fechaRegex, 'Formato YYYY-MM-DD requerido').optional(),
});

export const patrimonioQuerySchema = z.object({
  desde: z.string().regex(fechaRegex, 'Formato YYYY-MM-DD requerido').optional(),
  hasta: z.string().regex(fechaRegex, 'Formato YYYY-MM-DD requerido').optional(),
});

export type HistorialQuery = z.infer<typeof historialQuerySchema>;
export type PatrimonioQuery = z.infer<typeof patrimonioQuerySchema>;
