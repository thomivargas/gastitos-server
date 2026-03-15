import { prisma } from '@config/database';
import { Decimal, sumar, multiplicar, redondear } from '@utils/decimal';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type {
  resumenMensualQuerySchema,
  rangoFechaQuerySchema,
  tendenciaMensualQuerySchema,
  flujoCajaQuerySchema,
  topGastosQuerySchema,
} from './reporte.schema';

type ResumenMensualQuery = z.infer<typeof resumenMensualQuerySchema>;
type RangoFechaQuery = z.infer<typeof rangoFechaQuerySchema>;
type TendenciaMensualQuery = z.infer<typeof tendenciaMensualQuerySchema>;
type FlujoCajaQuery = z.infer<typeof flujoCajaQuerySchema>;
type TopGastosQuery = z.infer<typeof topGastosQuerySchema>;

function rangoDelMes(anio: number, mes: number) {
  const desde = new Date(anio, mes - 1, 1);
  const hasta = new Date(anio, mes, 0, 23, 59, 59, 999);
  return { desde, hasta };
}

function parsearRango(query: RangoFechaQuery) {
  const hoy = new Date();
  const desde = query.desde ? new Date(query.desde) : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const hasta = query.hasta ? new Date(query.hasta) : hoy;
  return { desde, hasta };
}

export async function resumenMensual(userId: string, query: ResumenMensualQuery) {
  const { desde, hasta } = rangoDelMes(query.anio, query.mes);
  const tipoDolar = query.tipoDolar ?? 'blue';

  // Determinar moneda objetivo
  const monedaObjetivo = query.moneda ?? (
    await prisma.usuario.findUnique({ where: { id: userId }, select: { moneda: true } })
  )?.moneda ?? 'ARS';

  // Modo soloMoneda: filtrar por moneda sin convertir
  if (query.soloMoneda) {
    const transacciones = await prisma.transaccion.findMany({
      where: { usuarioId: userId, excluida: false, fecha: { gte: desde, lte: hasta }, moneda: monedaObjetivo },
      select: { tipo: true, monto: true },
    });

    let totalIngresos = new Decimal(0);
    let totalGastos = new Decimal(0);
    let cantIngresos = 0;
    let cantGastos = 0;

    for (const tx of transacciones) {
      if (tx.tipo === 'INGRESO') {
        totalIngresos = sumar(totalIngresos, tx.monto);
        cantIngresos++;
      } else if (tx.tipo === 'GASTO') {
        totalGastos = sumar(totalGastos, tx.monto);
        cantGastos++;
      }
    }

    const ahorroNeto = totalIngresos.minus(totalGastos);

    return {
      moneda: monedaObjetivo,
      tipoDolar,
      periodo: { anio: query.anio, mes: query.mes, desde, hasta },
      ingresos: { total: redondear(totalIngresos), cantidad: cantIngresos, origenes: {} },
      gastos: { total: redondear(totalGastos), cantidad: cantGastos, origenes: {} },
      ahorroNeto: redondear(ahorroNeto),
      tasaAhorro: totalIngresos.greaterThan(0) ? Math.round(ahorroNeto.dividedBy(totalIngresos).times(100).toNumber()) : 0,
      tasasUsadas: {},
    };
  }

  // Traer transacciones individuales con su moneda para poder convertir
  const transacciones = await prisma.transaccion.findMany({
    where: { usuarioId: userId, excluida: false, fecha: { gte: desde, lte: hasta } },
    select: { tipo: true, monto: true, moneda: true },
  });

  const { obtenerTasa } = await import('../moneda/moneda.service');

  // Cache de tasas para no repetir lookups
  const tasaCache = new Map<string, Prisma.Decimal>();

  async function getTasa(monedaOrigen: string): Promise<Prisma.Decimal> {
    if (monedaOrigen === monedaObjetivo) return new Decimal(1);
    const clave = `${monedaOrigen}_${monedaObjetivo}`;
    if (!tasaCache.has(clave)) {
      const tasa = await obtenerTasa(monedaOrigen, monedaObjetivo, tipoDolar);
      tasaCache.set(clave, new Decimal(tasa));
    }
    return tasaCache.get(clave)!;
  }

  let totalIngresos = new Decimal(0);
  let totalGastos = new Decimal(0);
  let cantIngresos = 0;
  let cantGastos = 0;

  // Totales originales por moneda distinta (para desglose)
  const origIngresos: Record<string, Prisma.Decimal> = {};
  const origGastos: Record<string, Prisma.Decimal> = {};

  for (const tx of transacciones) {
    const montoOrig = new Decimal(tx.monto);
    const tasa = await getTasa(tx.moneda);
    const montoConvertido = multiplicar(montoOrig, tasa);

    if (tx.tipo === 'INGRESO') {
      totalIngresos = sumar(totalIngresos, montoConvertido);
      cantIngresos++;
      if (tx.moneda !== monedaObjetivo) {
        origIngresos[tx.moneda] = sumar(origIngresos[tx.moneda] ?? 0, montoOrig);
      }
    } else if (tx.tipo === 'GASTO') {
      totalGastos = sumar(totalGastos, montoConvertido);
      cantGastos++;
      if (tx.moneda !== monedaObjetivo) {
        origGastos[tx.moneda] = sumar(origGastos[tx.moneda] ?? 0, montoOrig);
      }
    }
  }

  // Construir mapa de tasas usadas para el desglose
  const tasasUsadas: Record<string, number> = {};
  for (const [clave, tasa] of tasaCache.entries()) {
    tasasUsadas[clave] = redondear(tasa, 4);
  }

  // Serializar origenes a number
  const origIngresosNum: Record<string, number> = {};
  for (const [m, v] of Object.entries(origIngresos)) origIngresosNum[m] = redondear(v);
  const origGastosNum: Record<string, number> = {};
  for (const [m, v] of Object.entries(origGastos)) origGastosNum[m] = redondear(v);

  const ahorroNeto = totalIngresos.minus(totalGastos);

  return {
    moneda: monedaObjetivo,
    tipoDolar,
    periodo: { anio: query.anio, mes: query.mes, desde, hasta },
    ingresos: { total: redondear(totalIngresos), cantidad: cantIngresos, origenes: origIngresosNum },
    gastos: { total: redondear(totalGastos), cantidad: cantGastos, origenes: origGastosNum },
    ahorroNeto: redondear(ahorroNeto),
    tasaAhorro: totalIngresos.greaterThan(0) ? Math.round(ahorroNeto.dividedBy(totalIngresos).times(100).toNumber()) : 0,
    tasasUsadas,
  };
}

