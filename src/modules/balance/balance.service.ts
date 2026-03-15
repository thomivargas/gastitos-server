import { prisma } from '@config/database';
import { NotFoundError } from '@middlewares/errors';
import { Decimal, redondear } from '@utils/decimal';
import { hoyUTC } from '@utils/fecha';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { historialQuerySchema, patrimonioQuerySchema } from './balance.schema';

type HistorialQuery = z.infer<typeof historialQuerySchema>;
type PatrimonioQuery = z.infer<typeof patrimonioQuerySchema>;

/**
 * Guarda un snapshot del balance actual de una cuenta para la fecha de hoy.
 * Si ya existe un snapshot para hoy, lo actualiza (upsert).
 */
export async function registrarSnapshot(cuentaId: string) {
  const cuenta = await prisma.cuenta.findUnique({
    where: { id: cuentaId },
    select: { id: true, balance: true, moneda: true },
  });
  if (!cuenta) throw new NotFoundError('Cuenta');

  const hoy = hoyUTC();

  return prisma.balanceHistorico.upsert({
    where: { cuentaId_fecha: { cuentaId, fecha: hoy } },
    update: { balance: cuenta.balance },
    create: {
      cuentaId,
      fecha: hoy,
      balance: cuenta.balance,
      moneda: cuenta.moneda,
    },
  });
}

/**
 * Registra un snapshot de todas las cuentas activas del usuario.
 */
export async function registrarSnapshotsTodas(userId: string) {
  const cuentas = await prisma.cuenta.findMany({
    where: { usuarioId: userId, estado: 'ACTIVA' },
    select: { id: true, balance: true, moneda: true },
  });

  const hoy = hoyUTC();

  // Atomico: todos los snapshots se guardan o ninguno
  const snapshots = await prisma.$transaction(
    cuentas.map((cuenta) =>
      prisma.balanceHistorico.upsert({
        where: { cuentaId_fecha: { cuentaId: cuenta.id, fecha: hoy } },
        update: { balance: cuenta.balance },
        create: {
          cuentaId: cuenta.id,
          fecha: hoy,
          balance: cuenta.balance,
          moneda: cuenta.moneda,
        },
      })
    )
  );

  return { cuentas: snapshots.length, fecha: hoy };
}

/**
 * Devuelve la serie temporal de balance de una o todas las cuentas del usuario.
 */
export async function obtenerHistorial(userId: string, query: HistorialQuery) {
  // Verificar que la cuenta pertenece al usuario si se especifica
  if (query.cuentaId) {
    const cuenta = await prisma.cuenta.findFirst({
      where: { id: query.cuentaId, usuarioId: userId },
    });
    if (!cuenta) throw new NotFoundError('Cuenta');
  }

  const cuentaIds = query.cuentaId
    ? [query.cuentaId]
    : (
        await prisma.cuenta.findMany({
          where: { usuarioId: userId },
          select: { id: true },
        })
      ).map((c) => c.id);

  const where: Record<string, unknown> = {
    cuentaId: { in: cuentaIds },
  };
  if (query.desde) where['fecha'] = { ...(where['fecha'] as object ?? {}), gte: new Date(query.desde) };
  if (query.hasta) where['fecha'] = { ...(where['fecha'] as object ?? {}), lte: new Date(query.hasta) };

  return prisma.balanceHistorico.findMany({
    where,
    select: {
      id: true,
      cuentaId: true,
      fecha: true,
      balance: true,
      moneda: true,
    },
    orderBy: [{ cuentaId: 'asc' }, { fecha: 'asc' }],
  });
}

/**
 * Devuelve el patrimonio neto histórico: suma de balances de todas las cuentas por fecha.
 * Nota: suma sin conversion de moneda (multi-moneda se resuelve en Etapa 9).
 */
export async function obtenerHistorialGlobal(userId: string, query: PatrimonioQuery) {
  // Obtener todas las cuentas con su clasificacion para calcular activos - pasivos
  const cuentas = await prisma.cuenta.findMany({
    where: { usuarioId: userId },
    select: { id: true, clasificacion: true },
  });

  const cuentaIds = cuentas.map((c) => c.id);
  const pasivoIds = new Set(cuentas.filter((c) => c.clasificacion === 'PASIVO').map((c) => c.id));

  const where: Record<string, unknown> = {
    cuentaId: { in: cuentaIds },
  };
  if (query.desde) where['fecha'] = { ...(where['fecha'] as object ?? {}), gte: new Date(query.desde) };
  if (query.hasta) where['fecha'] = { ...(where['fecha'] as object ?? {}), lte: new Date(query.hasta) };

  // Obtener snapshots individuales para poder restar pasivos
  const snapshots = await prisma.balanceHistorico.findMany({
    where,
    select: { cuentaId: true, fecha: true, balance: true },
    orderBy: { fecha: 'asc' },
  });

  // Agrupar por fecha: sumar activos, restar pasivos
  const porFecha = new Map<string, Prisma.Decimal>();

  for (const s of snapshots) {
    const clave = s.fecha.toISOString();
    const actual = porFecha.get(clave) ?? new Decimal(0);
    const balance = new Decimal(s.balance);
    // Pasivos se restan del patrimonio neto
    porFecha.set(clave, pasivoIds.has(s.cuentaId) ? actual.minus(balance) : actual.plus(balance));
  }

  return Array.from(porFecha.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fechaISO, patrimonio]) => ({
      fecha: new Date(fechaISO),
      patrimonioNeto: redondear(patrimonio),
    }));
}
