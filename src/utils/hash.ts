import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { env } from '../config/env';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Hash rapido (SHA-256) para tokens.
 * No necesita ser lento como bcrypt porque los tokens son aleatorios y largos.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
