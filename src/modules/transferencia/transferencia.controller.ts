import { asyncHandler } from '@utils/asyncHandler';
import { typedQuery } from '@middlewares/validate.middleware';
import { paramId } from '@utils/params';
import * as transferenciaService from './transferencia.service';
import type { ListaTransferenciaQuery } from './transferencia.schema';

export const crear = asyncHandler(async (req, res) => {
  const transferencia = await transferenciaService.crear(req.user!.sub, req.body);
  res.status(201).json({ status: 'ok', data: transferencia });
});

export const listar = asyncHandler(async (req, res) => {
  const resultado = await transferenciaService.listar(req.user!.sub, typedQuery<ListaTransferenciaQuery>(req));
  res.json({ status: 'ok', ...resultado });
});

export const obtener = asyncHandler(async (req, res) => {
  const transferencia = await transferenciaService.obtener(req.user!.sub, paramId(req));
  res.json({ status: 'ok', data: transferencia });
});

export const eliminar = asyncHandler(async (req, res) => {
  await transferenciaService.eliminar(req.user!.sub, paramId(req));
  res.json({ status: 'ok', message: 'Transferencia eliminada correctamente' });
});
