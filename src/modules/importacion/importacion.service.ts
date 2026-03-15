import Papa from 'papaparse';
import { prisma } from '@config/database';
import { NotFoundError, BadRequestError } from '@middlewares/errors';
import { Decimal, sumar, negar, redondear } from '@utils/decimal';
import type { Prisma } from '@prisma/client';
import type { MapeoColumnas, EjecutarImportInput, ExportarQuery } from './importacion.schema';

interface FilaParseada {
  fila: number;
  fecha: Date;
  monto: number;
  tipo: 'INGRESO' | 'GASTO';
  descripcion: string;
  categoriaNombre?: string;
  notas?: string;
}

interface ErrorFila {
  fila: number;
  error: string;
}

/**
 * Parsea un archivo CSV y retorna las primeras filas para preview.
 */
export function preview(buffer: Buffer) {
  const contenido = buffer.toString('utf-8');
  const resultado = Papa.parse(contenido, {
    header: true,
    skipEmptyLines: true,
    preview: 5,
  });

  if (resultado.errors.length > 0 && resultado.data.length === 0) {
    throw new BadRequestError(`Error al parsear CSV: ${resultado.errors[0].message}`);
  }

  return {
    columnas: resultado.meta.fields ?? [],
    filas: resultado.data as Record<string, string>[],
    totalFilas: contenido.split('\n').filter((l) => l.trim()).length - 1, // sin header
  };
}

/**
 * Parsea una fecha segun el formato especificado.
 */
