import { prisma } from '@config/database';
import { NotFoundError, BadRequestError } from '@middlewares/errors';
import { getPaginationArgs, buildPaginatedResult } from '@utils/pagination';
import { Decimal, negar, restar } from '@utils/decimal';
import type { Prisma } from '@prisma/client';
import type {
  CrearTransaccionInput,
  ActualizarTransaccionInput,
  ListaTransaccionQuery,
} from './transaccion.schema';

/**
 * Calcula el delta que una transaccion aplica al balance de la cuenta.
 * INGRESO suma, GASTO resta. Retorna Decimal para preservar precision.
 */
function calcularDelta(tipo: string, monto: Prisma.Decimal | number): Prisma.Decimal {
  const d = new Decimal(monto);
  return tipo === 'INGRESO' ? d : negar(d);
}

const selectTransaccion = {
  id: true,
  tipo: true,
  monto: true,
  moneda: true,
  tasaCambio: true,
  fecha: true,
  descripcion: true,
  notas: true,
  excluida: true,
  montoOriginal: true,
  monedaOriginal: true,
  creadoEl: true,
  actualizadoEl: true,
  cuenta: { select: { id: true, nombre: true, tipo: true } },
  categoria: { select: { id: true, nombre: true, color: true, icono: true } },
  etiquetas: {
    select: {
      etiqueta: { select: { id: true, nombre: true, color: true } },
    },
  },
} as const;

// Transforma el resultado para aplanar etiquetas
function formatTransaccion(t: any) {
  const { etiquetas, ...rest } = t;
  return {
    ...rest,
    etiquetas: etiquetas?.map((te: any) => te.etiqueta) ?? [],
  };
}

export async function crear(usuarioId: string, data: CrearTransaccionInput) {
  // Verificar que la cuenta existe y pertenece al usuario
  const cuenta = await prisma.cuenta.findFirst({
    where: { id: data.cuentaId, usuarioId },
    select: { id: true, moneda: true },
  });
  if (!cuenta) throw new NotFoundError('Cuenta');

  // Verificar categoria si se envio, o auto-categorizar por reglas
  let categoriaId = data.categoriaId;
  if (categoriaId) {
    const cat = await prisma.categoria.findFirst({
      where: { id: categoriaId, usuarioId },
    });
    if (!cat) throw new NotFoundError('Categoria');
  } else {
    // Intentar auto-categorizar usando reglas del usuario
    try {
      const { sugerirCategoria } = await import('../regla/regla.service');
      const sugerencia = await sugerirCategoria(usuarioId, data.descripcion);
      if (sugerencia) categoriaId = sugerencia.id;
    } catch {
      // Si falla, se crea sin categoria
    }
  }

  const moneda = data.moneda ?? cuenta.moneda;
  const delta = calcularDelta(data.tipo, data.monto);

  // Si la transaccion es en una moneda distinta a la cuenta, buscar tasa vigente
  let tasaCambio: number | undefined;
  if (moneda !== cuenta.moneda) {
    try {
      const { obtenerTasa } = await import('../moneda/moneda.service');
      tasaCambio = await obtenerTasa(moneda, cuenta.moneda, 'blue');
    } catch {
      // Si no se puede obtener la tasa, la transaccion se crea sin ella
    }
  }

  const resultado = await prisma.$transaction(async (tx) => {
    // Crear la transaccion
    const transaccion = await tx.transaccion.create({
      data: {
        usuarioId,
        cuentaId: data.cuentaId,
        tipo: data.tipo,
        monto: data.monto,
        moneda,
        tasaCambio: tasaCambio ?? null,
        fecha: new Date(data.fecha),
        descripcion: data.descripcion,
        categoriaId: categoriaId ?? null,
        notas: data.notas ?? null,
        ...(data.excluida !== undefined && { excluida: data.excluida }),
        montoOriginal: data.montoOriginal ?? null,
        monedaOriginal: data.monedaOriginal ?? null,
      },
      select: selectTransaccion,
    });

    // Asignar etiquetas (validando ownership)
    if (data.etiquetaIds && data.etiquetaIds.length > 0) {
      const etiquetasValidas = await tx.etiqueta.count({
        where: { id: { in: data.etiquetaIds }, usuarioId },
      });
      if (etiquetasValidas !== data.etiquetaIds.length) {
        throw new BadRequestError('Una o mas etiquetas no existen o no pertenecen al usuario');
      }

      await tx.transaccionEtiqueta.createMany({
        data: data.etiquetaIds.map((etiquetaId) => ({
          transaccionId: transaccion.id,
          etiquetaId,
        })),
      });
    }

    // Actualizar balance de la cuenta
    await tx.cuenta.update({
      where: { id: data.cuentaId },
      data: { balance: { increment: delta } },
    });

    // Re-fetch con etiquetas
    return tx.transaccion.findUniqueOrThrow({
      where: { id: transaccion.id },
      select: selectTransaccion,
    });
  });

  return formatTransaccion(resultado);
}

