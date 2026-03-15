import { z } from 'zod';
import { paginationSchema } from '@utils/pagination';

const tipoTransaccionEnum = z.enum(['INGRESO', 'GASTO', 'TRANSFERENCIA']);

export const crearTransaccionSchema = z.object({
  cuentaId: z.string().uuid(),
  tipo: tipoTransaccionEnum,
  monto: z.number().positive('El monto debe ser mayor a 0'),
  moneda: z.string().length(3).toUpperCase().optional(),
  fecha: z.string().date('Fecha invalida (formato: YYYY-MM-DD)'),
  descripcion: z.string().min(1, 'La descripcion es requerida').max(200).trim(),
  categoriaId: z.string().uuid().optional(),
  notas: z.string().max(500).optional(),
  etiquetaIds: z.array(z.string().uuid()).optional(),
  excluida: z.boolean().optional(),
});

export const actualizarTransaccionSchema = z.object({
  tipo: tipoTransaccionEnum.optional(),
  monto: z.number().positive().optional(),
  moneda: z.string().length(3).toUpperCase().optional(),
  fecha: z.string().date().optional(),
  descripcion: z.string().min(1).max(200).trim().optional(),
  categoriaId: z.string().uuid().nullable().optional(),
  notas: z.string().max(500).nullable().optional(),
  etiquetaIds: z.array(z.string().uuid()).optional(),
  excluida: z.boolean().optional(),
});

export const listaTransaccionQuerySchema = paginationSchema.extend({
  cuentaId: z.string().uuid().optional(),
  categoriaId: z.string().uuid().optional(),
  tipo: tipoTransaccionEnum.optional(),
  fechaDesde: z.string().date().optional(),
  fechaHasta: z.string().date().optional(),
  montoMin: z.coerce.number().positive().optional(),
  montoMax: z.coerce.number().positive().optional(),
  busqueda: z.string().max(100).optional(),
  etiquetaIds: z
    .union([z.string().uuid(), z.array(z.string().uuid())])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .optional(),
  excluida: z.coerce.boolean().optional(),
  ordenarPor: z.enum(['fecha', 'monto', 'descripcion', 'creadoEl']).default('fecha'),
  orden: z.enum(['asc', 'desc']).default('desc'),
});

export type CrearTransaccionInput = z.infer<typeof crearTransaccionSchema>;
export type ActualizarTransaccionInput = z.infer<typeof actualizarTransaccionSchema>;
export type ListaTransaccionQuery = z.infer<typeof listaTransaccionQuerySchema>;