export async function gastoPorCategoria(userId: string, query: RangoFechaQuery) {
  const { desde, hasta } = parsearRango(query);

  const gastos = await prisma.transaccion.groupBy({
    by: ['categoriaId'],
    where: { usuarioId: userId, tipo: 'GASTO', excluida: false, fecha: { gte: desde, lte: hasta } },
    _sum: { monto: true },
    _count: true,
    orderBy: { _sum: { monto: 'desc' } },
  });

  const totalGasto = gastos.reduce<Prisma.Decimal>(
    (acc, g) => sumar(acc, g._sum.monto ?? 0), new Decimal(0),
  );

  // Enriquecer con datos de categoria
  const categoriaIds = gastos.map((g) => g.categoriaId).filter(Boolean) as string[];
  const categorias = await prisma.categoria.findMany({
    where: { id: { in: categoriaIds } },
    select: { id: true, nombre: true, color: true, icono: true },
  });
  const catMap = new Map(categorias.map((c) => [c.id, c]));

  return {
    periodo: { desde, hasta },
    total: redondear(totalGasto),
    categorias: gastos.map((g) => {
      const monto = new Decimal(g._sum.monto ?? 0);
      return {
        categoria: g.categoriaId ? catMap.get(g.categoriaId) ?? null : null,
        monto: redondear(monto),
        cantidad: g._count,
        porcentaje: totalGasto.greaterThan(0) ? Math.round(monto.dividedBy(totalGasto).times(100).toNumber()) : 0,
      };
    }),
  };
}

export async function ingresoPorCategoria(userId: string, query: RangoFechaQuery) {
  const { desde, hasta } = parsearRango(query);

  const ingresos = await prisma.transaccion.groupBy({
    by: ['categoriaId'],
    where: { usuarioId: userId, tipo: 'INGRESO', excluida: false, fecha: { gte: desde, lte: hasta } },
    _sum: { monto: true },
    _count: true,
    orderBy: { _sum: { monto: 'desc' } },
  });

  const totalIngreso = ingresos.reduce<Prisma.Decimal>(
    (acc, i) => sumar(acc, i._sum.monto ?? 0), new Decimal(0),
  );

  const categoriaIds = ingresos.map((i) => i.categoriaId).filter(Boolean) as string[];
  const categorias = await prisma.categoria.findMany({
    where: { id: { in: categoriaIds } },
    select: { id: true, nombre: true, color: true, icono: true },
  });
  const catMap = new Map(categorias.map((c) => [c.id, c]));

  return {
    periodo: { desde, hasta },
    total: redondear(totalIngreso),
    categorias: ingresos.map((i) => {
      const monto = new Decimal(i._sum.monto ?? 0);
      return {
        categoria: i.categoriaId ? catMap.get(i.categoriaId) ?? null : null,
        monto: redondear(monto),
        cantidad: i._count,
        porcentaje: totalIngreso.greaterThan(0) ? Math.round(monto.dividedBy(totalIngreso).times(100).toNumber()) : 0,
      };
    }),
  };
}

