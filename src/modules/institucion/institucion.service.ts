import { prisma } from '@config/database';
import { NotFoundError, BadRequestError, ForbiddenError } from '@middlewares/errors';
import type { CrearInstitucionInput, ActualizarInstitucionInput, ListarInstitucionesQuery } from './institucion.schema';

const selectInstitucion = {
  id: true,
  nombre: true,
  tipo: true,
  color: true,
  icono: true,
  oficial: true,
  usuarioId: true,
} as const;

export async function listar(usuarioId: string, query: ListarInstitucionesQuery) {
  const where: any = {
    OR: [
      { oficial: true },
      { usuarioId },
    ],
  };

  if (query.tipo) where.tipo = query.tipo;
  if (query.search) where.nombre = { contains: query.search, mode: 'insensitive' };

  const instituciones = await prisma.institucion.findMany({
    where,
    select: selectInstitucion,
    orderBy: [{ oficial: 'desc' }, { nombre: 'asc' }],
  });

  return instituciones;
}

export async function crear(usuarioId: string, data: CrearInstitucionInput) {
  // Verificar que no exista ya una institución con el mismo nombre para este usuario
  const existe = await prisma.institucion.findFirst({
    where: { nombre: { equals: data.nombre, mode: 'insensitive' }, usuarioId, oficial: false },
  });

  if (existe) {
    throw new BadRequestError(`Ya existe una institución con el nombre "${data.nombre}"`);
  }

  const institucion = await prisma.institucion.create({
    data: {
      nombre: data.nombre,
      tipo: data.tipo ?? 'BANCO',
      color: data.color ?? '#6172F3',
      icono: data.icono ?? 'landmark',
      oficial: false,
      usuarioId,
    },
    select: selectInstitucion,
  });

  return institucion;
}

export async function actualizar(usuarioId: string, id: string, data: ActualizarInstitucionInput) {
  const institucion = await prisma.institucion.findFirst({
    where: { id },
    select: selectInstitucion,
  });

  if (!institucion) throw new NotFoundError('Institución');
  if (institucion.oficial) throw new ForbiddenError('No se pueden editar instituciones oficiales');
  if (institucion.usuarioId !== usuarioId) throw new ForbiddenError('No tenés permiso para editar esta institución');

  return prisma.institucion.update({
    where: { id },
    data: {
      ...(data.nombre !== undefined && { nombre: data.nombre }),
      ...(data.tipo !== undefined && { tipo: data.tipo }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.icono !== undefined && { icono: data.icono }),
    },
    select: selectInstitucion,
  });
}

export async function eliminar(usuarioId: string, id: string) {
  const institucion = await prisma.institucion.findFirst({
    where: { id },
    select: { ...selectInstitucion, _count: { select: { cuentas: true } } },
  });

  if (!institucion) throw new NotFoundError('Institución');
  if (institucion.oficial) throw new ForbiddenError('No se pueden eliminar instituciones oficiales');
  if (institucion.usuarioId !== usuarioId) throw new ForbiddenError('No tenés permiso para eliminar esta institución');
  if (institucion._count.cuentas > 0) {
    throw new BadRequestError(`No se puede eliminar porque tiene ${institucion._count.cuentas} cuenta(s) asociada(s)`);
  }

  await prisma.institucion.delete({ where: { id } });
}
