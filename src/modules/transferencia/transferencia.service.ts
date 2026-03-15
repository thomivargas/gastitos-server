import { prisma } from '@config/database';
import { NotFoundError, BadRequestError } from '@middlewares/errors';
import { getPaginationArgs, buildPaginatedResult } from '@utils/pagination';
import type { Prisma } from '@prisma/client';
import type { CrearTransferenciaInput, ListaTransferenciaQuery } from './transferencia.schema';

const selectTransferencia = {
  id: true,
  creadoEl: true,
  cuentaOrigen: { select: { id: true, nombre: true, moneda: true } },
  cuentaDestino: { select: { id: true, nombre: true, moneda: true } },
  transaccionOrigen: {
    select: { id: true, monto: true, moneda: true, fecha: true, descripcion: true },
  },
  transaccionDestino: {
    select: { id: true, monto: true, moneda: true, fecha: true, descripcion: true },
  },
} as const;

export async function crear(usuarioId: string, data: CrearTransferenciaInput) {
  // Verificar que ambas cuentas existen, pertenecen al usuario y estan activas
  const [cuentaOrigen, cuentaDestino] = await Promise.all([
    prisma.cuenta.findFirst({ where: { id: data.cuentaOrigenId, usuarioId }, select: { id: true, moneda: true, estado: true, nombre: true } }),
    prisma.cuenta.findFirst({ where: { id: data.cuentaDestinoId, usuarioId }, select: { id: true, moneda: true, estado: true, nombre: true } }),
  ]);

  if (!cuentaOrigen) throw new NotFoundError('Cuenta origen');
  if (!cuentaDestino) throw new NotFoundError('Cuenta destino');

  if (cuentaOrigen.estado !== 'ACTIVA')
    throw new BadRequestError(`La cuenta origen "${cuentaOrigen.nombre}" no esta activa`);
  if (cuentaDestino.estado !== 'ACTIVA')
    throw new BadRequestError(`La cuenta destino "${cuentaDestino.nombre}" no esta activa`);

  // Si ambas cuentas tienen la misma moneda, montoDestino debe ser igual a monto
  const mismaMoneda = cuentaOrigen.moneda === cuentaDestino.moneda;
  if (mismaMoneda && data.montoDestino !== undefined && data.montoDestino !== data.monto) {
    throw new BadRequestError(
      'Ambas cuentas tienen la misma moneda: montoDestino debe ser igual a monto'
    );
  }

  const montoDestino = data.montoDestino ?? data.monto;
  const descripcion = data.descripcion ?? 'Transferencia entre cuentas';

  const resultado = await prisma.$transaction(async (tx) => {
    // Crear transaccion de salida (origen)
    const txOrigen = await tx.transaccion.create({
      data: {
        usuarioId,
        cuentaId: data.cuentaOrigenId,
        tipo: 'TRANSFERENCIA',
        monto: data.monto,
        moneda: cuentaOrigen.moneda,
        fecha: new Date(data.fecha),
        descripcion,
        notas: data.notas ?? null,
      },
    });

    // Crear transaccion de entrada (destino)
    const txDestino = await tx.transaccion.create({
      data: {
        usuarioId,
        cuentaId: data.cuentaDestinoId,
        tipo: 'TRANSFERENCIA',
        monto: montoDestino,
        moneda: cuentaDestino.moneda,
        fecha: new Date(data.fecha),
        descripcion,
        notas: data.notas ?? null,
      },
    });

    // Crear el vinculo
    const transferencia = await tx.transferencia.create({
      data: {
        transaccionOrigenId: txOrigen.id,
        transaccionDestinoId: txDestino.id,
        cuentaOrigenId: data.cuentaOrigenId,
        cuentaDestinoId: data.cuentaDestinoId,
      },
      select: selectTransferencia,
    });

    // Actualizar balances
    await tx.cuenta.update({
      where: { id: data.cuentaOrigenId },
      data: { balance: { decrement: data.monto } },
    });

    await tx.cuenta.update({
      where: { id: data.cuentaDestinoId },
      data: { balance: { increment: montoDestino } },
    });

    return transferencia;
  });

  return resultado;
}

export async function listar(usuarioId: string, query: ListaTransferenciaQuery) {
  const where: Prisma.TransferenciaWhereInput = {
    transaccionOrigen: { usuarioId },
  };

  // Filtrar por cuenta (origen o destino)
  if (query.cuentaId) {
    where.OR = [
      { cuentaOrigenId: query.cuentaId },
      { cuentaDestinoId: query.cuentaId },
    ];
  }

  // Rango de fechas (via transaccion origen)
  if (query.fechaDesde || query.fechaHasta) {
    where.transaccionOrigen = {
      ...where.transaccionOrigen as object,
      fecha: {
        ...(query.fechaDesde && { gte: new Date(query.fechaDesde) }),
        ...(query.fechaHasta && { lte: new Date(query.fechaHasta) }),
      },
    };
  }

  const { skip, take } = getPaginationArgs(query);

  const [transferencias, total] = await Promise.all([
    prisma.transferencia.findMany({
      where,
      select: selectTransferencia,
      skip,
      take,
      orderBy: { transaccionOrigen: { [query.ordenarPor === 'monto' ? 'monto' : query.ordenarPor === 'creadoEl' ? 'creadoEl' : 'fecha']: query.orden } },
    }),
    prisma.transferencia.count({ where }),
  ]);

  return buildPaginatedResult(transferencias, total, query);
}

export async function obtener(usuarioId: string, transferenciaId: string) {
  const transferencia = await prisma.transferencia.findFirst({
    where: {
      id: transferenciaId,
      transaccionOrigen: { usuarioId },
    },
    select: selectTransferencia,
  });

  if (!transferencia) throw new NotFoundError('Transferencia');
  return transferencia;
}

export async function eliminar(usuarioId: string, transferenciaId: string) {
  const transferencia = await prisma.transferencia.findFirst({
    where: {
      id: transferenciaId,
      transaccionOrigen: { usuarioId },
    },
    select: {
      id: true,
      cuentaOrigenId: true,
      cuentaDestinoId: true,
      transaccionOrigenId: true,
      transaccionDestinoId: true,
      transaccionOrigen: { select: { monto: true } },
      transaccionDestino: { select: { monto: true } },
    },
  });

  if (!transferencia) throw new NotFoundError('Transferencia');

  await prisma.$transaction(async (tx) => {
    // Eliminar el vinculo
    await tx.transferencia.delete({ where: { id: transferenciaId } });

    // Eliminar ambas transacciones
    await tx.transaccion.deleteMany({
      where: {
        id: { in: [transferencia.transaccionOrigenId, transferencia.transaccionDestinoId] },
      },
    });

    // Revertir balances — Prisma acepta Decimal directamente, no necesita Number()
    await tx.cuenta.update({
      where: { id: transferencia.cuentaOrigenId },
      data: { balance: { increment: transferencia.transaccionOrigen.monto } },
    });

    await tx.cuenta.update({
      where: { id: transferencia.cuentaDestinoId },
      data: { balance: { decrement: transferencia.transaccionDestino.monto } },
    });
  });
}
