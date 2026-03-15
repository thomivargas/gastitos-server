import { asyncHandler } from '@utils/asyncHandler';
import { typedQuery } from '@middlewares/validate.middleware';
import { paramId } from '@utils/params';
import * as transaccionService from './transaccion.service';
import type { ListaTransaccionQuery } from './transaccion.schema';

export const crear = asyncHandler(async (req, res) => {
  const transaccion = await transaccionService.crear(req.user!.sub, req.body);
  res.status(201).json({ status: 'ok', data: transaccion });
});

export const listar = asyncHandler(async (req, res) => {
  const resultado = await transaccionService.listar(req.user!.sub, typedQuery<ListaTransaccionQuery>(req));
  res.json({ status: 'ok', ...resultado });
});

export const obtener = asyncHandler(async (req, res) => {
  const transaccion = await transaccionService.obtener(req.user!.sub, paramId(req));
  res.json({ status: 'ok', data: transaccion });
});

export const actualizar = asyncHandler(async (req, res) => {
  const transaccion = await transaccionService.actualizar(
    req.user!.sub,
    paramId(req),
    req.body,
  );
  res.json({ status: 'ok', data: transaccion });
});

export const eliminar = asyncHandler(async (req, res) => {
  await transaccionService.eliminar(req.user!.sub, paramId(req));
  res.json({ status: 'ok', message: 'Transaccion eliminada correctamente' });
});
