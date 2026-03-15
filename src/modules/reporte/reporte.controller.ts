import { asyncHandler } from '@utils/asyncHandler';
import { typedQuery } from '@middlewares/validate.middleware';
import * as reporteService from './reporte.service';
import type {
  ResumenMensualQuery,
  RangoFechaQuery,
  TendenciaMensualQuery,
  FlujoCajaQuery,
  TopGastosQuery,
} from './reporte.schema';

export const resumenMensual = asyncHandler(async (req, res) => {
  const data = await reporteService.resumenMensual(req.user!.sub, typedQuery<ResumenMensualQuery>(req));
  res.json({ status: 'ok', data });
});

export const gastoPorCategoria = asyncHandler(async (req, res) => {
  const data = await reporteService.gastoPorCategoria(req.user!.sub, typedQuery<RangoFechaQuery>(req));
  res.json({ status: 'ok', data });
});

export const ingresoPorCategoria = asyncHandler(async (req, res) => {
  const data = await reporteService.ingresoPorCategoria(req.user!.sub, typedQuery<RangoFechaQuery>(req));
  res.json({ status: 'ok', data });
});

export const tendenciaMensual = asyncHandler(async (req, res) => {
  const data = await reporteService.tendenciaMensual(req.user!.sub, typedQuery<TendenciaMensualQuery>(req));
  res.json({ status: 'ok', data });
});

export const flujoDeCaja = asyncHandler(async (req, res) => {
  const data = await reporteService.flujoDeCaja(req.user!.sub, typedQuery<FlujoCajaQuery>(req));
  res.json({ status: 'ok', data });
});

export const topGastos = asyncHandler(async (req, res) => {
  const data = await reporteService.topGastos(req.user!.sub, typedQuery<TopGastosQuery>(req));
  res.json({ status: 'ok', data });
});
