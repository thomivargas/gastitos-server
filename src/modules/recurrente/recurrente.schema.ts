import { z } from 'zod';

export const crearRecurrenteSchema = z.object({
  cuentaId: z.string().uuid(),
  tipo: z.enum(['INGRESO', 'GASTO']),
  monto: z.number().positive(),
  moneda: z.string().length(3).toUpperCase().optional(),
  descripcion: z.string().min(1).max(255),
  frecuencia: z.enum([
    'DIARIA',
    'SEMANAL',
    'QUINCENAL',
    'MENSUAL',
    'BIMESTRAL',
    'TRIMESTRAL',
    'SEMESTRAL',
    'ANUAL',
  ]),
  categoriaId: z.string().uuid().optional(),
  diaDelMes: z.number().int().min(1).max(31).optional(),
  diaDeLaSemana: z.number().int().min(0).max(6).optional(), // 0=lunes, 6=domingo
  proximaFecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido'),
  activa: z.boolean().default(true),
});

export const actualizarRecurrenteSchema = z.object({
  cuentaId: z.string().uuid().optional(),
  tipo: z.enum(['INGRESO', 'GASTO']).optional(),
  monto: z.number().positive().optional(),
  moneda: z.string().length(3).toUpperCase().optional(),
  descripcion: z.string().min(1).max(255).optional(),
  frecuencia: z
    .enum(['DIARIA', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'])
    .optional(),
  categoriaId: z.string().uuid().nullable().optional(),
  diaDelMes: z.number().int().min(1).max(31).nullable().optional(),
  diaDeLaSemana: z.number().int().min(0).max(6).nullable().optional(),
  proximaFecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Debe proporcionar al menos un campo para actualizar',
});

export type CrearRecurrenteInput = z.infer<typeof crearRecurrenteSchema>;
export type ActualizarRecurrenteInput = z.infer<typeof actualizarRecurrenteSchema>;
