export interface TransaccionParseada {
  fecha: Date;
  monto: number;
  tipo: 'INGRESO' | 'GASTO';
  descripcion: string;
  notas: string | null;
  moneda: string;       // 'ARS' | 'USD' | etc.
  excluida: boolean;    // true = cargo bancario (IVA, percepciones, etc.)
}

export interface ErrorParseo {
  fila: number;
  error: string;
}

export interface MetadatosParseo {
  banco: string;
  periodo?: string;       // ej: "Febrero 2026"
  totalFilas: number;     // filas raw en el archivo (sin header ni footer)
  filasExcluidas: number; // footers + cargos bancarios detectados
}

export interface ResultadoParseo {
  transacciones: TransaccionParseada[];
  errores: ErrorParseo[];
  metadatos: MetadatosParseo;
}

export interface PreviewBancario {
  transacciones: TransaccionParseada[]; // primeras 10
  metadatos: MetadatosParseo;
  totalTransacciones: number;
}

export interface ParserBancario {
  id: string;             // 'bbva-tc'
  nombre: string;         // 'BBVA Tarjeta de Credito'
  banco: string;          // 'BBVA'
  tipoArchivo: string[];  // ['.xls', '.xlsx']
  preview(buffer: Buffer): PreviewBancario;
  parsear(buffer: Buffer): ResultadoParseo;
}
