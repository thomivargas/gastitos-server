import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from './env';

declare global {
  var __prisma: PrismaClient | undefined;
}

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

let prisma: PrismaClient;

if (env.NODE_ENV === 'production') {
  prisma = new PrismaClient({ adapter });
} else {
  if (!global.__prisma) global.__prisma = new PrismaClient({ adapter });
  prisma = global.__prisma;
}

/** Tipo que funciona tanto para PrismaClient como para el cliente de transaccion interactiva */
export type DbClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$transaction' | '$on' | '$extends'>;

export { prisma };
