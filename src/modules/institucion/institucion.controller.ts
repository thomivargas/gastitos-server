import { asyncHandler } from '@utils/asyncHandler';
import { typedQuery } from '@middlewares/validate.middleware';
import { paramId } from '@utils/params';
import * as institucionService from './institucion.service';
import type { ListarInstitucionesQuery } from './institucion.schema';

export const listar = asyncHandler(async (req, res) => {
  const instituciones = await institucionService.listar(req.user!.sub, typedQuery<ListarInstitucionesQuery>(req));
  res.json({ status: 'ok', data: instituciones });
});

export const crear = asyncHandler(async (req, res) => {
  const institucion = await institucionService.crear(req.user!.sub, req.body);
  res.status(201).json({ status: 'ok', data: institucion });
});

export const actualizar = asyncHandler(async (req, res) => {
  const institucion = await institucionService.actualizar(req.user!.sub, paramId(req), req.body);
  res.json({ status: 'ok', data: institucion });
});

export const eliminar = asyncHandler(async (req, res) => {
  await institucionService.eliminar(req.user!.sub, paramId(req));
  res.json({ status: 'ok', message: 'Institución eliminada correctamente' });
});
