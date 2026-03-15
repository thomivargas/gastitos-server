import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Factory que retorna un middleware de validación con el schema Zod dado.
 * Valida req.body por defecto, o la parte del request indicada.
 */
export function validate(
  schema: ZodSchema,
  source: 'body' | 'query' | 'params' = 'body',
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      // El error handler global captura ZodError
      return next(result.error);
    }
    if (source === 'query') {
      Object.defineProperty(req, 'query', {
        value: result.data,
        writable: true,
        configurable: true,
      });
    } else {
      req[source] = result.data;
    }
    next();
  };
}

/**
 * Helper para obtener query/body/params tipados despues de pasar por validate().
 * Uso: const query = typedQuery<MiTipo>(req);
 */
export function typedQuery<T>(req: Request): T {
  return req.query as T;
}

export function typedParams<T>(req: Request): T {
  return req.params as T;
}
