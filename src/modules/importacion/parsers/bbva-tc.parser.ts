import { parsearExcel, parsearFecha, parsearMonto } from './utils';
import type { ParserBancario, OpcionesParser, TransaccionParseada, ResultadoParseo, PreviewBancario, MetadatosParseo } from './types';

// Patrones de cargos bancarios que se marcan como excluidos
const PATRON_CARGO_BANCARIO =
  /^(PERC[\.\s]|PERCEP|IVA\b|DB\s+IVA|IMPUESTO\s+DE\s+SELLOS|INTERES(ES)?\s+FINANC|COMISION\s|SEG[\.\s]DE\s+VIDA|CARGO\s+RESUMEN)/i;

/**
 * Extrae el periodo del nombre de la hoja (ej: "Mov_Periodo_16-03-2026" → "Marzo 2026")
 * o lo calcula a partir del rango de fechas de las transacciones.
 */
function extraerPeriodo(nombreHoja: string, transacciones: TransaccionParseada[]): string | undefined {
  // Intentar extraer del nombre de la hoja: Mov_Periodo_DD-MM-YYYY
  const match = nombreHoja.match(/(\d{2})-(\d{2})-(\d{4})$/);
  if (match) {
    const [, , mesStr, anioStr] = match;
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    const mes = parseInt(mesStr!, 10);
    const anio = anioStr!;
    if (mes >= 1 && mes <= 12) return `${meses[mes - 1]} ${anio}`;
  }

  // Fallback: mes/anio de la primera transaccion
  if (transacciones.length > 0) {
    const fecha = transacciones[0]!.fecha;
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    return `${meses[fecha.getMonth()]} ${fecha.getFullYear()}`;
  }

  return undefined;
}

function parsearFilasBBVA(buffer: Buffer, opciones?: OpcionesParser): { transacciones: TransaccionParseada[]; errores: { fila: number; error: string }[]; nombreHoja: string; totalFilas: number } {
  const { filas, nombreHoja } = parsearExcel(buffer);
  const transacciones: TransaccionParseada[] = [];
  const errores: { fila: number; error: string }[] = [];
  let filasRaw = 0;

  for (let i = 0; i < filas.length; i++) {
    const raw = filas[i]!;
    const numFila = i + 3; // header en fila 2, datos desde fila 3

    const fechaRaw = raw['Fecha'] ?? '';
    const establecimiento = (raw['Establecimiento'] ?? '').trim();
    const cuotaRaw = (raw['Cuota'] ?? '').trim();
    const montoArs = (raw['Importe en $'] ?? '').trim();
    const montoUsd = (raw['Importe en U$S'] ?? '').trim();

    // Excluir filas de footer (sin fecha o son totales)
    if (!fechaRaw || establecimiento.toLowerCase().startsWith('total') || establecimiento.toLowerCase().startsWith('monto total')) {
      continue;
    }

    filasRaw++;

    // Validar fecha
    const fecha = parsearFecha(fechaRaw, 'DD/MM/YYYY');
    if (!fecha) {
      errores.push({ fila: numFila, error: `Fecha invalida: "${fechaRaw}"` });
      continue;
    }

    // Determinar moneda y monto
    let moneda: string;
    let montoRaw: string;

    if (montoArs && montoArs !== '0' && montoArs !== '') {
      moneda = 'ARS';
      montoRaw = montoArs;
    } else if (montoUsd && montoUsd !== '0' && montoUsd !== '') {
      moneda = 'USD';
      montoRaw = montoUsd;
    } else {
      errores.push({ fila: numFila, error: `Sin monto valido en fila ${numFila}` });
      continue;
    }

    const monto = parsearMonto(montoRaw, ',');
    if (monto === null || monto === 0) {
      errores.push({ fila: numFila, error: `Monto invalido: "${montoRaw}"` });
      continue;
    }

    if (!establecimiento) {
      errores.push({ fila: numFila, error: `Descripcion vacia en fila ${numFila}` });
      continue;
    }

    // Detectar si es cargo bancario
    const excluida = PATRON_CARGO_BANCARIO.test(establecimiento);

    // Parsear cuotas: "2/3" → notas: "Cuota 2/3", "/" → null
    let notas: string | null = null;
    let fechaFinal = fecha;
    const matchCuota = cuotaRaw.match(/^(\d+)\/(\d+)$/);
    if (matchCuota) {
      const cuotaTexto = `Cuota ${matchCuota[1]}/${matchCuota[2]}`;
      if (opciones?.fechaResumen) {
        notas = `${cuotaTexto} (compra: ${fechaRaw})`;
        fechaFinal = opciones.fechaResumen;
      } else {
        notas = cuotaTexto;
      }
    }

    transacciones.push({
      fecha: fechaFinal,
      monto: Math.abs(monto),
      tipo: 'GASTO',
      descripcion: establecimiento.substring(0, 200),
      notas,
      moneda,
      excluida,
    });
  }

  return { transacciones, errores, nombreHoja, totalFilas: filasRaw };
}

export const bbvaTcParser: ParserBancario = {
  id: 'bbva-tc',
  nombre: 'BBVA Tarjeta de Credito',
  banco: 'BBVA',
  tipoArchivo: ['.xls', '.xlsx'],

  preview(buffer: Buffer, opciones?: OpcionesParser): PreviewBancario {
    const { transacciones, errores, nombreHoja, totalFilas } = parsearFilasBBVA(buffer, opciones);
    const filasExcluidas = transacciones.filter((t) => t.excluida).length;

    const periodo = extraerPeriodo(nombreHoja, transacciones);
    const metadatos: MetadatosParseo = {
      banco: 'BBVA',
      ...(periodo !== undefined && { periodo }),
      totalFilas,
      filasExcluidas,
    };

    return {
      transacciones: transacciones.slice(0, 10),
      metadatos,
      totalTransacciones: transacciones.length,
    };
  },

  parsear(buffer: Buffer, opciones?: OpcionesParser): ResultadoParseo {
    const { transacciones, errores, nombreHoja, totalFilas } = parsearFilasBBVA(buffer, opciones);
    const filasExcluidas = transacciones.filter((t) => t.excluida).length;
    const periodo = extraerPeriodo(nombreHoja, transacciones);

    return {
      transacciones,
      errores,
      metadatos: {
        banco: 'BBVA',
        ...(periodo !== undefined && { periodo }),
        totalFilas,
        filasExcluidas,
      },
    };
  },
};
