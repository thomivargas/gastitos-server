import * as XLSX from 'xlsx';
import { BadRequestError } from '@middlewares/errors';

/**
 * Detecta si un buffer es un archivo Excel (XLSX/XLS) por su magic bytes.
 */
export function esExcel(buffer: Buffer): boolean {
  // XLSX: PK header (ZIP)
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) return true;
  // XLS: OLE2 header
  if (buffer[0] === 0xd0 && buffer[1] === 0xcf) return true;
  return false;
}

/**
 * Convierte un buffer Excel a filas de strings.
 * Detecta automaticamente la fila de encabezados buscando la que tenga mas celdas con contenido.
 */
export function parsearExcel(buffer: Buffer): { columnas: string[]; filas: Record<string, string>[]; nombreHoja: string } {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const nombreHoja = workbook.SheetNames[0]!;
  const hoja = workbook.Sheets[nombreHoja];
  if (!hoja) throw new BadRequestError('El archivo Excel no tiene hojas');

  const rawRows = XLSX.utils.sheet_to_json<string[]>(hoja, { header: 1, defval: '', raw: false });
  if (rawRows.length === 0) throw new BadRequestError('El archivo Excel esta vacio');

  // Encontrar la fila con mas celdas no vacias en las primeras 10 filas (= headers reales)
  let headerIdx = 0;
  let maxNoVacias = 0;
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const noVacias = (rawRows[i] as string[]).filter((c) => c && String(c).trim()).length;
    if (noVacias > maxNoVacias) {
      maxNoVacias = noVacias;
      headerIdx = i;
    }
  }

  const columnas = (rawRows[headerIdx] as string[]).map((c) => String(c).trim());

  const filas = rawRows
    .slice(headerIdx + 1)
    .filter((row) => (row as string[]).some((c) => c && String(c).trim()))
    .map((row) =>
      Object.fromEntries(
        columnas.map((col, i) => [col, String((row as string[])[i] ?? '').trim()]),
      ),
    );

  if (filas.length === 0) throw new BadRequestError('El archivo Excel no tiene datos');

  return { columnas, filas, nombreHoja };
}

/**
 * Parsea una fecha segun el formato especificado.
 */
export function parsearFecha(valor: string, formato: string): Date | null {
  const limpio = valor.trim();
  if (!limpio) return null;

  let anio: number, mes: number, dia: number;

  try {
    if (formato === 'YYYY-MM-DD') {
      [anio, mes, dia] = limpio.split('-').map(Number) as [number, number, number];
    } else if (formato === 'DD/MM/YYYY') {
      [dia, mes, anio] = limpio.split('/').map(Number) as [number, number, number];
    } else if (formato === 'MM/DD/YYYY') {
      [mes, dia, anio] = limpio.split('/').map(Number) as [number, number, number];
    } else if (formato === 'DD-MM-YYYY') {
      [dia, mes, anio] = limpio.split('-').map(Number) as [number, number, number];
    } else {
      return null;
    }
  } catch {
    return null;
  }

  if (!anio! || !mes! || !dia! || mes! < 1 || mes! > 12 || dia! < 1 || dia! > 31) return null;

  const fecha = new Date(anio!, mes! - 1, dia!);
  if (isNaN(fecha.getTime())) return null;
  return fecha;
}

/**
 * Parsea un monto teniendo en cuenta el separador decimal.
 */
export function parsearMonto(valor: string, separadorDecimal: '.' | ','): number | null {
  let limpio = valor.trim().replace(/\s/g, '');

  // Remover simbolo de moneda comun
  limpio = limpio.replace(/^[$€£AR$US$]+/i, '').replace(/[$€£]+$/, '');

  if (separadorDecimal === ',') {
    limpio = limpio.replace(/\./g, '').replace(',', '.');
  } else {
    limpio = limpio.replace(/,/g, '');
  }

  const num = parseFloat(limpio);
  if (isNaN(num)) return null;
  return num;
}
