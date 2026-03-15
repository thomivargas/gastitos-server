import { z } from 'zod';
import { paginationSchema } from '@utils/pagination';

const transferenciaBaseShape = {
  cuentaOrigenId: z.string().uuid(),
  cuentaDestinoId: z.string().uuid(),
  monto: z.number().positive('El monto debe ser mayor a 0'),
  montoDestino: z.number().positive().optional(),
  fecha: z.string().date('Fecha invalida (formato: YYYY-MM-DD)'),
  descripcion: z.string().max(200).trim().optional(),
  notas: z.string().max(500).optional(),
};

const cuentasDistintasRefine = (d: { cuentaOrigenId: string; cuentaDestinoId: string }) =>
  d.cuentaOrigenId !== d.cuentaDestinoId;

const cuentasDistintasMsg = {
  message: 'La cuenta origen y destino no pueden ser la misma',
  path: ['cuentaDestinoId'] as string[],
};

function fechaDentroDelRango(fecha: string, forzar = false): boolean {
  if (forzar) return true;
  const f = new Date(fecha);
  const hoy = new Date();
  const limite = new Date(hoy);
  limite.setDate(hoy.getDate() - 30);
  return f >= limite;
}

const fechaMsg = {
  message: 'La fecha no puede ser mayor a 30 dias en el pasado. Usa forzar: true para omitir esta validacion.',
  path: ['fecha'] as string[],
};

export const crearTransferenciaSchema = z
  .object(transferenciaBaseShape)
  .refine(cuentasDistintasRefine, cuentasDistintasMsg)
  .refine((d) => fechaDentroDelRango(d.fecha), fechaMsg);

export const crearTransferenciaConForzarSchema = z
  .object({ ...transferenciaBaseShape, forzar: z.boolean().default(false) })
  .refine(cuentasDistintasRefine, cuentasDistintasMsg)
  .refine((d) => fechaDentroDelRango(d.fecha, d.forzar), fechaMsg);

export const listaTransferenciaQuerySchema = paginationSchema.extend({
  cuentaId: z.string().uuid().optional(),
  fechaDesde: z.string().date().optional(),
  fechaHasta: z.string().date().optional(),
  ordenarPor: z.enum(['fecha', 'monto', 'creadoEl']).default('fecha'),
  orden: z.enum(['asc', 'desc']).default('desc'),
});

export type CrearTransferenciaInput = z.infer<typeof crearTransferenciaConForzarSchema>;
export type ListaTransferenciaQuery = z.infer<typeof listaTransferenciaQuerySchema>;
