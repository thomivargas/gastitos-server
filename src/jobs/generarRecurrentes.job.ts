import type { Job } from 'bullmq';
import { generarPendientes } from '@modules/recurrente/recurrente.service';
import { logger } from '@config/logger';

export interface GenerarRecurrentesData {
  usuarioId?: string; // si esta presente, solo procesa ese usuario
}

/**
 * Job que genera transacciones para todos los TransaccionRecurrente
 * con proximaFecha <= hoy y actualiza su siguiente fecha.
 */
export async function generarRecurrentesJob(job: Job<GenerarRecurrentesData>) {
  const { usuarioId } = job.data;

  logger.info({ jobId: job.id, usuarioId }, '[Job] Iniciando generacion de recurrentes');

  const resultado = await generarPendientes(usuarioId);

  logger.info(
    { jobId: job.id, generadas: resultado.generadas },
    '[Job] Recurrentes generadas correctamente'
  );

  return resultado;
}
