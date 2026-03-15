import { prisma } from '@config/database';
import { NotFoundError, ConflictError } from '@middlewares/errors';
import { getPaginationArgs, buildPaginatedResult } from '@utils/pagination';
import { Decimal, sumar, redondear } from '@utils/decimal';
import type { z } from 'zod';
import type {
  crearPresupuestoSchema,
  actualizarPresupuestoSchema,
  asignarCategoriaSchema,
  listaPresupuestoQuerySchema,
  copiarPresupuestoSchema,
} from './presupuesto.schema';

type CrearPresupuestoData = z.infer<typeof crearPresupuestoSchema>;
type ActualizarPresupuestoData = z.infer<typeof actualizarPresupuestoSchema>;
type AsignarCategoriaData = z.infer<typeof asignarCategoriaSchema>;
type ListaQuery = z.infer<typeof listaPresupuestoQuerySchema>;
type CopiarData = z.infer<typeof copiarPresupuestoSchema>;

const incluirCategorias = {
  categorias: {
    include: {
      categoria: {
        select: { id: true, nombre: true, color: true, icono: true, clasificacion: true },
      },
    },
    orderBy: { creadoEl: 'asc' as const },
  },
};

async function verificarPresupuesto(userId: string, presupuestoId: string) {
  const presupuesto = await prisma.presupuesto.findFirst({
    where: { id: presupuestoId, usuarioId: userId },
  });
  if (!presupuesto) throw new NotFoundError('Presupuesto');
  return presupuesto;
}

export async function crear(userId: string, data: CrearPresupuestoData) {
  const fechaInicio = new Date(data.fechaInicio);
  const fechaFin = new Date(data.fechaFin);

  const existente = await prisma.presupuesto.findFirst({
    where: { usuarioId: userId, fechaInicio, fechaFin },
  });
  if (existente) throw new ConflictError('Ya existe un presupuesto para ese periodo');

  return prisma.$transaction(async (tx) => {
    const presupuesto = await tx.presupuesto.create({
      data: {
        usuarioId: userId,
        fechaInicio,
        fechaFin,
        gastoPresupuestado: data.gastoPresupuestado ?? null,
        ingresoEsperado: data.ingresoEsperado ?? null,
        moneda: data.moneda,
      },
    });

    if (data.categorias?.length) {
      await tx.presupuestoCategoria.createMany({
        data: data.categorias.map((c) => ({
          presupuestoId: presupuesto.id,
          categoriaId: c.categoriaId,
          montoPresupuestado: c.montoPresupuestado,
        })),
      });
    }

    return tx.presupuesto.findUniqueOrThrow({
      where: { id: presupuesto.id },
      include: incluirCategorias,
    });
  });
}

export async function listar(userId: string, query: ListaQuery) {
  const where: Record<string, unknown> = { usuarioId: userId };

  if (query.anio !== undefined && query.mes !== undefined) {
    const inicio = new Date(query.anio, query.mes - 1, 1);
    const fin = new Date(query.anio, query.mes, 0);
    where['fechaInicio'] = { lte: fin };
    where['fechaFin'] = { gte: inicio };
  } else if (query.anio !== undefined) {
    const inicio = new Date(query.anio, 0, 1);
    const fin = new Date(query.anio, 11, 31);
    where['fechaInicio'] = { gte: inicio, lte: fin };
  }

  const { skip, take } = getPaginationArgs(query);

  const [total, presupuestos] = await Promise.all([
    prisma.presupuesto.count({ where }),
    prisma.presupuesto.findMany({
      where,
      include: incluirCategorias,
      orderBy: { fechaInicio: 'desc' },
      skip,
      take,
    }),
  ]);

  return buildPaginatedResult(presupuestos, total, query);
}

export async function obtener(userId: string, presupuestoId: string) {
  const presupuesto = await prisma.presupuesto.findFirst({
    where: { id: presupuestoId, usuarioId: userId },
    include: incluirCategorias,
  });
  if (!presupuesto) throw new NotFoundError('Presupuesto');
  return presupuesto;
}

