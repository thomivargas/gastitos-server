import { prisma } from '@config/database';
import { NotFoundError, BadRequestError } from '@middlewares/errors';
import { getPaginationArgs, buildPaginatedResult } from '@utils/pagination';
import { Decimal, sumar, multiplicar, redondear } from '@utils/decimal';
import type { TipoCuenta, ClasificacionCuenta, Prisma } from '@prisma/client';
import type { CrearCuentaInput, ActualizarCuentaInput, ListaCuentasQuery } from './cuenta.schema';

// Tipos que son pasivos; el resto son activos
const TIPOS_PASIVO: TipoCuenta[] = ['TARJETA_CREDITO', 'PRESTAMO', 'OTRO_PASIVO'];

function derivarClasificacion(tipo: TipoCuenta): ClasificacionCuenta {
  return TIPOS_PASIVO.includes(tipo) ? 'PASIVO' : 'ACTIVO';
}

const selectCuenta = {
  id: true,
  nombre: true,
  tipo: true,
  clasificacion: true,
  moneda: true,
  balance: true,
  estado: true,
  institucion: true,
  color: true,
  icono: true,
  notas: true,
  detalles: true,
  creadoEl: true,
  actualizadoEl: true,
} as const;

export async function crear(usuarioId: string, data: CrearCuentaInput) {
  const clasificacion = derivarClasificacion(data.tipo);

  const cuenta = await prisma.cuenta.create({
    data: {
      usuarioId,
      nombre: data.nombre,
      tipo: data.tipo,
      clasificacion,
      moneda: data.moneda ?? 'ARS',
      balance: data.balanceInicial ?? 0,
      institucion: data.institucion,
      color: data.color,
      icono: data.icono,
      notas: data.notas,
      detalles: (data.detalles as object) ?? {},
    },
    select: selectCuenta,
  });

  return cuenta;
}

export async function listar(usuarioId: string, query: ListaCuentasQuery) {
  const where: Prisma.CuentaWhereInput = { usuarioId };

  if (query.estado) where.estado = query.estado;
  if (query.tipo) where.tipo = query.tipo;
  if (query.clasificacion) where.clasificacion = query.clasificacion;

  const { skip, take } = getPaginationArgs(query);
  const orderBy = { [query.ordenarPor]: query.orden };

  const [cuentas, total] = await Promise.all([
    prisma.cuenta.findMany({ where, select: selectCuenta, skip, take, orderBy }),
    prisma.cuenta.count({ where }),
  ]);

  return buildPaginatedResult(cuentas, total, query);
}

export async function obtener(usuarioId: string, cuentaId: string) {
  const cuenta = await prisma.cuenta.findFirst({
    where: { id: cuentaId, usuarioId },
    select: selectCuenta,
  });

  if (!cuenta) throw new NotFoundError('Cuenta');
  return cuenta;
}

export async function actualizar(usuarioId: string, cuentaId: string, data: ActualizarCuentaInput) {
  // Verificar que la cuenta existe y pertenece al usuario
  await obtener(usuarioId, cuentaId);

  const cuenta = await prisma.cuenta.update({
    where: { id: cuentaId },
    data: {
      ...(data.nombre !== undefined && { nombre: data.nombre }),
      ...(data.moneda !== undefined && { moneda: data.moneda }),
      ...(data.institucion !== undefined && { institucion: data.institucion }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.icono !== undefined && { icono: data.icono }),
      ...(data.notas !== undefined && { notas: data.notas }),
      ...(data.detalles !== undefined && { detalles: data.detalles as object }),
    },
    select: selectCuenta,
  });

  return cuenta;
}

export async function archivar(usuarioId: string, cuentaId: string) {
  await obtener(usuarioId, cuentaId);

  const cuenta = await prisma.cuenta.update({
    where: { id: cuentaId },
    data: { estado: 'ARCHIVADA' },
    select: selectCuenta,
  });

  return cuenta;
}

export async function reactivar(usuarioId: string, cuentaId: string) {
  await obtener(usuarioId, cuentaId);

  const cuenta = await prisma.cuenta.update({
    where: { id: cuentaId },
    data: { estado: 'ACTIVA' },
    select: selectCuenta,
  });

  return cuenta;
}

export async function eliminar(usuarioId: string, cuentaId: string) {
  await obtener(usuarioId, cuentaId);

  // Verificar que no tenga transacciones
  const transacciones = await prisma.transaccion.count({ where: { cuentaId } });
  if (transacciones > 0) {
    throw new BadRequestError(
      `No se puede eliminar la cuenta porque tiene ${transacciones} transacciones. Archivala en su lugar.`,
    );
  }

  await prisma.cuenta.delete({ where: { id: cuentaId } });
}

