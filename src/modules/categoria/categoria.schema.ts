import { z } from 'zod';

const clasificacionEnum = z.enum(['INGRESO', 'GASTO']);

export const crearCategoriaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(50).trim(),
  clasificacion: clasificacionEnum,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color hexadecimal invalido').optional(),
  icono: z.string().max(50).optional(),
  padreId: z.string().uuid().optional(),
});

export const actualizarCategoriaSchema = z.object({
  nombre: z.string().min(1).max(50).trim().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icono: z.string().max(50).optional(),
});

export const listaCategoriaQuerySchema = z.object({
  clasificacion: clasificacionEnum.optional(),
});

export type CrearCategoriaInput = z.infer<typeof crearCategoriaSchema>;
export type ActualizarCategoriaInput = z.infer<typeof actualizarCategoriaSchema>;
export type ListaCategoriaQuery = z.infer<typeof listaCategoriaQuerySchema>;
