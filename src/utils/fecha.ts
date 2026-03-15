/**
 * Retorna la fecha de hoy a medianoche UTC.
 * Evita inconsistencias por timezone del servidor.
 */
export function hoyUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
