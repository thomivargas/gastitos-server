import { asyncHandler } from '@utils/asyncHandler';
import { typedQuery } from '@middlewares/validate.middleware';
import { paramId } from '@utils/params';
import * as cuentaService from './cuenta.service';
import type { ListaCuentasQuery } from './cuenta.schema';

export const crear = asyncHandler(async (req, res) => {
  const cuenta = await cuentaService.crear(req.user!.sub, req.body);
  res.status(201).json({ status: 'ok', data: cuenta });
});

export const listar = asyncHandler(async (req, res) => {
  const resultado = await cuentaService.listar(req.user!.sub, typedQuery<ListaCuentasQuery>(req));
  res.json({ status: 'ok', ...resultado });
});

export const obtener = asyncHandler(async (req, res) => {
  const cuenta = await cuentaService.obtener(req.user!.sub, paramId(req));
  res.json({ status: 'ok', data: cuenta });
});

export const actualizar = asyncHandler(async (req, res) => {
  const cuenta = await cuentaService.actualizar(req.user!.sub, paramId(req), req.body);
  res.json({ status: 'ok', data: cuenta });
});

export const archivar = asyncHandler(async (req, res) => {
  const cuenta = await cuentaService.archivar(req.user!.sub, paramId(req));
  res.json({ status: 'ok', data: cuenta });
});

export const reactivar = asyncHandler(async (req, res) => {
  const cuenta = await cuentaService.reactivar(req.user!.sub, paramId(req));
  res.json({ status: 'ok', data: cuenta });
});

export const eliminar = asyncHandler(async (req, res) => {
  await cuentaService.eliminar(req.user!.sub, paramId(req));
  res.json({ status: 'ok', message: 'Cuenta eliminada correctamente' });
});

export const obtenerResumen = asyncHandler(async (req, res) => {
  const moneda = typeof req.query.moneda === 'string' ? req.query.moneda.toUpperCase() : undefined;
  const tipoDolar = (req.query.tipoDolar as 'blue' | 'mep' | 'oficial') || 'blue';
  const soloMoneda = req.query.soloMoneda === 'true' || req.query.soloMoneda === '1';
  const resumen = await cuentaService.obtenerResumen(req.user!.sub, moneda, tipoDolar, soloMoneda);
  res.json({ status: 'ok', data: resumen });
});
