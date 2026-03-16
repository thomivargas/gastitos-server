import type { ParserBancario } from './types';
import { bbvaTcParser } from './bbva-tc.parser';

const parsers = new Map<string, ParserBancario>();

export function registrarParser(parser: ParserBancario): void {
  parsers.set(parser.id, parser);
}

export function obtenerParser(id: string): ParserBancario | undefined {
  return parsers.get(id);
}

export function listarParsers(): Array<{ id: string; nombre: string; banco: string; tipoArchivo: string[] }> {
  return [...parsers.values()].map((p) => ({
    id: p.id,
    nombre: p.nombre,
    banco: p.banco,
    tipoArchivo: p.tipoArchivo,
  }));
}

// Registrar parsers disponibles
registrarParser(bbvaTcParser);
