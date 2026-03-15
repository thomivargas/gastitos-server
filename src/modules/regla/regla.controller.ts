import { asyncHandler } from '@utils/asyncHandler';
import * as reglaService from './regla.service';

export const crearRegla = asyncHandler(async (req, res) => {
  const regla = await reglaService.crear(req.user!.sub, req.body);
  res.status(201).json({ status: 'ok', data: regla });
});

export const listarReglas = asyncHandler(async (req, res) => {
  const reglas = await reglaService.listar(req.user!.sub);
  res.json({ status: 'ok', data: reglas });
});

export const obtenerRegla = asyncHandler(async (req, res) => {
  const regla = await reglaService.obtener(req.user!.sub, req.params.id as string);
  res.json({ status: 'ok', data: regla });
});

export const actualizarRegla = asyncHandler(async (req, res) => {
  const regla = await reglaService.actualizar(req.user!.sub, req.params.id as string, req.body);
  res.json({ status: 'ok', data: regla });
});

export const eliminarRegla = asyncHandler(async (req, res) => {
  await reglaService.eliminar(req.user!.sub, req.params.id as string);
  res.json({ status: 'ok', data: null });
});

export const sugerirCategoria = asyncHandler(async (req, res) => {
  const sugerencia = await reglaService.sugerirCategoria(req.user!.sub, req.body.descripcion);
  res.json({ status: 'ok', data: sugerencia });
});

export const aplicarReglas = asyncHandler(async (req, res) => {
  const resultado = await reglaService.aplicarReglas(req.user!.sub);
  res.json({ status: 'ok', data: resultado });
});
