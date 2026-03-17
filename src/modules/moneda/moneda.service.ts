import { prisma } from '@config/database';
import { NotFoundError, AppError } from '@middlewares/errors';
import { hoyUTC } from '@utils/fecha';
import { logger } from '@config/logger';
import type { z } from 'zod';
import type { convertirQuerySchema } from './moneda.schema';

type ConvertirQuery = z.infer<typeof convertirQuerySchema>;

// Tipos de dólar soportados por dolarapi.com
const DOLAR_TIPOS = {
  blue: 'blue',
  mep: 'bolsa',
  oficial: 'oficial',
  tarjeta: 'tarjeta',
} as const;

interface DolarApiResponse {
  casa: string;
  nombre: string;
  compra: number;
  venta: number;
  fechaActualizacion: string;
}

/**
 * Obtiene la cotizacion de un tipo de dolar desde dolarapi.com.
 * Usa el precio de venta (lo que pagamos para comprar dolares).
 */
async function fetchDolarApi(tipo: keyof typeof DOLAR_TIPOS): Promise<DolarApiResponse> {
  const casa = DOLAR_TIPOS[tipo];
  const url = `https://dolarapi.com/v1/dolares/${casa}`;

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new AppError(`Error al consultar dolarapi.com: ${res.status}`, 502);
  }

  return res.json() as Promise<DolarApiResponse>;
}

/**
 * Actualiza las tasas de cambio desde dolarapi.com y las persiste en la DB.
 * Guarda tanto USD→ARS como ARS→USD para los tres tipos.
 */
export async function actualizarTasas() {
  const hoy = hoyUTC();

  const tipos = Object.keys(DOLAR_TIPOS) as Array<keyof typeof DOLAR_TIPOS>;
  const resultados: Array<{ tipo: string; compra: number; venta: number; fuente: string }> = [];

  for (const tipo of tipos) {
    try {
      const data = await fetchDolarApi(tipo);

      // Usamos precio de venta para USD→ARS (compra de dolares)
      // y precio de compra para ARS→USD (venta de dolares)
      const tasaUsdArs = data.venta;
      const tasaArsUsd = data.compra > 0 ? 1 / data.compra : 0;

      await Promise.all([
        prisma.tasaCambio.upsert({
          where: { monedaOrigen_monedaDestino_fecha: { monedaOrigen: `USD_${tipo.toUpperCase()}`, monedaDestino: 'ARS', fecha: hoy } },
          update: { tasa: tasaUsdArs },
          create: { monedaOrigen: `USD_${tipo.toUpperCase()}`, monedaDestino: 'ARS', tasa: tasaUsdArs, fecha: hoy },
        }),
        prisma.tasaCambio.upsert({
          where: { monedaOrigen_monedaDestino_fecha: { monedaOrigen: 'ARS', monedaDestino: `USD_${tipo.toUpperCase()}`, fecha: hoy } },
          update: { tasa: tasaArsUsd },
          create: { monedaOrigen: 'ARS', monedaDestino: `USD_${tipo.toUpperCase()}`, tasa: tasaArsUsd, fecha: hoy },
        }),
      ]);

      resultados.push({
        tipo,
        compra: data.compra,
        venta: data.venta,
        fuente: data.fechaActualizacion,
      });
    } catch (err) {
      // Si falla un tipo, continuamos con los demas
      logger.error({ err, tipo }, 'Error fetching dolar');
    }
  }

  return { fecha: hoy, tasas: resultados };
}

// Mutex para evitar multiples llamadas simultaneas a la API externa
let actualizandoTasas: Promise<void> | null = null;

async function actualizarTasasConMutex(): Promise<void> {
  if (actualizandoTasas) return actualizandoTasas;
  actualizandoTasas = actualizarTasas()
    .then(() => {})
    .finally(() => { actualizandoTasas = null; });
  return actualizandoTasas;
}

/**
 * Obtiene las tasas del dia actual de la DB.
 * Si no hay datos hoy, intenta actualizar primero (con mutex para evitar stampede).
 */
