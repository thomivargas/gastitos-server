import type { Job } from 'bullmq';
import { actualizarTasas } from '@modules/moneda/moneda.service';
import { logger } from '@config/logger';

export interface ActualizarTasasData {
  forzar?: boolean; // si true, actualiza aunque ya haya datos hoy
}

/**
 * Job que obtiene las cotizaciones del dia desde dolarapi.com
 * y las persiste en la tabla TasaCambio.
 */
export async function actualizarTasasJob(job: Job<ActualizarTasasData>) {
  logger.info({ jobId: job.id }, '[Job] Iniciando actualizacion de tasas de cambio');

  const resultado = await actualizarTasas();

  logger.info(
    { jobId: job.id, cantidadTasas: resultado.tasas.length },
    '[Job] Tasas de cambio actualizadas correctamente'
  );

  return resultado;
}