export async function obtenerResumen(
  usuarioId: string,
  monedaSolicitada?: string,
  tipoDolar: 'blue' | 'mep' | 'oficial' = 'blue',
  soloMoneda = false,
) {
  const [cuentas, usuario] = await Promise.all([
    prisma.cuenta.findMany({
      where: { usuarioId, estado: 'ACTIVA' },
      select: { clasificacion: true, balance: true, moneda: true },
    }),
    prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { moneda: true },
    }),
  ]);

  const monedaObjetivo = monedaSolicitada ?? usuario?.moneda ?? 'ARS';

  // Modo soloMoneda: filtrar cuentas por moneda sin convertir
  if (soloMoneda) {
    const cuentasFiltradas = cuentas.filter((c) => c.moneda === monedaObjetivo);
    let totalActivos = new Decimal(0);
    let totalPasivos = new Decimal(0);

    for (const cuenta of cuentasFiltradas) {
      const balance = new Decimal(cuenta.balance);
      if (cuenta.clasificacion === 'ACTIVO') {
        totalActivos = sumar(totalActivos, balance);
      } else {
        totalPasivos = sumar(totalPasivos, balance);
      }
    }

    return {
      moneda: monedaObjetivo,
      tipoDolar,
      totalActivos: redondear(totalActivos),
      totalPasivos: redondear(totalPasivos),
      patrimonioNeto: redondear(totalActivos.minus(totalPasivos)),
      cantidadCuentas: cuentasFiltradas.length,
      origenes: {},
      tasasUsadas: {},
    };
  }

  // Importar obtenerTasa dinamicamente para evitar dependencia circular
  const { obtenerTasa } = await import('../moneda/moneda.service');

  // Cache de tasas para no repetir lookups
  const tasaCache = new Map<string, Prisma.Decimal | null>();

  async function getTasa(monedaOrigen: string): Promise<Prisma.Decimal | null> {
    if (monedaOrigen === monedaObjetivo) return new Decimal(1);
    if (!tasaCache.has(monedaOrigen)) {
      try {
        const tasa = await obtenerTasa(monedaOrigen, monedaObjetivo, tipoDolar);
        tasaCache.set(monedaOrigen, new Decimal(tasa));
      } catch {
        tasaCache.set(monedaOrigen, null);
      }
    }
    return tasaCache.get(monedaOrigen)!;
  }

  let totalActivos = new Decimal(0);
  let totalPasivos = new Decimal(0);
  // Balances originales por moneda distinta (para desglose)
  const origenes: Record<string, Prisma.Decimal> = {};
  // Balances que no se pudieron convertir
  const sinConvertir: Record<string, { activos: Prisma.Decimal; pasivos: Prisma.Decimal }> = {};

  for (const cuenta of cuentas) {
    const balance = new Decimal(cuenta.balance);
    const tasa = await getTasa(cuenta.moneda);

    if (tasa !== null) {
      const convertido = multiplicar(balance, tasa);
      if (cuenta.clasificacion === 'ACTIVO') {
        totalActivos = sumar(totalActivos, convertido);
      } else {
        totalPasivos = sumar(totalPasivos, convertido);
      }
      if (cuenta.moneda !== monedaObjetivo) {
        origenes[cuenta.moneda] = sumar(origenes[cuenta.moneda] ?? 0, balance);
      }
    } else {
      if (!sinConvertir[cuenta.moneda]) sinConvertir[cuenta.moneda] = { activos: new Decimal(0), pasivos: new Decimal(0) };
      if (cuenta.clasificacion === 'ACTIVO') {
        sinConvertir[cuenta.moneda].activos = sumar(sinConvertir[cuenta.moneda].activos, balance);
      } else {
        sinConvertir[cuenta.moneda].pasivos = sumar(sinConvertir[cuenta.moneda].pasivos, balance);
      }
    }
  }

  // Construir mapa de tasas usadas
  const tasasUsadas: Record<string, number> = {};
  for (const [monedaOrigen, tasa] of tasaCache.entries()) {
    if (tasa !== null) tasasUsadas[`${monedaOrigen}_${monedaObjetivo}`] = redondear(tasa, 4);
  }

  // Serializar origenes y sinConvertir a number para JSON
  const origenesNum: Record<string, number> = {};
  for (const [moneda, val] of Object.entries(origenes)) {
    origenesNum[moneda] = redondear(val);
  }

  const sinConvertirNum: Record<string, { activos: number; pasivos: number }> = {};
  for (const [moneda, val] of Object.entries(sinConvertir)) {
    sinConvertirNum[moneda] = { activos: redondear(val.activos), pasivos: redondear(val.pasivos) };
  }

  return {
    moneda: monedaObjetivo,
    tipoDolar,
    totalActivos: redondear(totalActivos),
    totalPasivos: redondear(totalPasivos),
    patrimonioNeto: redondear(totalActivos.minus(totalPasivos)),
    cantidadCuentas: cuentas.length,
    origenes: origenesNum,
    tasasUsadas,
    ...(Object.keys(sinConvertirNum).length > 0 && { sinConvertir: sinConvertirNum }),
  };
}
