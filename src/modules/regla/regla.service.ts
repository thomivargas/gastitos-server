import { prisma } from '@config/database';
import { NotFoundError, ConflictError } from '@middlewares/errors';
import type { CrearReglaInput, ActualizarReglaInput } from './regla.schema';

const selectRegla = {
  id: true,
  nombre: true,
  patron: true,
  prioridad: true,
  activa: true,
  creadoEl: true,
  actualizadoEl: true,
  categoria: { select: { id: true, nombre: true, color: true, icono: true, clasificacion: true } },
} as const;

export async function crear(usuarioId: string, data: CrearReglaInput) {
  // Verificar que la categoria existe y pertenece al usuario
  const categoria = await prisma.categoria.findFirst({
    where: { id: data.categoriaId, usuarioId },
  });
  if (!categoria) throw new NotFoundError('Categoria');

  // Verificar nombre unico
  const existe = await prisma.reglaCategorizacion.findUnique({
    where: { usuarioId_nombre: { usuarioId, nombre: data.nombre } },
  });
  if (existe) throw new ConflictError('Ya existe una regla con ese nombre');

  return prisma.reglaCategorizacion.create({
    data: { ...data, usuarioId },
    select: selectRegla,
  });
}

export async function listar(usuarioId: string) {
  return prisma.reglaCategorizacion.findMany({
    where: { usuarioId },
    select: selectRegla,
    orderBy: [{ prioridad: 'desc' }, { nombre: 'asc' }],
  });
}

export async function obtener(usuarioId: string, reglaId: string) {
  const regla = await prisma.reglaCategorizacion.findFirst({
    where: { id: reglaId, usuarioId },
    select: selectRegla,
  });
  if (!regla) throw new NotFoundError('Regla');
  return regla;
}

export async function actualizar(usuarioId: string, reglaId: string, data: ActualizarReglaInput) {
  const regla = await prisma.reglaCategorizacion.findFirst({
    where: { id: reglaId, usuarioId },
  });
  if (!regla) throw new NotFoundError('Regla');

  // Verificar categoria si se esta cambiando
  if (data.categoriaId) {
    const categoria = await prisma.categoria.findFirst({
      where: { id: data.categoriaId, usuarioId },
    });
    if (!categoria) throw new NotFoundError('Categoria');
  }

  return prisma.reglaCategorizacion.update({
    where: { id: reglaId },
    data,
    select: selectRegla,
  });
}

export async function eliminar(usuarioId: string, reglaId: string) {
  const regla = await prisma.reglaCategorizacion.findFirst({
    where: { id: reglaId, usuarioId },
  });
  if (!regla) throw new NotFoundError('Regla');

  await prisma.reglaCategorizacion.delete({ where: { id: reglaId } });
}

/**
 * Busca la categoria que mejor matchea con una descripcion
 * segun las reglas activas del usuario, ordenadas por prioridad.
 * Retorna null si ninguna regla matchea.
 */
export async function sugerirCategoria(
  usuarioId: string,
  descripcion: string,
): Promise<{ id: string; nombre: string } | null> {
  const reglas = await prisma.reglaCategorizacion.findMany({
    where: { usuarioId, activa: true },
    select: { patron: true, categoria: { select: { id: true, nombre: true } } },
    orderBy: { prioridad: 'desc' },
  });

  const desc = descripcion.toLowerCase();

  for (const regla of reglas) {
    if (desc.includes(regla.patron.toLowerCase())) {
      return regla.categoria;
    }
  }

  return null;
}

/**
 * Aplica reglas de categorizacion a transacciones existentes sin categoria.
 * Agrupa por categoriaId y ejecuta updateMany en batch.
 */
export async function aplicarReglas(usuarioId: string) {
  const reglas = await prisma.reglaCategorizacion.findMany({
    where: { usuarioId, activa: true },
    select: { patron: true, categoriaId: true },
    orderBy: { prioridad: 'desc' },
  });

  if (reglas.length === 0) return { actualizadas: 0 };

  // Transacciones sin categoria del usuario
  const sinCategoria = await prisma.transaccion.findMany({
    where: { usuarioId, categoriaId: null },
    select: { id: true, descripcion: true },
  });

  // Agrupar IDs por categoriaId para hacer updates en batch
  const porCategoria = new Map<string, string[]>();

  for (const tx of sinCategoria) {
    const desc = tx.descripcion.toLowerCase();

    for (const regla of reglas) {
      if (desc.includes(regla.patron.toLowerCase())) {
        const ids = porCategoria.get(regla.categoriaId) ?? [];
        ids.push(tx.id);
        porCategoria.set(regla.categoriaId, ids);
        break; // solo aplica la primera regla que matchea (mayor prioridad)
      }
    }
  }

  // Ejecutar un updateMany por cada categoria (en vez de un update por transaccion)
  let actualizadas = 0;
  const updates = Array.from(porCategoria.entries()).map(([categoriaId, ids]) =>
    prisma.transaccion.updateMany({
      where: { id: { in: ids } },
      data: { categoriaId },
    }).then((r) => { actualizadas += r.count; })
  );

  await Promise.all(updates);

  return { actualizadas, total: sinCategoria.length };
}
