import { prisma } from '@config/database';
import { hashPassword } from '@utils/hash';
import { generateAccessToken } from '@utils/jwt';

/**
 * Crea un usuario de prueba y devuelve sus datos + token.
 */
export async function crearUsuarioTest(overrides: { email?: string; nombre?: string } = {}) {
  const email = overrides.email ?? `test-${Date.now()}@gastitos.com`;
  const usuario = await prisma.usuario.create({
    data: {
      email,
      nombre: overrides.nombre ?? 'Test User',
      passwordHash: await hashPassword('Test1234'),
    },
  });

  const token = generateAccessToken({ sub: usuario.id, email: usuario.email, role: 'USUARIO' });

  return { usuario, token };
}

/**
 * Limpia todas las tablas en orden seguro (respetando foreign keys).
 */
export async function limpiarDB() {
  await prisma.$transaction([
    prisma.transaccionEtiqueta.deleteMany(),
    prisma.transferencia.deleteMany(),
    prisma.transaccion.deleteMany(),
    prisma.transaccionRecurrente.deleteMany(),
    prisma.sesion.deleteMany(),
    prisma.reglaCategorizacion.deleteMany(),
    prisma.balanceHistorico.deleteMany(),
    prisma.etiqueta.deleteMany(),
    prisma.categoria.deleteMany(),
    prisma.cuenta.deleteMany(),
    prisma.tasaCambio.deleteMany(),
    prisma.usuario.deleteMany(),
  ]);
}
