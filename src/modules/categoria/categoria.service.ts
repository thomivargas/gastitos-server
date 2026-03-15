import { prisma, type DbClient } from '@config/database';
import { NotFoundError, BadRequestError } from '@middlewares/errors';
import type { Prisma } from '@prisma/client';
import type { CrearCategoriaInput, ActualizarCategoriaInput, ListaCategoriaQuery } from './categoria.schema';

// Categorias por defecto que se crean al registrar un usuario
const CATEGORIAS_DEFAULT = {
  GASTO: [
    {
      nombre: 'Alimentacion',
      icono: 'utensils',
      color: '#EF4444',
      subcategorias: ['Supermercado', 'Restaurantes', 'Delivery'],
    },
    {
      nombre: 'Transporte',
      icono: 'car',
      color: '#F97316',
      subcategorias: ['Combustible', 'Transporte publico', 'Estacionamiento'],
    },
    {
      nombre: 'Vivienda',
      icono: 'home',
      color: '#8B5CF6',
      subcategorias: ['Alquiler', 'Servicios', 'Mantenimiento'],
    },
    {
      nombre: 'Salud',
      icono: 'heart-pulse',
      color: '#EC4899',
      subcategorias: ['Obra social', 'Farmacia', 'Consultas'],
    },
    {
      nombre: 'Entretenimiento',
      icono: 'gamepad-2',
      color: '#14B8A6',
      subcategorias: ['Streaming', 'Salidas', 'Hobbies'],
    },
    {
      nombre: 'Educacion',
      icono: 'graduation-cap',
      color: '#6366F1',
      subcategorias: ['Cursos', 'Libros', 'Universidad'],
    },
    {
      nombre: 'Ropa',
      icono: 'shirt',
      color: '#F59E0B',
      subcategorias: [],
    },
    {
      nombre: 'Servicios digitales',
      icono: 'wifi',
      color: '#3B82F6',
      subcategorias: ['Internet', 'Celular', 'Apps'],
    },
    {
      nombre: 'Impuestos',
      icono: 'landmark',
      color: '#78716C',
      subcategorias: [],
    },
    {
      nombre: 'Mascotas',
      icono: 'paw-print',
      color: '#A855F7',
      subcategorias: [],
    },
    {
      nombre: 'Otros gastos',
      icono: 'circle-ellipsis',
      color: '#6B7280',
      subcategorias: [],
    },
  ],
  INGRESO: [
    { nombre: 'Sueldo', icono: 'banknote', color: '#22C55E', subcategorias: [] },
    { nombre: 'Freelance', icono: 'laptop', color: '#10B981', subcategorias: [] },
    { nombre: 'Inversiones', icono: 'trending-up', color: '#059669', subcategorias: [] },
    { nombre: 'Ventas', icono: 'store', color: '#34D399', subcategorias: [] },
    { nombre: 'Otros ingresos', icono: 'plus-circle', color: '#6EE7B7', subcategorias: [] },
  ],
} as const;

/**
 * Crea las categorias por defecto para un usuario nuevo.
 * Acepta un cliente de transaccion para ejecutar dentro de $transaction.
 */
export async function crearCategoriasDefault(usuarioId: string, db: DbClient = prisma) {
  // Crear todas las categorias padre en batch
  const padresData: Prisma.CategoriaCreateManyInput[] = [];
  for (const [clasificacion, categorias] of Object.entries(CATEGORIAS_DEFAULT)) {
    for (const cat of categorias) {
      padresData.push({
        usuarioId,
        nombre: cat.nombre,
        icono: cat.icono,
        color: cat.color,
        clasificacion: clasificacion as 'INGRESO' | 'GASTO',
      });
    }
  }

  await db.categoria.createMany({ data: padresData });

  // Obtener los padres recien creados para mapear subcategorias
  const padresCreados = await db.categoria.findMany({
    where: { usuarioId, padreId: null },
    select: { id: true, nombre: true, clasificacion: true, icono: true, color: true },
  });

  const padreMap = new Map(padresCreados.map((p) => [`${p.clasificacion}_${p.nombre}`, p]));

  // Crear todas las subcategorias en un solo batch
  const subcategoriasData: Prisma.CategoriaCreateManyInput[] = [];
  for (const [clasificacion, categorias] of Object.entries(CATEGORIAS_DEFAULT)) {
    for (const cat of categorias) {
      if (cat.subcategorias.length === 0) continue;
      const padre = padreMap.get(`${clasificacion}_${cat.nombre}`);
      if (!padre) continue;
      for (const nombre of cat.subcategorias) {
        subcategoriasData.push({
          usuarioId,
          nombre,
          icono: cat.icono,
          color: cat.color,
          clasificacion: clasificacion as 'INGRESO' | 'GASTO',
          padreId: padre.id,
        });
      }
    }
  }

  if (subcategoriasData.length > 0) {
    await db.categoria.createMany({ data: subcategoriasData });
  }
}

