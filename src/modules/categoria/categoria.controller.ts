import { asyncHandler } from '@utils/asyncHandler';
import { typedQuery } from '@middlewares/validate.middleware';
import { paramId } from '@utils/params';
import * as categoriaService from './categoria.service';
import type { ListaCategoriaQuery } from './categoria.schema';

export const crear = asyncHandler(async (req, res) => {
  const categoria = await categoriaService.crear(req.user!.sub, req.body);
  res.status(201).json({ status: 'ok', data: categoria });
});

export const listar = asyncHandler(async (req, res) => {
  const categorias = await categoriaService.listar(req.user!.sub, typedQuery<ListaCategoriaQuery>(req));
  res.json({ status: 'ok', data: categorias });
});

export const obtener = asyncHandler(async (req, res) => {
  const categoria = await categoriaService.obtener(req.user!.sub, paramId(req));
  res.json({ status: 'ok', data: categoria });
});

export const actualizar = asyncHandler(async (req, res) => {
  const categoria = await categoriaService.actualizar(req.user!.sub, paramId(req), req.body);
  res.json({ status: 'ok', data: categoria });
});

export const eliminar = asyncHandler(async (req, res) => {
  await categoriaService.eliminar(req.user!.sub, paramId(req));
  res.json({ status: 'ok', message: 'Categoria eliminada correctamente' });
});
