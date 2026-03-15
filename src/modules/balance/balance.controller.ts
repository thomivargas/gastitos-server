import { asyncHandler } from '@utils/asyncHandler';
import { typedQuery } from '@middlewares/validate.middleware';
import * as balanceService from './balance.service';
import type { HistorialQuery, PatrimonioQuery } from './balance.schema';

export const generarSnapshot = asyncHandler(async (req, res) => {
  const resultado = await balanceService.registrarSnapshotsTodas(req.user!.sub);
  res.status(201).json({ status: 'ok', data: resultado });
});

export const obtenerHistorial = asyncHandler(async (req, res) => {
  const historial = await balanceService.obtenerHistorial(req.user!.sub, typedQuery<HistorialQuery>(req));
  res.json({ status: 'ok', data: historial });
});

export const obtenerPatrimonio = asyncHandler(async (req, res) => {
  const patrimonio = await balanceService.obtenerHistorialGlobal(req.user!.sub, typedQuery<PatrimonioQuery>(req));
  res.json({ status: 'ok', data: patrimonio });
});