export async function listar(usuarioId: string, query: ListaTransaccionQuery) {
  const where: Prisma.TransaccionWhereInput = { usuarioId };

  if (query.cuentaId) where.cuentaId = query.cuentaId;
  if (query.categoriaId) where.categoriaId = query.categoriaId;
  if (query.tipo) where.tipo = query.tipo;
  if (query.excluida !== undefined) where.excluida = query.excluida;

  // Rango de fechas
  if (query.fechaDesde || query.fechaHasta) {
    where.fecha = {};
    if (query.fechaDesde) where.fecha.gte = new Date(query.fechaDesde);
    if (query.fechaHasta) where.fecha.lte = new Date(query.fechaHasta);
  }

  // Rango de montos
  if (query.montoMin || query.montoMax) {
    where.monto = {};
    if (query.montoMin) where.monto.gte = query.montoMin;
    if (query.montoMax) where.monto.lte = query.montoMax;
  }

  // Busqueda por texto en descripcion
  if (query.busqueda) {
    where.descripcion = { contains: query.busqueda, mode: 'insensitive' };
  }

  // Filtrar por etiquetas
  if (query.etiquetaIds && query.etiquetaIds.length > 0) {
    where.etiquetas = {
      some: { etiquetaId: { in: query.etiquetaIds } },
    };
  }

  const { skip, take } = getPaginationArgs(query);
  const orderBy = { [query.ordenarPor]: query.orden };

  const [transacciones, total] = await Promise.all([
    prisma.transaccion.findMany({ where, select: selectTransaccion, skip, take, orderBy }),
    prisma.transaccion.count({ where }),
  ]);

  return buildPaginatedResult(transacciones.map(formatTransaccion), total, query);
}

export async function obtener(usuarioId: string, transaccionId: string) {
  const transaccion = await prisma.transaccion.findFirst({
    where: { id: transaccionId, usuarioId },
    select: selectTransaccion,
  });

  if (!transaccion) throw new NotFoundError('Transaccion');
  return formatTransaccion(transaccion);
}

