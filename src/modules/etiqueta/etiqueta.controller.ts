import { asyncHandler } from '@utils/asyncHandler';
import * as etiquetaService from './etiqueta.service';

export const crear = asyncHandler(async (req, res) => {
  const etiqueta = await etiquetaService.crear(req.user!.sub, req.body);
  res.status(201).json({ status: 'ok', data: etiqueta });
});

export const listar = asyncHandler(async (req, res) => {
  const etiquetas = await etiquetaService.listar(req.user!.sub);
  res.json({ status: 'ok', data: etiquetas });
});

export const actualizar = asyncHandler(async (req, res) => {
  const etiqueta = await etiquetaService.actualizar(req.user!.sub, req.params.id as string, req.body);
  res.json({ status: 'ok', data: etiqueta });
});

export const eliminar = asyncHandler(async (req, res) => {
  await etiquetaService.eliminar(req.user!.sub, req.params.id as string);
  res.json({ status: 'ok', message: 'Etiqueta eliminada correctamente' });
});
