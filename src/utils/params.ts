import { z } from 'zod';
import type { Request } from 'express';

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

/** Extrae req.params.id ya validado por idParamSchema como string. */
export function paramId(req: Request): string {
  return req.params.id as string;
}