export async function obtenerTasasDelDia() {
  const hoy = hoyUTC();

  let tasas = await prisma.tasaCambio.findMany({
    where: {
      fecha: hoy,
      monedaDestino: 'ARS',
    },
    orderBy: { monedaOrigen: 'asc' },
  });

  // Si no hay datos hoy, actualizamos (con mutex)
  if (tasas.length === 0) {
    await actualizarTasasConMutex();
    tasas = await prisma.tasaCambio.findMany({
      where: { fecha: hoy, monedaDestino: 'ARS' },
      orderBy: { monedaOrigen: 'asc' },
    });
  }

  return tasas.map((t) => ({
    tipo: t.monedaOrigen.replace('USD_', '').toLowerCase(),
    monedaOrigen: t.monedaOrigen,
    monedaDestino: t.monedaDestino,
    tasa: Number(t.tasa),
    fecha: t.fecha,
  }));
}

/**
 * Obtiene la tasa de cambio para una conversion especifica.
 * tipo: 'blue' | 'mep' | 'oficial'
 */
export async function obtenerTasa(
  monedaOrigen: string,
  monedaDestino: string,
  tipo: 'blue' | 'mep' | 'oficial' | 'tarjeta' = 'blue',
  fecha?: Date
): Promise<number> {
  const fechaBusqueda = fecha ?? hoyUTC();
  if (fecha) fechaBusqueda.setUTCHours(0, 0, 0, 0);

  // Solo soportamos conversiones USD <-> ARS por ahora
  if (monedaOrigen === monedaDestino) return 1;

  let monedaOrigenDB: string;
  let monedaDestinoInterno: string;

  if (monedaOrigen === 'USD' && monedaDestino === 'ARS') {
    monedaOrigenDB = `USD_${tipo.toUpperCase()}`;
    monedaDestinoInterno = 'ARS';
  } else if (monedaOrigen === 'ARS' && monedaDestino === 'USD') {
    monedaOrigenDB = 'ARS';
    monedaDestinoInterno = `USD_${tipo.toUpperCase()}`;
  } else {
    throw new AppError(`Conversion de ${monedaOrigen} a ${monedaDestino} no soportada`, 400);
  }

  const tasaDB = await prisma.tasaCambio.findUnique({
    where: {
      monedaOrigen_monedaDestino_fecha: {
        monedaOrigen: monedaOrigenDB,
        monedaDestino: monedaDestinoInterno,
        fecha: fechaBusqueda,
      },
    },
  });

  if (tasaDB) return Number(tasaDB.tasa);

  // Si no hay en DB, buscar la mas reciente
  const tasaReciente = await prisma.tasaCambio.findFirst({
    where: {
      monedaOrigen: monedaOrigenDB,
      monedaDestino: monedaDestinoInterno,
      fecha: { lte: fechaBusqueda },
    },
    orderBy: { fecha: 'desc' },
  });

  if (tasaReciente) return Number(tasaReciente.tasa);

  // Si no hay ninguna, actualizamos desde la API (con mutex)
  await actualizarTasasConMutex();
  const tasaFresca = await prisma.tasaCambio.findFirst({
    where: { monedaOrigen: monedaOrigenDB, monedaDestino: monedaDestinoInterno },
    orderBy: { fecha: 'desc' },
  });

  if (!tasaFresca) throw new NotFoundError(`Tasa de cambio ${monedaOrigen}→${monedaDestino}`);
  return Number(tasaFresca.tasa);
}

/**
 * Convierte un monto entre monedas.
 */
export async function convertir(query: ConvertirQuery) {
  const tasa = await obtenerTasa(query.de, query.a, query.tipo);
  const montoConvertido = query.monto * tasa;

  return {
    de: query.de,
    a: query.a,
    tipo: query.tipo,
    montoOriginal: query.monto,
    montoConvertido: Math.round(montoConvertido * 100) / 100,
    tasa,
  };
}
