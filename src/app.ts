import express from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler } from './middlewares/error.middleware';
import { apiLimiter } from './middlewares/rate-limit.middleware';
import { loggerMiddleware } from './utils/logger';
import router from './routes';

const app = express();

// ─── Middlewares globales ─────────────────────────────────────────────────────
app.use(compression());
app.use(helmet());

// CORS — soporta múltiples orígenes separados por coma en CORS_ORIGIN
const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
if (allowedOrigins.includes('*')) {
  throw new Error('CORS_ORIGIN no puede ser "*" cuando credentials esta habilitado. Configura origenes explicitos.');
}
app.use(
  cors({
    origin: allowedOrigins.length === 1 ? allowedOrigins[0]! : allowedOrigins,
    credentials: true,
  }),
);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Rate limiting global
app.use(apiLimiter);

// HTTP request logging
app.use(loggerMiddleware);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Rutas ──────────────────────────────────────────────────────────
app.use('/api', router);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ status: 'error', message: 'Ruta no encontrada' });
});

// ─── Error handler global (debe ser el último) ────────────────────────────────
app.use(errorHandler);

export default app;
