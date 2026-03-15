import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;
type DecimalInput = Prisma.Decimal | number | string;

/** Suma N valores decimales sin perder precision */
export function sumar(...valores: DecimalInput[]): Prisma.Decimal {
  return valores.reduce<Prisma.Decimal>(
    (acc, val) => acc.plus(new Decimal(val)),
    new Decimal(0),
  );
}

/** Resta b de a sin perder precision */
export function restar(a: DecimalInput, b: DecimalInput): Prisma.Decimal {
  return new Decimal(a).minus(new Decimal(b));
}

/** Multiplica dos valores sin perder precision */
export function multiplicar(a: DecimalInput, b: DecimalInput): Prisma.Decimal {
  return new Decimal(a).times(new Decimal(b));
}

/** Divide a entre b sin perder precision */
export function dividir(a: DecimalInput, b: DecimalInput): Prisma.Decimal {
  return new Decimal(a).dividedBy(new Decimal(b));
}

/** Convierte a number redondeando a N decimales. Usar SOLO para serializar respuestas JSON */
export function redondear(val: DecimalInput, decimales = 2): number {
  return new Decimal(val).toDecimalPlaces(decimales).toNumber();
}

/** Negar un valor (cambiar signo) */
export function negar(val: DecimalInput): Prisma.Decimal {
  return new Decimal(val).negated();
}

export function esCero(val: DecimalInput): boolean {
  return new Decimal(val).isZero();
}

export function esPositivo(val: DecimalInput): boolean {
  return new Decimal(val).greaterThan(0);
}

export function esMayor(a: DecimalInput, b: DecimalInput): boolean {
  return new Decimal(a).greaterThan(new Decimal(b));
}

export { Decimal };
export type { DecimalInput };
