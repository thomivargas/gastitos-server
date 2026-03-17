import Papa from 'papaparse';
import { prisma } from '@config/database';
import { NotFoundError, BadRequestError } from '@middlewares/errors';
import { Decimal, sumar, negar, redondear } from '@utils/decimal';
import { Prisma } from '@prisma/client';
import type { MapeoColumnas, EjecutarImportInput, EjecutarImportBancarioInput } from './importacion.schema';
import { esExcel, parsearExcel, parsearFecha, parsearMonto } from './parsers/utils';
import { obtenerParser, listarParsers as listarParsersRegistry } from './parsers/registro';


interface FilaParseada {
  fila: number;
  fecha: Date;
  monto: number;
  tipo: 'INGRESO' | 'GASTO';
  descripcion: string;
  categoriaNombre: string | undefined;
  notas: string | undefined;
}

interface ErrorFila {
  fila: number;
  error: string;
}

/**
 * Parsea un archivo (CSV o Excel) y retorna las primeras filas para preview.
 */
export function preview(buffer: Buffer) {
  if (esExcel(buffer)) {
    const { columnas, filas } = parsearExcel(buffer);
    return {
      columnas,
      filas: filas.slice(0, 5),
      totalFilas: filas.length,
    };
  }

  const contenido = buffer.toString('utf-8');
  const resultado = Papa.parse(contenido, {
    header: true,
    skipEmptyLines: true,
    preview: 5,
  });

  if (resultado.errors.length > 0 && resultado.data.length === 0) {
    throw new BadRequestError(`Error al parsear CSV: ${resultado.errors[0]!.message}`);
  }

  return {
    columnas: resultado.meta.fields ?? [],
    filas: resultado.data as Record<string, string>[],
    totalFilas: contenido.split('\n').filter((l) => l.trim()).length - 1, // sin header
  };
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
  let rawFilas: Record<string, string>[];

  if (esExcel(buffer)) {
    rawFilas = parsearExcel(buffer).filas;
  } else {
    const contenido = buffer.toString('utf-8');
    const resultado = Papa.parse(contenido, { header: true, skipEmptyLines: true });
    rawFilas = resultado.data as Record<string, string>[];
  }

  const filas: FilaParseada[] = [];
  const errores: ErrorFila[] = [];

  for (let i = 0; i < rawFilas.length; i++) {
    const raw = rawFilas[i]!;
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
      const tipoRaw = raw[mapeo.tipo]!.trim().toUpperCase();
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
        ? `No se pudo importar ninguna fila. Primer error: ${errores[0]!.error}`
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
      notas: fila.notas ?? null,
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
 * Lista los parsers bancarios disponibles.
 */
export function obtenerParsersDisponibles() {
  return listarParsersRegistry();
}

/**
 * Retorna un preview de las transacciones de un archivo bancario (sin importar).
 */
export function previewBancario(buffer: Buffer, parserId: string) {
  const parser = obtenerParser(parserId);
  if (!parser) throw new BadRequestError(`Parser bancario "${parserId}" no encontrado`);
  return parser.preview(buffer);
}

/**
 * Ejecuta la importacion bancaria.
 * Separa transacciones por moneda y las asigna a la cuenta correspondiente.
 */
export async function ejecutarBancario(
  usuarioId: string,
  buffer: Buffer,
  input: EjecutarImportBancarioInput,
) {
  const parser = obtenerParser(input.parserId);
  if (!parser) throw new BadRequestError(`Parser bancario "${input.parserId}" no encontrado`);

  // Parsear el archivo
  const { transacciones: todasTransacciones, errores, metadatos } = parser.parsear(buffer);

  // Verificar que las cuentas pertenecen al usuario y obtener su moneda
  const cuentaIds = Object.values(input.cuentas);
  const cuentas = await prisma.cuenta.findMany({
    where: { id: { in: cuentaIds }, usuarioId },
    select: { id: true, moneda: true },
  });

  if (cuentas.length !== cuentaIds.length) {
    throw new NotFoundError('Una o mas cuentas no encontradas');
  }

  // Mapa de cuentaId -> moneda de la cuenta
  const cuentaMonedaMap = new Map(cuentas.map((c) => [c.id, c.moneda]));

  // Filtrar cargos bancarios si aplica
  const transacciones = input.excluirCargosBancarios
    ? todasTransacciones.filter((t) => !t.excluida)
    : todasTransacciones;

  const excluidas = todasTransacciones.filter((t) => t.excluida).length;

  if (transacciones.length === 0) {
    throw new BadRequestError('No hay transacciones validas para importar');
  }

  // Cargar reglas si aplica
  let sugerirCategoria: ((uid: string, desc: string) => Promise<{ id: string } | null>) | null = null;
  if (input.aplicarReglas) {
    try {
      const reglaService = await import('../regla/regla.service');
      sugerirCategoria = reglaService.sugerirCategoria;
    } catch {
      // Continuar sin auto-categorizacion
    }
  }

  // Cache de categorias
  const cacheCategorias = new Map<string, string | null>();
  async function resolverCategoria(desc: string): Promise<string | null> {
    const key = desc.toLowerCase();
    if (cacheCategorias.has(key)) return cacheCategorias.get(key)!;
    let id: string | null = null;
    if (sugerirCategoria) {
      const sugerencia = await sugerirCategoria(usuarioId, desc);
      id = sugerencia?.id ?? null;
    }
    cacheCategorias.set(key, id);
    return id;
  }

  // Construir datos de transacciones agrupados por cuenta
  const datosPorCuenta = new Map<string, { datos: Prisma.TransaccionCreateManyInput[]; delta: Prisma.Decimal }>();

  for (const t of transacciones) {
    const cuentaId = input.cuentas[t.moneda];
    if (!cuentaId) {
      // Si no hay cuenta para esta moneda, agregar a errores y continuar
      errores.push({ fila: 0, error: `Sin cuenta configurada para moneda ${t.moneda}: "${t.descripcion}"` });
      continue;
    }

    const monedaCuenta = cuentaMonedaMap.get(cuentaId)!;
    const categoriaId = await resolverCategoria(t.descripcion);
    const montoDec = new Decimal(t.monto);
    const delta = t.tipo === 'INGRESO' ? montoDec : negar(montoDec);

    if (!datosPorCuenta.has(cuentaId)) {
      datosPorCuenta.set(cuentaId, { datos: [], delta: new Decimal(0) });
    }
    const entry = datosPorCuenta.get(cuentaId)!;
    entry.delta = sumar(entry.delta, delta);
    entry.datos.push({
      usuarioId,
      cuentaId,
      tipo: t.tipo,
      monto: t.monto,
      moneda: monedaCuenta,
      fecha: t.fecha,
      descripcion: t.descripcion,
      categoriaId,
      notas: t.notas ?? null,
      excluida: false,
    });
  }

  const BATCH_SIZE = 500;
  let importadas = 0;
  const porCuenta: Record<string, number> = {};

  await prisma.$transaction(async (tx) => {
    for (const [cuentaId, { datos, delta }] of datosPorCuenta.entries()) {
      for (let i = 0; i < datos.length; i += BATCH_SIZE) {
        await tx.transaccion.createMany({ data: datos.slice(i, i + BATCH_SIZE) });
      }
      await tx.cuenta.update({
        where: { id: cuentaId },
        data: { balance: { increment: delta } },
      });
      importadas += datos.length;
      const moneda = cuentaMonedaMap.get(cuentaId)!;
      porCuenta[moneda] = (porCuenta[moneda] ?? 0) + datos.length;
    }
  });

  return {
    importadas,
    excluidas,
    errores,
    totalFilas: metadatos.totalFilas,
    periodo: metadatos.periodo,
    porCuenta,
  };
}

