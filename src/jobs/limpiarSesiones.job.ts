import type { Job } from 'bullmq';
import { prisma } from '@config/database';
import { logger } from '@config/logger';

/**
 * Job que elimina sesiones expiradas y sesiones ya rotadas
 * (marcadas como usado=true) con mas de 1 hora de antigüedad.
 */
export async function limpiarSesionesJob(job: Job) {
  const ahora = new Date();
  const hace1Hora = new Date(ahora.getTime() - 60 * 60 * 1000);

  const resultado = await prisma.sesion.deleteMany({
    where: {
      OR: [
        { expiraEl: { lt: ahora } },
        { usado: true, creadoEl: { lt: hace1Hora } },
      ],
    },
  });

  logger.info(
    { jobId: job.id, eliminadas: resultado.count },
    '[Job] Sesiones expiradas limpiadas',
  );

  return { eliminadas: resultado.count };
}
