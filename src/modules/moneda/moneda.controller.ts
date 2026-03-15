import { asyncHandler } from '@utils/asyncHandler';
import { typedQuery } from '@middlewares/validate.middleware';
import * as monedaService from './moneda.service';
import type { ConvertirQuery } from './moneda.schema';

export const obtenerTasas = asyncHandler(async (req, res) => {
  const tasas = await monedaService.obtenerTasasDelDia();
  res.json({ status: 'ok', data: tasas });
});

export const convertirMonto = asyncHandler(async (req, res) => {
  const resultado = await monedaService.convertir(typedQuery<ConvertirQuery>(req));
  res.json({ status: 'ok', data: resultado });
});

export const actualizarTasas = asyncHandler(async (req, res) => {
  const { colaTasas } = await import('@config/queue');
  const job = await colaTasas.add('actualizar-tasas', {});
  res.json({ status: 'ok', data: { jobId: job.id, mensaje: 'Job encolado correctamente' } });
});
