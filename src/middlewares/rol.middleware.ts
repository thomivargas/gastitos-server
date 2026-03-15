import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from './errors';

/**
 * Middleware de autorización por rol.
 * Uso: router.get('/admin', authenticate, requireRole('ADMIN'), handler)
 */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    if (!roles.includes(req.user.role as string)) {
      return next(new ForbiddenError(`Se requiere rol: ${roles.join(' o ')}`));
    }

    next();
  };
}
