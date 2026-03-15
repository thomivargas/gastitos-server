import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from './errors';
import { env } from '../config/env';
import { logger } from '../config/logger';

/**
 * Middleware global de manejo de errores.
 * Debe ser el ÚLTIMO middleware registrado en app.ts.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // ─── Errores de validación Zod ─────────────────────────────────────────────
  if (err instanceof ZodError) {
    res.status(400).json({
      status: 'error',
      message: 'Datos inválidos',
      errors: err.flatten().fieldErrors,
    });
    return;
  }

  // ─── Errores operacionales propios ────────────────────────────────────────
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
    return;
  }

  // ─── Errores de Prisma ────────────────────────────────────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002: Unique constraint violation
    if (err.code === 'P2002') {
      const field = (err.meta?.target as string[])?.join(', ') ?? 'campo';
      res.status(409).json({
        status: 'error',
        message: `El ${field} ya está en uso`,
      });
      return;
    }

    // P2025: Record not found
    if (err.code === 'P2025') {
      res.status(404).json({
        status: 'error',
        message: 'Registro no encontrado',
      });
      return;
    }
  }

  // ─── Errores no controlados ───────────────────────────────────────────────
  logger.error(
    {
      err,
      method: req.method,
      route: req.originalUrl,
      statusCode: 500,
    },
    `${req.method} ${req.originalUrl} → 500: ${err.message}`,
  );

  res.status(500).json({
    status: 'error',
    message: 'Error interno del servidor',
    // Solo en desarrollo mostramos el stack trace
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
