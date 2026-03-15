import { z } from 'zod';

const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;

export const resumenMensualQuerySchema = z.object({
  anio: z.coerce.number().int().min(2000).max(2100),
  mes: z.coerce.number().int().min(1).max(12),
  moneda: z.string().length(3).toUpperCase().optional(),
  tipoDolar: z.enum(['blue', 'mep', 'oficial']).default('blue'),
  soloMoneda: z.coerce.boolean().default(false),
});

export const rangoFechaQuerySchema = z.object({
  desde: z.string().regex(fechaRegex, 'Formato YYYY-MM-DD requerido').optional(),
  hasta: z.string().regex(fechaRegex, 'Formato YYYY-MM-DD requerido').optional(),
});

export const tendenciaMensualQuerySchema = z.object({
  meses: z.coerce.number().int().min(1).max(24).default(12),
});

export const flujoCajaQuerySchema = z.object({
  desde: z.string().regex(fechaRegex, 'Formato YYYY-MM-DD requerido').optional(),
  hasta: z.string().regex(fechaRegex, 'Formato YYYY-MM-DD requerido').optional(),
  agrupacion: z.enum(['dia', 'semana', 'mes']).default('mes'),
});

export const topGastosQuerySchema = z.object({
  desde: z.string().regex(fechaRegex, 'Formato YYYY-MM-DD requerido').optional(),
  hasta: z.string().regex(fechaRegex, 'Formato YYYY-MM-DD requerido').optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type ResumenMensualQuery = z.infer<typeof resumenMensualQuerySchema>;
export type RangoFechaQuery = z.infer<typeof rangoFechaQuerySchema>;
export type TendenciaMensualQuery = z.infer<typeof tendenciaMensualQuerySchema>;
export type FlujoCajaQuery = z.infer<typeof flujoCajaQuerySchema>;
export type TopGastosQuery = z.infer<typeof topGastosQuerySchema>;
