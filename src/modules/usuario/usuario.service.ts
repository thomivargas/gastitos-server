import { prisma } from '@config/database';
import { NotFoundError } from '@middlewares/errors';
import type { ActualizarPerfilInput } from './usuario.schema';

const selectPerfil = {
  id: true,
  email: true,
  nombre: true,
  moneda: true,
  preferencias: true,
  creadoEl: true,
  actualizadoEl: true,
} as const;

export async function obtenerPerfil(userId: string) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: selectPerfil,
  });

  if (!usuario) throw new NotFoundError('Usuario');
  return usuario;
}

export async function actualizarPerfil(userId: string, data: ActualizarPerfilInput) {
  // Si se envian preferencias, mergear con las existentes
  let preferenciasActualizadas: Record<string, unknown> | undefined;

  if (data.preferencias) {
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { preferencias: true },
    });
    if (!usuario) throw new NotFoundError('Usuario');

    const prefActuales = (usuario.preferencias as Record<string, unknown>) ?? {};
    preferenciasActualizadas = { ...prefActuales, ...data.preferencias };
  }

  const usuario = await prisma.usuario.update({
    where: { id: userId },
    data: {
      ...(data.nombre && { nombre: data.nombre }),
      ...(data.moneda && { moneda: data.moneda }),
      ...(preferenciasActualizadas && { preferencias: preferenciasActualizadas as object }),
    },
    select: selectPerfil,
  });

  return usuario;
}