export async function actualizar(
  usuarioId: string,
  transaccionId: string,
  data: ActualizarTransaccionInput,
) {
  // Obtener transaccion actual para calcular diferencia de balance
  const actual = await prisma.transaccion.findFirst({
    where: { id: transaccionId, usuarioId },
    select: { id: true, tipo: true, monto: true, cuentaId: true },
  });
  if (!actual) throw new NotFoundError('Transaccion');

  // No permitir cambiar tipo a/desde TRANSFERENCIA (se gestiona via transferencias)
  if (data.tipo === 'TRANSFERENCIA' || actual.tipo === 'TRANSFERENCIA') {
    throw new BadRequestError('No se puede cambiar el tipo de una transaccion de transferencia. Usa el modulo de transferencias.');
  }

  // Verificar categoria si se envio
  if (data.categoriaId) {
    const cat = await prisma.categoria.findFirst({
      where: { id: data.categoriaId, usuarioId },
    });
    if (!cat) throw new NotFoundError('Categoria');
  }

  const nuevoTipo = data.tipo ?? actual.tipo;
  const nuevoMonto = data.monto ?? actual.monto;
  const nuevaCuentaId = data.cuentaId ?? actual.cuentaId;
  const cambiaCuenta = data.cuentaId !== undefined && data.cuentaId !== actual.cuentaId;

  // Verificar que la nueva cuenta exista y pertenezca al usuario
  if (cambiaCuenta) {
    const cuenta = await prisma.cuenta.findFirst({
      where: { id: data.cuentaId, usuarioId },
      select: { id: true },
    });
    if (!cuenta) throw new NotFoundError('Cuenta');
  }

  const deltaAnterior = calcularDelta(actual.tipo, actual.monto);
  const deltaNuevo = calcularDelta(nuevoTipo, nuevoMonto);

  const resultado = await prisma.$transaction(async (tx) => {
    // Actualizar transaccion
    const transaccion = await tx.transaccion.update({
      where: { id: transaccionId },
      data: {
        ...(data.cuentaId !== undefined && { cuentaId: data.cuentaId }),
        ...(data.tipo !== undefined && { tipo: data.tipo }),
        ...(data.monto !== undefined && { monto: data.monto }),
        ...(data.moneda !== undefined && { moneda: data.moneda }),
        ...(data.fecha !== undefined && { fecha: new Date(data.fecha) }),
        ...(data.descripcion !== undefined && { descripcion: data.descripcion }),
        ...(data.categoriaId !== undefined && { categoriaId: data.categoriaId }),
        ...(data.notas !== undefined && { notas: data.notas }),
        ...(data.excluida !== undefined && { excluida: data.excluida }),
        ...(data.montoOriginal !== undefined && { montoOriginal: data.montoOriginal }),
        ...(data.monedaOriginal !== undefined && { monedaOriginal: data.monedaOriginal }),
      },
      select: selectTransaccion,
    });

    // Actualizar etiquetas si se enviaron (validando ownership)
    if (data.etiquetaIds !== undefined) {
      if (data.etiquetaIds.length > 0) {
        const etiquetasValidas = await tx.etiqueta.count({
          where: { id: { in: data.etiquetaIds }, usuarioId },
        });
        if (etiquetasValidas !== data.etiquetaIds.length) {
          throw new BadRequestError('Una o mas etiquetas no existen o no pertenecen al usuario');
        }
      }

      await tx.transaccionEtiqueta.deleteMany({ where: { transaccionId } });
      if (data.etiquetaIds.length > 0) {
        await tx.transaccionEtiqueta.createMany({
          data: data.etiquetaIds.map((etiquetaId) => ({
            transaccionId,
            etiquetaId,
          })),
        });
      }
    }

    // Actualizar balances
    if (cambiaCuenta) {
      // Revertir efecto en la cuenta vieja
      await tx.cuenta.update({
        where: { id: actual.cuentaId },
        data: { balance: { decrement: deltaAnterior } },
      });
      // Aplicar nuevo efecto en la cuenta nueva
      await tx.cuenta.update({
        where: { id: nuevaCuentaId },
        data: { balance: { increment: deltaNuevo } },
      });
    } else {
      // Misma cuenta: aplicar solo la diferencia
      const diferencia = restar(deltaNuevo, deltaAnterior);
      if (!diferencia.isZero()) {
        await tx.cuenta.update({
          where: { id: actual.cuentaId },
          data: { balance: { increment: diferencia } },
        });
      }
    }

    return tx.transaccion.findUniqueOrThrow({
      where: { id: transaccionId },
      select: selectTransaccion,
    });
  });

  return formatTransaccion(resultado);
}

export async function eliminar(usuarioId: string, transaccionId: string) {
  const transaccion = await prisma.transaccion.findFirst({
    where: { id: transaccionId, usuarioId },
    select: { id: true, tipo: true, monto: true, cuentaId: true },
  });
  if (!transaccion) throw new NotFoundError('Transaccion');

  // Verificar que no sea parte de una transferencia
  const esTransferencia = await prisma.transferencia.findFirst({
    where: {
      OR: [
        { transaccionOrigenId: transaccionId },
        { transaccionDestinoId: transaccionId },
      ],
    },
  });
  if (esTransferencia) {
    throw new BadRequestError(
      'Esta transaccion es parte de una transferencia. Elimina la transferencia en su lugar.',
    );
  }

  const delta = calcularDelta(transaccion.tipo, transaccion.monto);

  await prisma.$transaction(async (tx) => {
    // Eliminar etiquetas asociadas
    await tx.transaccionEtiqueta.deleteMany({ where: { transaccionId } });

    // Eliminar transaccion
    await tx.transaccion.delete({ where: { id: transaccionId } });

    // Revertir efecto en balance
    await tx.cuenta.update({
      where: { id: transaccion.cuentaId },
      data: { balance: { decrement: delta } },
    });
  });
}