const selectCategoria = {
  id: true,
  nombre: true,
  color: true,
  icono: true,
  clasificacion: true,
  padreId: true,
  creadoEl: true,
} as const;

export async function crear(usuarioId: string, data: CrearCategoriaInput) {
  // Si tiene padreId, verificar que el padre exista y tenga la misma clasificacion
  if (data.padreId) {
    const padre = await prisma.categoria.findFirst({
      where: { id: data.padreId, usuarioId },
      select: { clasificacion: true, padreId: true },
    });

    if (!padre) throw new NotFoundError('Categoria padre');
    if (padre.padreId) throw new BadRequestError('No se pueden crear subcategorias de subcategorias');
    if (padre.clasificacion !== data.clasificacion) {
      throw new BadRequestError('La subcategoria debe tener la misma clasificacion que la categoria padre');
    }
  }

  return prisma.categoria.create({
    data: {
      usuarioId,
      nombre: data.nombre,
      clasificacion: data.clasificacion,
      color: data.color,
      icono: data.icono,
      padreId: data.padreId,
    },
    select: selectCategoria,
  });
}

/**
 * Lista categorias agrupadas: las padres con sus subcategorias anidadas.
 */
export async function listar(usuarioId: string, query: ListaCategoriaQuery) {
  const where: Prisma.CategoriaWhereInput = {
    usuarioId,
    padreId: null, // solo categorias raiz
  };

  if (query.clasificacion) where.clasificacion = query.clasificacion;

  const categorias = await prisma.categoria.findMany({
    where,
    select: {
      ...selectCategoria,
      subcategorias: {
        select: selectCategoria,
        orderBy: { nombre: 'asc' },
      },
    },
    orderBy: { nombre: 'asc' },
  });

  return categorias;
}

export async function obtener(usuarioId: string, categoriaId: string) {
  const categoria = await prisma.categoria.findFirst({
    where: { id: categoriaId, usuarioId },
    select: {
      ...selectCategoria,
      subcategorias: {
        select: selectCategoria,
        orderBy: { nombre: 'asc' },
      },
    },
  });

  if (!categoria) throw new NotFoundError('Categoria');
  return categoria;
}

export async function actualizar(usuarioId: string, categoriaId: string, data: ActualizarCategoriaInput) {
  await obtener(usuarioId, categoriaId);

  return prisma.categoria.update({
    where: { id: categoriaId },
    data: {
      ...(data.nombre !== undefined && { nombre: data.nombre }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.icono !== undefined && { icono: data.icono }),
    },
    select: selectCategoria,
  });
}

export async function eliminar(usuarioId: string, categoriaId: string) {
  const categoria = await obtener(usuarioId, categoriaId);

  // Verificar que no tenga transacciones asociadas
  const transacciones = await prisma.transaccion.count({ where: { categoriaId } });
  if (transacciones > 0) {
    throw new BadRequestError(
      `No se puede eliminar la categoria porque tiene ${transacciones} transacciones asociadas`,
    );
  }

  // Si es padre, verificar subcategorias con transacciones
  if ('subcategorias' in categoria && Array.isArray(categoria.subcategorias) && categoria.subcategorias.length > 0) {
    const subIds = categoria.subcategorias.map((s: { id: string }) => s.id);
    const transSub = await prisma.transaccion.count({ where: { categoriaId: { in: subIds } } });
    if (transSub > 0) {
      throw new BadRequestError(
        `No se puede eliminar porque sus subcategorias tienen ${transSub} transacciones asociadas`,
      );
    }
    // Eliminar subcategorias primero
    await prisma.categoria.deleteMany({ where: { id: { in: subIds } } });
  }

  await prisma.categoria.delete({ where: { id: categoriaId } });
}