export async function obtenerActual(userId: string) {
  const hoy = new Date();
  const presupuesto = await prisma.presupuesto.findFirst({
    where: {
      usuarioId: userId,
      fechaInicio: { lte: hoy },
      fechaFin: { gte: hoy },
    },
    include: incluirCategorias,
    orderBy: { fechaInicio: 'desc' },
  });
  if (!presupuesto) throw new NotFoundError('Presupuesto activo para el periodo actual');
  return presupuesto;
}

export async function actualizar(
  userId: string,
  presupuestoId: string,
  data: ActualizarPresupuestoData
) {
  await verificarPresupuesto(userId, presupuestoId);

  return prisma.presupuesto.update({
    where: { id: presupuestoId },
    data: {
      ...(data.gastoPresupuestado !== undefined && { gastoPresupuestado: data.gastoPresupuestado ?? null }),
      ...(data.ingresoEsperado !== undefined && { ingresoEsperado: data.ingresoEsperado ?? null }),
      ...(data.moneda !== undefined && { moneda: data.moneda }),
    },
    include: incluirCategorias,
  });
}

export async function asignarCategoria(
  userId: string,
  presupuestoId: string,
  data: AsignarCategoriaData
) {
  await verificarPresupuesto(userId, presupuestoId);

  const categoria = await prisma.categoria.findFirst({
    where: { id: data.categoriaId, usuarioId: userId },
  });
  if (!categoria) throw new NotFoundError('Categoria');

  return prisma.presupuestoCategoria.upsert({
    where: {
      presupuestoId_categoriaId: {
        presupuestoId,
        categoriaId: data.categoriaId,
      },
    },
    update: { montoPresupuestado: data.montoPresupuestado },
    create: {
      presupuestoId,
      categoriaId: data.categoriaId,
      montoPresupuestado: data.montoPresupuestado,
    },
    include: {
      categoria: {
        select: { id: true, nombre: true, color: true, icono: true, clasificacion: true },
      },
    },
  });
}

export async function eliminarCategoria(
  userId: string,
  presupuestoId: string,
  categoriaId: string
) {
  await verificarPresupuesto(userId, presupuestoId);

  const asignacion = await prisma.presupuestoCategoria.findFirst({
    where: { presupuestoId, categoriaId },
  });
  if (!asignacion) throw new NotFoundError('Asignacion de categoria');

  await prisma.presupuestoCategoria.delete({
    where: { presupuestoId_categoriaId: { presupuestoId, categoriaId } },
  });
}