function parsearFecha(valor: string, formato: string): Date | null {
  const limpio = valor.trim();
  if (!limpio) return null;

  let anio: number, mes: number, dia: number;

  try {
    if (formato === 'YYYY-MM-DD') {
      [anio, mes, dia] = limpio.split('-').map(Number);
    } else if (formato === 'DD/MM/YYYY') {
      [dia, mes, anio] = limpio.split('/').map(Number);
    } else if (formato === 'MM/DD/YYYY') {
      [mes, dia, anio] = limpio.split('/').map(Number);
    } else if (formato === 'DD-MM-YYYY') {
      [dia, mes, anio] = limpio.split('-').map(Number);
    } else {
      return null;
    }
  } catch {
    return null;
  }

  if (!anio || !mes || !dia || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

  const fecha = new Date(anio, mes - 1, dia);
  if (isNaN(fecha.getTime())) return null;
  return fecha;
}

/**
 * Parsea un monto teniendo en cuenta el separador decimal.
 */
function parsearMonto(valor: string, separadorDecimal: '.' | ','): number | null {
  let limpio = valor.trim().replace(/\s/g, '');

  // Remover simbolo de moneda comun
  limpio = limpio.replace(/^[$€£AR$US$]+/i, '').replace(/[$€£]+$/, '');

  if (separadorDecimal === ',') {
    // Remover puntos de miles, reemplazar coma decimal por punto
    limpio = limpio.replace(/\./g, '').replace(',', '.');
  } else {
    // Remover comas de miles
    limpio = limpio.replace(/,/g, '');
  }

  const num = parseFloat(limpio);
  if (isNaN(num)) return null;
  return num;
}

/**
 * Parsea todas las filas del CSV y las valida.
 */
function parsearFilas(
  buffer: Buffer,
  mapeo: MapeoColumnas,
  formatoFecha: string,
  separadorDecimal: '.' | ',',
): { filas: FilaParseada[]; errores: ErrorFila[] } {
  const contenido = buffer.toString('utf-8');
  const resultado = Papa.parse(contenido, {
    header: true,
    skipEmptyLines: true,
  });

  const filas: FilaParseada[] = [];
  const errores: ErrorFila[] = [];

  for (let i = 0; i < resultado.data.length; i++) {
    const raw = resultado.data[i] as Record<string, string>;
    const numFila = i + 2; // +1 header, +1 base-1

    // Fecha
    const fechaRaw = raw[mapeo.fecha];
    if (!fechaRaw) {
      errores.push({ fila: numFila, error: `Columna "${mapeo.fecha}" vacia` });
      continue;
    }
    const fecha = parsearFecha(fechaRaw, formatoFecha);
    if (!fecha) {
      errores.push({ fila: numFila, error: `Fecha invalida: "${fechaRaw}"` });
      continue;
    }

    // Monto
    const montoRaw = raw[mapeo.monto];
    if (!montoRaw) {
      errores.push({ fila: numFila, error: `Columna "${mapeo.monto}" vacia` });
      continue;
    }
    const montoNum = parsearMonto(montoRaw, separadorDecimal);
    if (montoNum === null || montoNum === 0) {
      errores.push({ fila: numFila, error: `Monto invalido: "${montoRaw}"` });
      continue;
    }

    // Descripcion
    const descripcion = raw[mapeo.descripcion]?.trim();
    if (!descripcion) {
      errores.push({ fila: numFila, error: `Columna "${mapeo.descripcion}" vacia` });
      continue;
    }

    // Tipo: si hay columna mapeada la usa, sino infiere del signo del monto
    let tipo: 'INGRESO' | 'GASTO';
    if (mapeo.tipo && raw[mapeo.tipo]) {
      const tipoRaw = raw[mapeo.tipo].trim().toUpperCase();
      if (tipoRaw === 'INGRESO' || tipoRaw === 'INCOME' || tipoRaw === 'CREDITO' || tipoRaw === 'CR') {
        tipo = 'INGRESO';
      } else {
        tipo = 'GASTO';
      }
    } else {
      tipo = montoNum > 0 ? 'INGRESO' : 'GASTO';
    }

    // Categoria (nombre, se resuelve despues)
    const categoriaNombre = mapeo.categoria ? raw[mapeo.categoria]?.trim() : undefined;

    // Notas
    const notas = mapeo.notas ? raw[mapeo.notas]?.trim() : undefined;

    filas.push({
      fila: numFila,
      fecha,
      monto: Math.abs(montoNum),
      tipo,
      descripcion: descripcion.substring(0, 200),
      categoriaNombre: categoriaNombre || undefined,
      notas: notas ? notas.substring(0, 500) : undefined,
    });
  }

  return { filas, errores };
}

/**
 * Ejecuta la importacion de un CSV.
 * Crea transacciones en batch dentro de una transaccion de DB.
 */
export async function ejecutar(
  usuarioId: string,
  buffer: Buffer,
  input: EjecutarImportInput,
) {
  // Verificar cuenta
  const cuenta = await prisma.cuenta.findFirst({
    where: { id: input.cuentaId, usuarioId },
    select: { id: true, moneda: true },
  });
  if (!cuenta) throw new NotFoundError('Cuenta');

  // Parsear filas
  const { filas, errores } = parsearFilas(buffer, input.mapeo, input.formatoFecha, input.separadorDecimal);

  if (filas.length === 0) {
    throw new BadRequestError(
      errores.length > 0
        ? `No se pudo importar ninguna fila. Primer error: ${errores[0].error}`
        : 'El archivo CSV esta vacio',
    );
  }

  // Resolver categorias por nombre (cache para no buscar repetidas)
  const cacheCategorias = new Map<string, string | null>();

  async function resolverCategoria(nombre?: string): Promise<string | null> {
    if (!nombre) return null;
    const nombreLower = nombre.toLowerCase();

    if (cacheCategorias.has(nombreLower)) return cacheCategorias.get(nombreLower)!;

    const cat = await prisma.categoria.findFirst({
      where: {
        usuarioId,
        nombre: { equals: nombre, mode: 'insensitive' },
      },
      select: { id: true },
    });

    const id = cat?.id ?? null;
    cacheCategorias.set(nombreLower, id);
    return id;
  }

  // Cargar reglas de auto-categorizacion si aplica
  let sugerirCategoria: ((uid: string, desc: string) => Promise<{ id: string } | null>) | null = null;
  if (input.aplicarReglas) {
    try {
      const reglaService = await import('../regla/regla.service');
      sugerirCategoria = reglaService.sugerirCategoria;
    } catch {
      // Si no se puede cargar, continuar sin auto-categorizacion
    }
  }

  // Resolver categorias de todas las filas antes del batch
  const datosTransacciones: Prisma.TransaccionCreateManyInput[] = [];
  let balanceDelta = new Decimal(0);

  for (const fila of filas) {
    let categoriaId = await resolverCategoria(fila.categoriaNombre);

    if (!categoriaId && sugerirCategoria) {
      const sugerencia = await sugerirCategoria(usuarioId, fila.descripcion);
      if (sugerencia) categoriaId = sugerencia.id;
    }

    const montoDec = new Decimal(fila.monto);
    const delta = fila.tipo === 'INGRESO' ? montoDec : negar(montoDec);
    balanceDelta = sumar(balanceDelta, delta);

    datosTransacciones.push({
      usuarioId,
      cuentaId: input.cuentaId,
      tipo: fila.tipo,
      monto: fila.monto,
      moneda: cuenta.moneda,
      fecha: fila.fecha,
      descripcion: fila.descripcion,
      categoriaId,
      notas: fila.notas,
    });
  }

  // Crear en batches de 500 dentro de una transaccion
  const BATCH_SIZE = 500;

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < datosTransacciones.length; i += BATCH_SIZE) {
      await tx.transaccion.createMany({
        data: datosTransacciones.slice(i, i + BATCH_SIZE),
      });
    }

    // Actualizar balance de la cuenta con el delta total
    await tx.cuenta.update({
      where: { id: input.cuentaId },
      data: { balance: { increment: balanceDelta } },
    });
  });

  return {
    importadas: datosTransacciones.length,
    errores,
    totalFilas: filas.length + errores.length,
  };
}

