import { prisma } from '@config/database';
import { NotFoundError } from '@middlewares/errors';
import type { CrearEtiquetaInput, ActualizarEtiquetaInput } from './etiqueta.schema';

const selectEtiqueta = {
  id: true,
  nombre: true,
  color: true,
  creadoEl: true,
} as const;

export async function crear(usuarioId: string, data: CrearEtiquetaInput) {
  return prisma.etiqueta.create({
    data: {
      usuarioId,
      nombre: data.nombre,
      color: data.color,
    },
    select: selectEtiqueta,
  });
}

export async function listar(usuarioId: string) {
  return prisma.etiqueta.findMany({
    where: { usuarioId },
    select: selectEtiqueta,
    orderBy: { nombre: 'asc' },
  });
}

export async function actualizar(usuarioId: string, etiquetaId: string, data: ActualizarEtiquetaInput) {
  const etiqueta = await prisma.etiqueta.findFirst({
    where: { id: etiquetaId, usuarioId },
  });
  if (!etiqueta) throw new NotFoundError('Etiqueta');

  return prisma.etiqueta.update({
    where: { id: etiquetaId },
    data: {
      ...(data.nombre !== undefined && { nombre: data.nombre }),
      ...(data.color !== undefined && { color: data.color }),
    },
    select: selectEtiqueta,
  });
}

export async function eliminar(usuarioId: string, etiquetaId: string) {
  const etiqueta = await prisma.etiqueta.findFirst({
    where: { id: etiquetaId, usuarioId },
  });
  if (!etiqueta) throw new NotFoundError('Etiqueta');

  await prisma.etiqueta.delete({ where: { id: etiquetaId } });
}
