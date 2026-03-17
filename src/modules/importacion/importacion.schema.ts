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

// Esquema para importacion bancaria (parsers especificos por banco)
export const ejecutarImportBancarioSchema = z.object({
  parserId: z.string().min(1, 'Debe especificar un parser bancario'),
  cuentas: z.record(z.string(), z.string().uuid()).refine(
    (obj) => Object.keys(obj).length > 0,
    'Debe seleccionar al menos una cuenta',
  ),
  aplicarReglas: z.boolean().default(true),
  excluirCargosBancarios: z.boolean().default(true),
  fechaResumen: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD requerido').optional(),
});

export type EjecutarImportBancarioInput = z.infer<typeof ejecutarImportBancarioSchema>;

export const previewBancarioSchema = z.object({
  parserId: z.string().min(1),
});

export type MapeoColumnas = z.infer<typeof mapeoColumnasSchema>;
export type EjecutarImportInput = z.infer<typeof ejecutarImportSchema>;
