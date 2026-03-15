import { colaRecurrentes, colaTasas, colaMantenimiento } from '@config/queue';
import { logger } from '@config/logger';

/**
 * Registra los jobs repetitivos (cron) en BullMQ.
 *
 * Schedules:
 *  - Recurrentes: diario a las 00:05 UTC
 *  - Tasas de cambio: diario a las 09:00 UTC (apertura mercado)
 *    + actualización a las 18:00 UTC
 */
export async function registrarCrons() {
  // Generar transacciones recurrentes pendientes cada dia a las 00:05 UTC
  await colaRecurrentes.upsertJobScheduler(
    'cron-recurrentes-diario',
    { pattern: '5 0 * * *' },
    {
      name: 'generar-recurrentes',
      data: {},
      opts: {
        removeOnComplete: { count: 7 },
        removeOnFail: { count: 30 },
      },
    }
  );

  // Actualizar tasas de cambio a las 09:00 UTC (apertura)
  await colaTasas.upsertJobScheduler(
    'cron-tasas-apertura',
    { pattern: '0 9 * * *' },
    {
      name: 'actualizar-tasas-apertura',
      data: {},
      opts: {
        removeOnComplete: { count: 7 },
        removeOnFail: { count: 30 },
      },
    }
  );

  // Actualizar tasas de cambio a las 18:00 UTC (cierre)
  await colaTasas.upsertJobScheduler(
    'cron-tasas-cierre',
    { pattern: '0 18 * * *' },
    {
      name: 'actualizar-tasas-cierre',
      data: {},
      opts: {
        removeOnComplete: { count: 7 },
        removeOnFail: { count: 30 },
      },
    }
  );

  // Limpiar sesiones expiradas cada 6 horas
  await colaMantenimiento.upsertJobScheduler(
    'cron-limpiar-sesiones',
    { pattern: '0 */6 * * *' },
    {
      name: 'limpiar-sesiones',
      data: {},
      opts: {
        removeOnComplete: { count: 5 },
        removeOnFail: { count: 10 },
      },
    }
  );

  logger.info('[Cron] Jobs programados: recurrentes (00:05), tasas (09:00, 18:00), sesiones (c/6h) UTC');
}
