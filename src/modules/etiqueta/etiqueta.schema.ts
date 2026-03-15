import { z } from 'zod';

export const crearEtiquetaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(30).trim(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color hexadecimal invalido').optional(),
});

export const actualizarEtiquetaSchema = z.object({
  nombre: z.string().min(1).max(30).trim().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export type CrearEtiquetaInput = z.infer<typeof crearEtiquetaSchema>;
export type ActualizarEtiquetaInput = z.infer<typeof actualizarEtiquetaSchema>;
