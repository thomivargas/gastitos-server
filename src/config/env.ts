import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// Schema de validación de variables de entorno
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  DATABASE_URL: z.string().nonempty('DATABASE_URL es requerida'),
  JWT_ACCESS_SECRET: z.string().nonempty('token es requerido').min(16),
  JWT_REFRESH_SECRET: z.string().nonempty('token es requerido').min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  BCRYPT_ROUNDS: z.string().default('10').transform(Number),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  GOOGLE_CLIENT_ID: z.string().nonempty('GOOGLE_CLIENT_ID es requerida'),
  GOOGLE_CLIENT_SECRET: z.string().nonempty('GOOGLE_CLIENT_SECRET es requerida'),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:3000/api/auth/google/callback'),

  MAX_SESIONES: z.string().default('5').transform(Number), // sesiones activas por usuario
});

// Validar y parsear — lanza error descriptivo si algo falta
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Error en variables de entorno:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
