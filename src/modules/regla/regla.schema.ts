import { z } from 'zod';

export const crearReglaSchema = z.object({
  nombre: z.string().min(1).max(100).trim(),
  patron: z.string().min(1).max(200).trim(),
  categoriaId: z.string().uuid(),
  prioridad: z.number().int().min(0).max(1000).default(0),
  activa: z.boolean().default(true),
});

export const actualizarReglaSchema = z.object({
  nombre: z.string().min(1).max(100).trim().optional(),
  patron: z.string().min(1).max(200).trim().optional(),
  categoriaId: z.string().uuid().optional(),
  prioridad: z.number().int().min(0).max(1000).optional(),
  activa: z.boolean().optional(),
});

export const sugerirSchema = z.object({
  descripcion: z.string().min(1).max(500).trim(),
});

export type CrearReglaInput = z.infer<typeof crearReglaSchema>;
export type ActualizarReglaInput = z.infer<typeof actualizarReglaSchema>;
export type SugerirInput = z.infer<typeof sugerirSchema>;
