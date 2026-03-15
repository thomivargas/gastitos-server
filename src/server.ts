import { env } from './config/env';
import { prisma } from './config/database';
import { logger } from './config/logger';
import { registrarCrons } from './cron';
import { cerrarWorkers } from './workers';
import app from './app';

async function bootstrap() {
  try {
    await prisma.$connect();
    logger.info('Conectado a la base de datos');
  } catch (err) {
    logger.fatal(err, 'No se pudo conectar a la base de datos');
    process.exit(1);
  }

  // Inicializar workers y crons de BullMQ
  try {
    // Importar workers para que queden registrados
    await import('./workers');
    await registrarCrons();
  } catch (err) {
    logger.warn(err, 'No se pudieron inicializar los workers/crons (Redis no disponible?)');
  }

  const host = '0.0.0.0';
  const server = app.listen(env.PORT, host, () => {
    logger.info({ host, port: env.PORT, env: env.NODE_ENV }, 'Servidor iniciado');
  });

  // ─── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Cerrando servidor...');

    const forceExit = setTimeout(() => {
      logger.warn('Shutdown timeout (10s) — forzando cierre');
      process.exit(1);
    }, 10_000);

    await cerrarWorkers().catch(() => {});
    server.close(async () => {
      await prisma.$disconnect();
      clearTimeout(forceExit);
      logger.info('Servidor cerrado correctamente');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (err) => {
    logger.fatal(err, 'uncaughtException');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'unhandledRejection');
    process.exit(1);
  });
}

bootstrap();
