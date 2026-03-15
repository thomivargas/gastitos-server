import { asyncHandler } from '@utils/asyncHandler';
import { typedQuery } from '@middlewares/validate.middleware';
import { BadRequestError } from '@middlewares/errors';
import { ejecutarImportSchema } from './importacion.schema';
import type { ExportarQuery } from './importacion.schema';
import * as importService from './importacion.service';

export const previewCSV = asyncHandler(async (req, res) => {
  if (!req.file) throw new BadRequestError('No se envio ningun archivo');
  const resultado = importService.preview(req.file.buffer);
  res.json({ status: 'ok', data: resultado });
});

export const ejecutarImport = asyncHandler(async (req, res) => {
  if (!req.file) throw new BadRequestError('No se envio ningun archivo');

  // El body viene como form-data: el campo "config" es un JSON string con el mapeo
  let rawConfig: unknown;
  try {
    rawConfig = typeof req.body.config === 'string' ? JSON.parse(req.body.config) : req.body.config;
  } catch {
    throw new BadRequestError('El campo "config" debe ser un JSON valido');
  }

  const config = ejecutarImportSchema.parse(rawConfig);
  const resultado = await importService.ejecutar(req.user!.sub, req.file.buffer, config);
  res.json({ status: 'ok', data: resultado });
});

export const exportarCSV = asyncHandler(async (req, res) => {
  const csv = await importService.exportar(req.user!.sub, typedQuery<ExportarQuery>(req));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="gastitos-export.csv"');
  res.send(csv);
});

export const descargarPlantilla = asyncHandler(async (_req, res) => {
  const csv = importService.plantilla();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="gastitos-plantilla.csv"');
  res.send(csv);
});
