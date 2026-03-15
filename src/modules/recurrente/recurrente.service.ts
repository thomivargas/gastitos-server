import { prisma } from '@config/database';
import { NotFoundError, BadRequestError } from '@middlewares/errors';
import { negar } from '@utils/decimal';
import type { FrecuenciaRecurrencia } from '@prisma/client';
import type { CrearRecurrenteInput, ActualizarRecurrenteInput } from './recurrente.schema';

const selectRecurrente = {
  id: true,
  cuentaId: true,
  categoriaId: true,
  tipo: true,
  monto: true,
  moneda: true,
  descripcion: true,
  frecuencia: true,
  diaDelMes: true,
  diaDeLaSemana: true,
  proximaFecha: true,
  activa: true,
  creadoEl: true,
  actualizadoEl: true,
} as const;

/**
 * Calcula la proxima fecha de ejecucion segun la frecuencia.
 * Para frecuencias mensuales+, respeta diaDelMes si se especifica.
 */
export function calcularSiguienteFecha(
  fechaActual: Date,
  frecuencia: FrecuenciaRecurrencia,
  diaDelMes?: number | null,
  diaDeLaSemana?: number | null
): Date {
  const fecha = new Date(fechaActual);

  switch (frecuencia) {
    case 'DIARIA':
      fecha.setDate(fecha.getDate() + 1);
      break;

    case 'SEMANAL': {
      if (diaDeLaSemana !== null && diaDeLaSemana !== undefined) {
        // Avanzar hasta el mismo dia de la semana, semana siguiente
        // JS: 0=domingo ... 6=sabado; nosotros: 0=lunes ... 6=domingo
        const jsTargetDay = diaDeLaSemana === 6 ? 0 : diaDeLaSemana + 1;
        const jsCurrent = fecha.getDay();
        let diasAsumar = (jsTargetDay - jsCurrent + 7) % 7;
        if (diasAsumar === 0) diasAsumar = 7; // misma dia → siguiente semana
        fecha.setDate(fecha.getDate() + diasAsumar);
      } else {
        fecha.setDate(fecha.getDate() + 7);
      }
      break;
    }

    case 'QUINCENAL':
      fecha.setDate(fecha.getDate() + 15);
      break;

    case 'MENSUAL':
      fecha.setMonth(fecha.getMonth() + 1);
      if (diaDelMes) ajustarDiaDelMes(fecha, diaDelMes);
      break;

    case 'BIMESTRAL':
      fecha.setMonth(fecha.getMonth() + 2);
      if (diaDelMes) ajustarDiaDelMes(fecha, diaDelMes);
      break;

    case 'TRIMESTRAL':
      fecha.setMonth(fecha.getMonth() + 3);
      if (diaDelMes) ajustarDiaDelMes(fecha, diaDelMes);
      break;

    case 'SEMESTRAL':
      fecha.setMonth(fecha.getMonth() + 6);
      if (diaDelMes) ajustarDiaDelMes(fecha, diaDelMes);
      break;

    case 'ANUAL':
      fecha.setFullYear(fecha.getFullYear() + 1);
      if (diaDelMes) ajustarDiaDelMes(fecha, diaDelMes);
      break;
  }

  return fecha;
}

/**
 * Ajusta el dia del mes, limitandolo al maximo del mes si excede.
 * Ej: dia 31 en febrero → ultimo dia de febrero.
 */
function ajustarDiaDelMes(fecha: Date, dia: number): void {
  const ultimoDia = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate();
  fecha.setDate(Math.min(dia, ultimoDia));
}

async function verificarRecurrente(userId: string, recurrenteId: string) {
  const rec = await prisma.transaccionRecurrente.findFirst({
    where: { id: recurrenteId, usuarioId: userId },
  });
  if (!rec) throw new NotFoundError('Transaccion recurrente');
  return rec;
}

export async function crear(userId: string, data: CrearRecurrenteInput) {
  const cuenta = await prisma.cuenta.findFirst({
    where: { id: data.cuentaId, usuarioId: userId },
    select: { id: true, moneda: true },
  });
  if (!cuenta) throw new NotFoundError('Cuenta');

  if (data.categoriaId) {
    const cat = await prisma.categoria.findFirst({
      where: { id: data.categoriaId, usuarioId: userId },
    });
    if (!cat) throw new NotFoundError('Categoria');
  }

  return prisma.transaccionRecurrente.create({
    data: {
      usuarioId: userId,
      cuentaId: data.cuentaId,
      categoriaId: data.categoriaId,
      tipo: data.tipo,
      monto: data.monto,
      moneda: data.moneda ?? cuenta.moneda,
      descripcion: data.descripcion,
      frecuencia: data.frecuencia,
      diaDelMes: data.diaDelMes,
      diaDeLaSemana: data.diaDeLaSemana,
      proximaFecha: new Date(data.proximaFecha),
      activa: data.activa,
    },
    select: {
      ...selectRecurrente,
      categoriaId: true,
    },
  });
}

export async function listar(userId: string) {
  const recurrentes = await prisma.transaccionRecurrente.findMany({
    where: { usuarioId: userId },
    select: {
      ...selectRecurrente,
      categoriaId: true,
    },
    orderBy: [{ activa: 'desc' }, { proximaFecha: 'asc' }],
  });
  return recurrentes;
}

