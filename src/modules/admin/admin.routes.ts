import { Router } from 'express';
import { asyncHandler } from '@utils/asyncHandler';
import { authenticate } from '@middlewares/auth.middleware';
import { requireRole } from '@middlewares/rol.middleware';
import { colaRecurrentes, colaTasas } from '@config/queue';

const router = Router();

// Todas las rutas de admin requieren autenticacion + rol ADMIN
router.use(authenticate);
router.use(requireRole('ADMIN'));

/**
 * GET /api/admin/queues
 * Retorna el estado de todas las colas de BullMQ.
 * Solo para uso interno / dev — no exponer en produccion sin autenticacion de admin.
 */
router.get(
  '/queues',
  asyncHandler(async (_req, res) => {
    const [recurrentesCounts, tasasCounts] = await Promise.all([
      colaRecurrentes.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
      colaTasas.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
    ]);

    res.json({
      status: 'ok',
      data: {
        recurrentes: { nombre: 'recurrentes', ...recurrentesCounts },
        tasas: { nombre: 'tasas-cambio', ...tasasCounts },
      },
    });
  })
);

/**
 * GET /api/admin/queues/recurrentes/jobs
 * Lista los ultimos jobs de la cola de recurrentes.
 */
router.get(
  '/queues/recurrentes/jobs',
  asyncHandler(async (_req, res) => {
    const [completed, failed, active] = await Promise.all([
      colaRecurrentes.getCompleted(0, 9),
      colaRecurrentes.getFailed(0, 9),
      colaRecurrentes.getActive(),
    ]);

    res.json({
      status: 'ok',
      data: {
        active: active.map((j) => ({ id: j.id, data: j.data, progreso: j.progress })),
        completed: completed.map((j) => ({ id: j.id, returnValue: j.returnvalue, finalizadoEl: j.finishedOn })),
        failed: failed.map((j) => ({ id: j.id, error: j.failedReason, intentos: j.attemptsMade })),
      },
    });
  })
);

/**
 * GET /api/admin/queues/tasas/jobs
 * Lista los ultimos jobs de la cola de tasas.
 */
router.get(
  '/queues/tasas/jobs',
  asyncHandler(async (_req, res) => {
    const [completed, failed, active] = await Promise.all([
      colaTasas.getCompleted(0, 9),
      colaTasas.getFailed(0, 9),
      colaTasas.getActive(),
    ]);

    res.json({
      status: 'ok',
      data: {
        active: active.map((j) => ({ id: j.id, data: j.data })),
        completed: completed.map((j) => ({ id: j.id, returnValue: j.returnvalue, finalizadoEl: j.finishedOn })),
        failed: failed.map((j) => ({ id: j.id, error: j.failedReason, intentos: j.attemptsMade })),
      },
    });
  })
);

export const adminRoutes = router;
