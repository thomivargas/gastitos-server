import { z } from 'zod';
import { paginationSchema } from '@utils/pagination';

const tipoCuentaEnum = z.enum([
  'EFECTIVO',
  'BANCO_CORRIENTE',
  'BANCO_AHORRO',
  'BILLETERA_VIRTUAL',
  'TARJETA_CREDITO',
  'INVERSION',
  'PRESTAMO',
  'OTRO_ACTIVO',
  'OTRO_PASIVO',
]);

const estadoCuentaEnum = z.enum(['ACTIVA', 'INACTIVA', 'ARCHIVADA']);
const clasificacionEnum = z.enum(['ACTIVO', 'PASIVO']);

export const crearCuentaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(100).trim(),
  tipo: tipoCuentaEnum,
  moneda: z.string().length(3, 'Codigo ISO de 3 letras').toUpperCase().default('ARS'),
  balanceInicial: z.number().default(0),
  institucionId: z.string().uuid().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color hexadecimal invalido').optional(),
  icono: z.string().max(50).optional(),
  notas: z.string().max(500).optional(),
  detalles: z.record(z.string(), z.unknown()).optional(),
});

export const actualizarCuentaSchema = z.object({
  nombre: z.string().min(1).max(100).trim().optional(),
  moneda: z.string().length(3).toUpperCase().optional(),
  institucionId: z.string().uuid().nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icono: z.string().max(50).optional(),
  notas: z.string().max(500).nullable().optional(),
  detalles: z.record(z.string(), z.unknown()).optional(),
});

export const listaCuentasQuerySchema = paginationSchema.extend({
  estado: estadoCuentaEnum.optional(),
  tipo: tipoCuentaEnum.optional(),
  clasificacion: clasificacionEnum.optional(),
  ordenarPor: z.enum(['nombre', 'balance', 'creadoEl']).default('creadoEl'),
  orden: z.enum(['asc', 'desc']).default('desc'),
});

export type CrearCuentaInput = z.infer<typeof crearCuentaSchema>;
export type ActualizarCuentaInput = z.infer<typeof actualizarCuentaSchema>;
export type ListaCuentasQuery = z.infer<typeof listaCuentasQuerySchema>;
