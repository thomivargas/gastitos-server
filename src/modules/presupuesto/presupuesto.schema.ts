import { z } from 'zod';
import { paginationSchema } from '@utils/pagination';

export const crearPresupuestoSchema = z.object({
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
  fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
  gastoPresupuestado: z.number().positive().optional(),
  ingresoEsperado: z.number().positive().optional(),
  moneda: z.string().length(3, 'La moneda debe tener 3 letras').toUpperCase(),
  categorias: z
    .array(
      z.object({
        categoriaId: z.string().uuid(),
        montoPresupuestado: z.number().positive(),
      })
    )
    .optional(),
}).refine(
  (data) => new Date(data.fechaFin) > new Date(data.fechaInicio),
  { message: 'fechaFin debe ser posterior a fechaInicio', path: ['fechaFin'] }
);

export const actualizarPresupuestoSchema = z.object({
  gastoPresupuestado: z.number().positive().optional(),
  ingresoEsperado: z.number().positive().optional(),
  moneda: z.string().length(3).toUpperCase().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Debe proporcionar al menos un campo para actualizar' }
);

export const asignarCategoriaSchema = z.object({
  categoriaId: z.string().uuid(),
  montoPresupuestado: z.number().positive(),
});

export const listaPresupuestoQuerySchema = paginationSchema.extend({
  anio: z.coerce.number().int().min(2000).max(2100).optional(),
  mes: z.coerce.number().int().min(1).max(12).optional(),
});

export type ListaPresupuestoQuery = z.infer<typeof listaPresupuestoQuerySchema>;

export const copiarPresupuestoSchema = z.object({
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
  fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
}).refine(
  (data) => new Date(data.fechaFin) > new Date(data.fechaInicio),
  { message: 'fechaFin debe ser posterior a fechaInicio', path: ['fechaFin'] }
);
