import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL no definida en .env');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const instituciones = [
  // Bancos
  { nombre: 'BBVA', tipo: 'BANCO' as const, color: '#004A97', icono: 'landmark' },
  { nombre: 'Santander', tipo: 'BANCO' as const, color: '#EC0000', icono: 'landmark' },
  { nombre: 'Galicia', tipo: 'BANCO' as const, color: '#E40000', icono: 'landmark' },
  { nombre: 'Macro', tipo: 'BANCO' as const, color: '#FDB913', icono: 'landmark' },
  { nombre: 'Nación', tipo: 'BANCO' as const, color: '#00529B', icono: 'landmark' },
  { nombre: 'Ciudad', tipo: 'BANCO' as const, color: '#003DA5', icono: 'landmark' },
  { nombre: 'HSBC', tipo: 'BANCO' as const, color: '#DB0011', icono: 'landmark' },
  { nombre: 'Itaú', tipo: 'BANCO' as const, color: '#F78200', icono: 'landmark' },
  { nombre: 'Supervielle', tipo: 'BANCO' as const, color: '#00A1E4', icono: 'landmark' },
  { nombre: 'Brubank', tipo: 'BANCO' as const, color: '#6D28D9', icono: 'landmark' },
  // Billeteras virtuales
  { nombre: 'Mercado Pago', tipo: 'BILLETERA_VIRTUAL' as const, color: '#009EE3', icono: 'smartphone' },
  { nombre: 'Uala', tipo: 'BILLETERA_VIRTUAL' as const, color: '#6C3CE1', icono: 'smartphone' },
  { nombre: 'Naranja X', tipo: 'BILLETERA_VIRTUAL' as const, color: '#FF6B00', icono: 'smartphone' },
  { nombre: 'Personal Pay', tipo: 'BILLETERA_VIRTUAL' as const, color: '#8B5CF6', icono: 'smartphone' },
  { nombre: 'dolar app', tipo: 'BILLETERA_VIRTUAL' as const, color: '#10B981', icono: 'smartphone' },
];

async function main() {
  console.log('Seeding instituciones oficiales...');

  for (const inst of instituciones) {
    const existe = await prisma.institucion.findFirst({
      where: { nombre: inst.nombre, oficial: true },
    });

    if (!existe) {
      await prisma.institucion.create({
        data: { ...inst, oficial: true },
      });
      console.log(`  ✓ ${inst.nombre}`);
    } else {
      console.log(`  - ${inst.nombre} (ya existe)`);
    }
  }

  console.log('Seed completado.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
