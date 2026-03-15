import { Worker } from 'bullmq';
import { bullmqConnection } from '@config/queue';
import { logger } from '@config/logger';
import { generarRecurrentesJob } from '@jobs/generarRecurrentes.job';
import { actualizarTasasJob } from '@jobs/actualizarTasas.job';
import { limpiarSesionesJob } from '@jobs/limpiarSesiones.job';

/**
 * Worker para la cola de transacciones recurrentes.
 * Concurrencia 1: los jobs se procesan de a uno para evitar duplicados.
 */
const workerRecurrentes = new Worker(
  'recurrentes',
  generarRecurrentesJob,
  {
    connection: bullmqConnection,
    concurrency: 1,
  }
);

/**
 * Worker para la cola de actualizacion de tasas de cambio.
 */
const workerTasas = new Worker(
  'tasas-cambio',
  actualizarTasasJob,
  {
    connection: bullmqConnection,
    concurrency: 1,
  }
);

/**
 * Worker para tareas de mantenimiento (limpieza de sesiones).
 */
const workerMantenimiento = new Worker(
  'mantenimiento',
  limpiarSesionesJob,
  {
    connection: bullmqConnection,
    concurrency: 1,
  }
);

// Logging de eventos de workers
for (const [nombre, worker] of [
  ['recurrentes', workerRecurrentes],
  ['tasas-cambio', workerTasas],
  ['mantenimiento', workerMantenimiento],
] as const) {
  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, cola: nombre }, '[Worker] Job completado');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, cola: nombre, error: err.message }, '[Worker] Job fallido');
  });

  worker.on('error', (err) => {
    logger.error({ cola: nombre, error: err.message }, '[Worker] Error en worker');
  });
}

export { workerRecurrentes, workerTasas, workerMantenimiento };

/**
 * Cierra todos los workers gracefully.
 * Llamar desde el shutdown handler de la app.
 */
export async function cerrarWorkers() {
  await Promise.all([
    workerRecurrentes.close(),
    workerTasas.close(),
    workerMantenimiento.close(),
  ]);
  logger.info('[Workers] Todos los workers cerrados');
}