export async function obtenerProgreso(userId: string, presupuestoId: string) {
  const presupuesto = await prisma.presupuesto.findFirst({
    where: { id: presupuestoId, usuarioId: userId },
    include: {
      categorias: {
        include: {
          categoria: {
            select: { id: true, nombre: true, color: true, icono: true, clasificacion: true },
          },
        },
      },
    },
  });
  if (!presupuesto) throw new NotFoundError('Presupuesto');

  const categoriasIds = presupuesto.categorias.map((c) => c.categoriaId);

  // Gastos reales por categoria en el periodo
  const gastosPorCategoria = await prisma.transaccion.groupBy({
    by: ['categoriaId'],
    where: {
      usuarioId: userId,
      tipo: 'GASTO',
      excluida: false,
      fecha: { gte: presupuesto.fechaInicio, lte: presupuesto.fechaFin },
      categoriaId: { in: categoriasIds },
    },
    _sum: { monto: true },
  });

  const gastoMap = new Map(
    gastosPorCategoria.map((g) => [g.categoriaId, new Decimal(g._sum.monto ?? 0)])
  );

  // Totales generales del periodo
  const [totalGasto, totalIngreso] = await Promise.all([
    prisma.transaccion.aggregate({
      where: {
        usuarioId: userId,
        tipo: 'GASTO',
        excluida: false,
        fecha: { gte: presupuesto.fechaInicio, lte: presupuesto.fechaFin },
      },
      _sum: { monto: true },
    }),
    prisma.transaccion.aggregate({
      where: {
        usuarioId: userId,
        tipo: 'INGRESO',
        excluida: false,
        fecha: { gte: presupuesto.fechaInicio, lte: presupuesto.fechaFin },
      },
      _sum: { monto: true },
    }),
  ]);

  const categorias = presupuesto.categorias.map((c) => {
    const gastoReal = gastoMap.get(c.categoriaId) ?? new Decimal(0);
    const presupuestadoDec = new Decimal(c.montoPresupuestado);
    const porcentaje = presupuestadoDec.greaterThan(0)
      ? Math.round(gastoReal.dividedBy(presupuestadoDec).times(100).toNumber())
      : 0;

    return {
      id: c.id,
      categoria: c.categoria,
      montoPresupuestado: redondear(presupuestadoDec),
      gastoReal: redondear(gastoReal),
      restante: redondear(presupuestadoDec.minus(gastoReal)),
      porcentaje,
      excedido: gastoReal.greaterThan(presupuestadoDec),
    };
  });

  const gastoRealTotal = new Decimal(totalGasto._sum.monto ?? 0);
  const ingresoRealTotal = new Decimal(totalIngreso._sum.monto ?? 0);
  const gastoPresupuestadoDec = new Decimal(presupuesto.gastoPresupuestado ?? 0);
  const ingresoEsperadoDec = new Decimal(presupuesto.ingresoEsperado ?? 0);

  // Cuanto del presupuesto ya fue asignado a categorias
  const presupuestoAsignado = presupuesto.categorias.reduce<typeof Decimal.prototype>(
    (acc, c) => sumar(acc, c.montoPresupuestado),
    new Decimal(0),
  );
  const disponibleAsignar = gastoPresupuestadoDec.minus(presupuestoAsignado);

  return {
    presupuesto: {
      id: presupuesto.id,
      fechaInicio: presupuesto.fechaInicio,
      fechaFin: presupuesto.fechaFin,
      moneda: presupuesto.moneda,
    },
    resumen: {
      gastoPresupuestado: redondear(gastoPresupuestadoDec),
      presupuestoAsignado: redondear(presupuestoAsignado),
      disponibleAsignar: redondear(disponibleAsignar),
      porcentajeAsignado:
        gastoPresupuestadoDec.greaterThan(0)
          ? Math.round(presupuestoAsignado.dividedBy(gastoPresupuestadoDec).times(100).toNumber())
          : 0,
      gastoReal: redondear(gastoRealTotal),
      gastoRestante: redondear(gastoPresupuestadoDec.minus(gastoRealTotal)),
      gastoPorcentaje:
        gastoPresupuestadoDec.greaterThan(0)
          ? Math.round(gastoRealTotal.dividedBy(gastoPresupuestadoDec).times(100).toNumber())
          : 0,
      ingresoEsperado: redondear(ingresoEsperadoDec),
      ingresoReal: redondear(ingresoRealTotal),
      ahorroReal: redondear(ingresoRealTotal.minus(gastoRealTotal)),
    },
    categorias,
  };
}

export async function copiarPresupuesto(
  userId: string,
  presupuestoOrigenId: string,
  data: CopiarData
) {
  const origen = await prisma.presupuesto.findFirst({
    where: { id: presupuestoOrigenId, usuarioId: userId },
    include: { categorias: true },
  });
  if (!origen) throw new NotFoundError('Presupuesto origen');

  const fechaInicio = new Date(data.fechaInicio);
  const fechaFin = new Date(data.fechaFin);

  const existente = await prisma.presupuesto.findFirst({
    where: { usuarioId: userId, fechaInicio, fechaFin },
  });
  if (existente) throw new ConflictError('Ya existe un presupuesto para ese periodo');

  return prisma.$transaction(async (tx) => {
    const nuevo = await tx.presupuesto.create({
      data: {
        usuarioId: userId,
        fechaInicio,
        fechaFin,
        gastoPresupuestado: origen.gastoPresupuestado,
        ingresoEsperado: origen.ingresoEsperado,
        moneda: origen.moneda,
      },
    });

    if (origen.categorias.length) {
      await tx.presupuestoCategoria.createMany({
        data: origen.categorias.map((c) => ({
          presupuestoId: nuevo.id,
          categoriaId: c.categoriaId,
          montoPresupuestado: c.montoPresupuestado,
        })),
      });
    }

    return tx.presupuesto.findUniqueOrThrow({
      where: { id: nuevo.id },
      include: incluirCategorias,
    });
  });
}

export async function eliminar(userId: string, presupuestoId: string) {
  await verificarPresupuesto(userId, presupuestoId);
  await prisma.presupuesto.delete({ where: { id: presupuestoId } });
}