export async function tendenciaMensual(userId: string, query: TendenciaMensualQuery) {
  const hoy = new Date();

  // Calcular rango total: desde el inicio del mes mas antiguo hasta hoy
  const fechaInicio = new Date(hoy.getFullYear(), hoy.getMonth() - (query.meses - 1), 1);

  // Un solo query + agrupacion en JS (en vez de 2*N queries paralelos)
  const transacciones = await prisma.transaccion.findMany({
    where: {
      usuarioId: userId,
      excluida: false,
      tipo: { in: ['INGRESO', 'GASTO'] },
      fecha: { gte: fechaInicio, lte: hoy },
    },
    select: { tipo: true, monto: true, fecha: true },
  });

  // Inicializar meses con ceros
  const mesesMap = new Map<string, { anio: number; mes: number; ingresos: Prisma.Decimal; gastos: Prisma.Decimal }>();

  for (let i = query.meses - 1; i >= 0; i--) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const anio = fecha.getFullYear();
    const mes = fecha.getMonth() + 1;
    mesesMap.set(`${anio}-${mes}`, { anio, mes, ingresos: new Decimal(0), gastos: new Decimal(0) });
  }

  // Agrupar transacciones por mes
  for (const tx of transacciones) {
    const d = new Date(tx.fecha);
    const clave = `${d.getFullYear()}-${d.getMonth() + 1}`;
    const entry = mesesMap.get(clave);
    if (!entry) continue;

    if (tx.tipo === 'INGRESO') {
      entry.ingresos = sumar(entry.ingresos, tx.monto);
    } else {
      entry.gastos = sumar(entry.gastos, tx.monto);
    }
  }

  return Array.from(mesesMap.values()).map(({ anio, mes, ingresos, gastos }) => ({
    anio,
    mes,
    ingresos: redondear(ingresos),
    gastos: redondear(gastos),
    ahorro: redondear(ingresos.minus(gastos)),
  }));
}

export async function flujoDeCaja(userId: string, query: FlujoCajaQuery) {
  const { desde, hasta } = parsearRango(query);

  // Obtener todas las transacciones del periodo
  const transacciones = await prisma.transaccion.findMany({
    where: {
      usuarioId: userId,
      excluida: false,
      tipo: { in: ['INGRESO', 'GASTO'] },
      fecha: { gte: desde, lte: hasta },
    },
    select: { tipo: true, monto: true, fecha: true },
    orderBy: { fecha: 'asc' },
  });

  // Agrupar segun agrupacion solicitada
  const grupos = new Map<string, { ingresos: Prisma.Decimal; gastos: Prisma.Decimal }>();

  for (const tx of transacciones) {
    const clave = generarClavePeriodo(tx.fecha, query.agrupacion);
    if (!grupos.has(clave)) grupos.set(clave, { ingresos: new Decimal(0), gastos: new Decimal(0) });
    const g = grupos.get(clave)!;
    if (tx.tipo === 'INGRESO') g.ingresos = sumar(g.ingresos, tx.monto);
    else g.gastos = sumar(g.gastos, tx.monto);
  }

  return {
    periodo: { desde, hasta, agrupacion: query.agrupacion },
    flujo: Array.from(grupos.entries()).map(([periodo, valores]) => ({
      periodo,
      ingresos: redondear(valores.ingresos),
      gastos: redondear(valores.gastos),
      neto: redondear(valores.ingresos.minus(valores.gastos)),
    })),
  };
}

function generarClavePeriodo(fecha: Date, agrupacion: 'dia' | 'semana' | 'mes'): string {
  const d = new Date(fecha);
  if (agrupacion === 'dia') {
    return d.toISOString().split('T')[0]!;
  }
  if (agrupacion === 'mes') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  // semana: usar el lunes de esa semana
  const diaSemana = d.getDay() === 0 ? 6 : d.getDay() - 1; // 0=lunes
  const lunes = new Date(d);
  lunes.setDate(d.getDate() - diaSemana);
  return lunes.toISOString().split('T')[0]!;
}

export async function topGastos(userId: string, query: TopGastosQuery) {
  const { desde, hasta } = parsearRango(query);

  const transacciones = await prisma.transaccion.findMany({
    where: {
      usuarioId: userId,
      tipo: 'GASTO',
      excluida: false,
      fecha: { gte: desde, lte: hasta },
    },
    select: {
      id: true,
      monto: true,
      moneda: true,
      fecha: true,
      descripcion: true,
      categoria: { select: { id: true, nombre: true, color: true, icono: true } },
      cuenta: { select: { id: true, nombre: true } },
    },
    orderBy: { monto: 'desc' },
    take: query.limit,
  });

  return {
    periodo: { desde, hasta },
    transacciones: transacciones.map((t) => ({
      ...t,
      monto: redondear(t.monto),
    })),
  };
}
