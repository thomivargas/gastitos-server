import { z } from 'zod';

export const actualizarPerfilSchema = z.object({
  nombre: z.string().min(2).max(100).trim().optional(),
  moneda: z.string().length(3, 'La moneda debe ser un código ISO de 3 letras').toUpperCase().optional(),
  preferencias: z
    .object({
      formatoFecha: z.string().optional(),
      locale: z.string().optional(),
      zonaHoraria: z.string().optional(),
    })
    .optional(),
});

export type ActualizarPerfilInput = z.infer<typeof actualizarPerfilSchema>;
