import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

// Conexion IORedis para rate-limit-redis y uso directo
export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redisConnection.on('error', (err) => {
  logger.error({ err: err.message }, 'Redis: error de conexion');
});

redisConnection.on('connect', () => {
  logger.info('Redis: conectado');
});

// BullMQ recibe la URL como string para usar su propio ioredis interno
// (evita conflicto de tipos entre versiones de ioredis)
const bullmqConnection = { url: env.REDIS_URL };

// Cola para generacion de transacciones recurrentes
export const colaRecurrentes = new Queue('recurrentes', {
  connection: bullmqConnection,
  defaultJobOptions: {
    removeOnComplete: { count: 50 },  // conservar los ultimos 50 completados
    removeOnFail: { count: 100 },     // conservar los ultimos 100 fallidos
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  },
});

// Cola para actualizacion de tasas de cambio
export const colaTasas = new Queue('tasas-cambio', {
  connection: bullmqConnection,
  defaultJobOptions: {
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 30 },
    attempts: 3,
    backoff: { type: 'fixed', delay: 10000 },
  },
});

// Cola para tareas de mantenimiento (limpieza de sesiones, etc.)
export const colaMantenimiento = new Queue('mantenimiento', {
  connection: bullmqConnection,
  defaultJobOptions: {
    removeOnComplete: { count: 5 },
    removeOnFail: { count: 10 },
    attempts: 2,
    backoff: { type: 'fixed', delay: 5000 },
  },
});

export { bullmqConnection };
