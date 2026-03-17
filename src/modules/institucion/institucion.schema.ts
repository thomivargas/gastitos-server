import { z } from 'zod';

export const crearInstitucionSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(100).trim(),
  tipo: z.enum(['BANCO', 'BILLETERA_VIRTUAL', 'OTRA']).default('BANCO'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color hexadecimal invalido').optional(),
  icono: z.string().max(50).optional(),
});

export const actualizarInstitucionSchema = z.object({
  nombre: z.string().min(1).max(100).trim().optional(),
  tipo: z.enum(['BANCO', 'BILLETERA_VIRTUAL', 'OTRA']).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icono: z.string().max(50).optional(),
});

export const listarInstitucionesSchema = z.object({
  tipo: z.enum(['BANCO', 'BILLETERA_VIRTUAL', 'OTRA']).optional(),
  search: z.string().max(100).optional(),
});

export type CrearInstitucionInput = z.infer<typeof crearInstitucionSchema>;
export type ActualizarInstitucionInput = z.infer<typeof actualizarInstitucionSchema>;
export type ListarInstitucionesQuery = z.infer<typeof listarInstitucionesSchema>;
