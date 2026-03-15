import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayload {
  sub: string;   // userId
  email: string;
  role: string;
}

/**
 * Genera un access token de corta duración.
 */
export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Genera un refresh token de larga duración.
 */
export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Verifica un access token. Lanza error si es inválido/expirado.
 */
export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
}

/**
 * Verifica un refresh token. Lanza error si es inválido/expirado.
 */
export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
}

/**
 * Parsea un string de duracion tipo "7d", "24h", "30m" a milisegundos.
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([dhms])$/);
  if (!match) throw new Error(`Formato de duracion invalido: "${duration}". Usar Nd, Nh, Nm o Ns.`);

  const value = parseInt(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
}

/**
 * Calcula la fecha de expiración del refresh token para guardarla en DB.
 */
export function getRefreshTokenExpiry(): Date {
  const ms = parseDuration(env.JWT_REFRESH_EXPIRES_IN);
  return new Date(Date.now() + ms);
}