/**
 * Exporta transacciones del usuario a formato CSV.
 * Usa cursor-based pagination para evitar cargar todo en memoria.
 */
export async function exportar(usuarioId: string, query: ExportarQuery): Promise<string> {
  const where: Prisma.TransaccionWhereInput = { usuarioId };

  if (query.cuentaId) where.cuentaId = query.cuentaId;
  if (query.fechaDesde || query.fechaHasta) {
    where.fecha = {};
    if (query.fechaDesde) where.fecha.gte = new Date(query.fechaDesde);
    if (query.fechaHasta) where.fecha.lte = new Date(query.fechaHasta);
  }

  const PAGE_SIZE = 1000;
  const datos: Array<Record<string, unknown>> = [];
  let cursor: string | undefined;

  // Paginar con cursor para no cargar todo en memoria de golpe
  while (true) {
    const batch = await prisma.transaccion.findMany({
      where,
      select: {
        id: true,
        fecha: true,
        tipo: true,
        monto: true,
        moneda: true,
        descripcion: true,
        notas: true,
        excluida: true,
        cuenta: { select: { nombre: true } },
        categoria: { select: { nombre: true } },
      },
      orderBy: { fecha: 'asc' },
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    if (batch.length === 0) break;

    for (const t of batch) {
      datos.push({
        fecha: t.fecha.toISOString().split('T')[0],
        tipo: t.tipo,
        monto: redondear(t.monto),
        moneda: t.moneda,
        descripcion: t.descripcion,
        categoria: t.categoria?.nombre ?? '',
        cuenta: t.cuenta.nombre,
        notas: t.notas ?? '',
        excluida: t.excluida ? 'si' : 'no',
      });
    }

    cursor = batch[batch.length - 1].id;
    if (batch.length < PAGE_SIZE) break;
  }

  return Papa.unparse(datos);
}

/**
 * Genera un CSV plantilla con las columnas esperadas.
 */
export function plantilla(): string {
  return Papa.unparse({
    fields: ['fecha', 'tipo', 'monto', 'descripcion', 'categoria', 'notas'],
    data: [
      ['2025-01-15', 'GASTO', '1500.50', 'Supermercado', 'Alimentacion', ''],
      ['2025-01-16', 'INGRESO', '50000', 'Sueldo enero', 'Salario', 'Deposito bancario'],
    ],
  });
}