export async function obtener(userId: string, recurrenteId: string) {
  const rec = await prisma.transaccionRecurrente.findFirst({
    where: { id: recurrenteId, usuarioId: userId },
    select: {
      ...selectRecurrente,
      categoriaId: true,
    },
  });
  if (!rec) throw new NotFoundError('Transaccion recurrente');
  return rec;
}

export async function actualizar(
  userId: string,
  recurrenteId: string,
  data: ActualizarRecurrenteInput
) {
  await verificarRecurrente(userId, recurrenteId);

  if (data.cuentaId) {
    const cuenta = await prisma.cuenta.findFirst({
      where: { id: data.cuentaId, usuarioId: userId },
    });
    if (!cuenta) throw new NotFoundError('Cuenta');
  }

  if (data.categoriaId) {
    const cat = await prisma.categoria.findFirst({
      where: { id: data.categoriaId, usuarioId: userId },
    });
    if (!cat) throw new NotFoundError('Categoria');
  }

  const updateData: Record<string, unknown> = { ...data };
  if (data.proximaFecha) {
    updateData['proximaFecha'] = new Date(data.proximaFecha);
  }

  return prisma.transaccionRecurrente.update({
    where: { id: recurrenteId },
    data: updateData,
    select: {
      ...selectRecurrente,
      categoriaId: true,
    },
  });
}

export async function activar(userId: string, recurrenteId: string) {
  await verificarRecurrente(userId, recurrenteId);
  return prisma.transaccionRecurrente.update({
    where: { id: recurrenteId },
    data: { activa: true },
    select: { id: true, activa: true },
  });
}

export async function desactivar(userId: string, recurrenteId: string) {
  await verificarRecurrente(userId, recurrenteId);
  return prisma.transaccionRecurrente.update({
    where: { id: recurrenteId },
    data: { activa: false },
    select: { id: true, activa: true },
  });
}

export async function eliminar(userId: string, recurrenteId: string) {
  await verificarRecurrente(userId, recurrenteId);
  await prisma.transaccionRecurrente.delete({ where: { id: recurrenteId } });
}

/**
 * Busca todas las transacciones recurrentes activas cuya proximaFecha <= hoy,
 * genera la transaccion correspondiente y calcula la siguiente fecha.
 * Si userId se pasa, solo procesa las del usuario; si no, procesa todas (uso interno/cron).
 */
export async function generarPendientes(userId?: string) {
  const hoy = new Date();
  hoy.setHours(23, 59, 59, 999);

  const where = {
    activa: true,
    proximaFecha: { lte: hoy },
    ...(userId ? { usuarioId: userId } : {}),
  };

  const pendientes = await prisma.transaccionRecurrente.findMany({ where });

  if (pendientes.length === 0) return { generadas: 0, transacciones: [] };

  const transaccionesCreadas: string[] = [];

  for (const rec of pendientes) {
    // Verificar que la cuenta sigue existiendo y activa
    const cuenta = await prisma.cuenta.findFirst({
      where: { id: rec.cuentaId },
      select: { id: true, moneda: true, estado: true },
    });
    if (!cuenta || cuenta.estado !== 'ACTIVA') continue;

    // Idempotencia: verificar que no se haya generado ya una transaccion
    // para esta recurrente en esta fecha
    const yaExiste = await prisma.transaccion.findFirst({
      where: {
        usuarioId: rec.usuarioId,
        cuentaId: rec.cuentaId,
        descripcion: rec.descripcion,
        monto: rec.monto,
        tipo: rec.tipo,
        fecha: rec.proximaFecha,
      },
      select: { id: true },
    });
    if (yaExiste) {
      // Ya se genero, solo avanzar la fecha
      const siguienteFecha = calcularSiguienteFecha(
        rec.proximaFecha, rec.frecuencia, rec.diaDelMes, rec.diaDeLaSemana,
      );
      await prisma.transaccionRecurrente.update({
        where: { id: rec.id },
        data: { proximaFecha: siguienteFecha },
      });
      continue;
    }

    const delta = rec.tipo === 'INGRESO' ? rec.monto : negar(rec.monto);

    await prisma.$transaction(async (tx) => {
      // Crear la transaccion
      const transaccion = await tx.transaccion.create({
        data: {
          usuarioId: rec.usuarioId,
          cuentaId: rec.cuentaId,
          categoriaId: rec.categoriaId,
          tipo: rec.tipo,
          monto: rec.monto,
          moneda: rec.moneda,
          fecha: rec.proximaFecha,
          descripcion: rec.descripcion,
        },
        select: { id: true },
      });

      // Actualizar balance
      await tx.cuenta.update({
        where: { id: rec.cuentaId },
        data: { balance: { increment: delta } },
      });

      // Calcular y actualizar proxima fecha
      const siguienteFecha = calcularSiguienteFecha(
        rec.proximaFecha,
        rec.frecuencia,
        rec.diaDelMes,
        rec.diaDeLaSemana
      );

      await tx.transaccionRecurrente.update({
        where: { id: rec.id },
        data: { proximaFecha: siguienteFecha },
      });

      transaccionesCreadas.push(transaccion.id);
    });
  }

  return { generadas: transaccionesCreadas.length, transacciones: transaccionesCreadas };
}
