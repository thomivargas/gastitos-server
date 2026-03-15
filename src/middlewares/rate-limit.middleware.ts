import rateLimit, { type Store } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisConnection } from '@config/queue';
import { logger } from '@config/logger';

// Intenta crear un store Redis; si falla, usa el store en memoria por defecto
function makeStore(prefix: string): Store | undefined {
  try {
    return new RedisStore({
      sendCommand: (...args: string[]) => (redisConnection as any).call(...args) as Promise<any>,
      prefix: `rl:${prefix}:`,
    });
  } catch (err) {
    logger.warn({ err, prefix }, 'Redis no disponible para rate limiting, usando store en memoria');
    return undefined; // express-rate-limit usa MemoryStore por defecto
  }
}

const authStore = makeStore('auth');
const apiStore = makeStore('api');

// Límite estricto para login: 10 intentos por ventana de 15 min
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  ...(authStore && { store: authStore }),
  message: { status: 'error', message: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' },
});

// Límite general para la API: 100 requests por minuto
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  ...(apiStore && { store: apiStore }),
  message: { status: 'error', message: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' },
});
