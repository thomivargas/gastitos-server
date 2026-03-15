import { z } from 'zod';

// Mapeo de columnas CSV -> campos de Gastitos
export const mapeoColumnasSchema = z.object({
  fecha: z.string().min(1, 'Columna de fecha es requerida'),
  monto: z.string().min(1, 'Columna de monto es requerida'),
  descripcion: z.string().min(1, 'Columna de descripcion es requerida'),
  tipo: z.string().optional(),       // si no viene, se infiere del signo del monto
  categoria: z.string().optional(),  // nombre de categoria, se busca por nombre
  notas: z.string().optional(),
});

export const ejecutarImportSchema = z.object({
  cuentaId: z.string().uuid(),
  mapeo: mapeoColumnasSchema,
  formatoFecha: z.enum(['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD-MM-YYYY']).default('YYYY-MM-DD'),
  separadorDecimal: z.enum(['.', ',']).default('.'),
  aplicarReglas: z.boolean().default(true), // auto-categorizar con reglas del usuario
});

export const previewSchema = z.object({
  cuentaId: z.string().uuid(),
});

export const exportarQuerySchema = z.object({
  cuentaId: z.string().uuid().optional(),
  fechaDesde: z.string().date().optional(),
  fechaHasta: z.string().date().optional(),
});

export type MapeoColumnas = z.infer<typeof mapeoColumnasSchema>;
export type EjecutarImportInput = z.infer<typeof ejecutarImportSchema>;
export type ExportarQuery = z.infer<typeof exportarQuerySchema>;
