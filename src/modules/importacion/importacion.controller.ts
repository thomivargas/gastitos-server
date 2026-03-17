import { asyncHandler } from '@utils/asyncHandler';
import { BadRequestError } from '@middlewares/errors';
import { ejecutarImportSchema, ejecutarImportBancarioSchema, previewBancarioSchema } from './importacion.schema';
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

export const listarParsers = asyncHandler(async (_req, res) => {
  const parsers = importService.obtenerParsersDisponibles();
  res.json({ status: 'ok', data: parsers });
});

export const previewBancario = asyncHandler(async (req, res) => {
  if (!req.file) throw new BadRequestError('No se envio ningun archivo');

  let rawConfig: unknown;
  try {
    rawConfig = typeof req.body.config === 'string' ? JSON.parse(req.body.config) : req.body.config;
  } catch {
    throw new BadRequestError('El campo "config" debe ser un JSON valido');
  }

  const { parserId } = previewBancarioSchema.parse(rawConfig);
  const resultado = importService.previewBancario(req.file.buffer, parserId);
  res.json({ status: 'ok', data: resultado });
});

export const ejecutarImportBancario = asyncHandler(async (req, res) => {
  if (!req.file) throw new BadRequestError('No se envio ningun archivo');

  let rawConfig: unknown;
  try {
    rawConfig = typeof req.body.config === 'string' ? JSON.parse(req.body.config) : req.body.config;
  } catch {
    throw new BadRequestError('El campo "config" debe ser un JSON valido');
  }

  const config = ejecutarImportBancarioSchema.parse(rawConfig);
  const resultado = await importService.ejecutarBancario(req.user!.sub, req.file.buffer, config);
  res.json({ status: 'ok', data: resultado });
});
