import { asyncHandler } from '@utils/asyncHandler';
import * as recurrenteService from './recurrente.service';

export const crearRecurrente = asyncHandler(async (req, res) => {
  const recurrente = await recurrenteService.crear(req.user!.sub, req.body);
  res.status(201).json({ status: 'ok', data: recurrente });
});

export const listarRecurrentes = asyncHandler(async (req, res) => {
  const recurrentes = await recurrenteService.listar(req.user!.sub);
  res.json({ status: 'ok', data: recurrentes });
});

export const obtenerRecurrente = asyncHandler(async (req, res) => {
  const recurrente = await recurrenteService.obtener(req.user!.sub, req.params.id as string);
  res.json({ status: 'ok', data: recurrente });
});

export const actualizarRecurrente = asyncHandler(async (req, res) => {
  const recurrente = await recurrenteService.actualizar(
    req.user!.sub,
    req.params.id as string,
    req.body
  );
  res.json({ status: 'ok', data: recurrente });
});

export const activarRecurrente = asyncHandler(async (req, res) => {
  const resultado = await recurrenteService.activar(req.user!.sub, req.params.id as string);
  res.json({ status: 'ok', data: resultado });
});

export const desactivarRecurrente = asyncHandler(async (req, res) => {
  const resultado = await recurrenteService.desactivar(req.user!.sub, req.params.id as string);
  res.json({ status: 'ok', data: resultado });
});

export const eliminarRecurrente = asyncHandler(async (req, res) => {
  await recurrenteService.eliminar(req.user!.sub, req.params.id as string);
  res.json({ status: 'ok', data: null });
});

export const generarPendientes = asyncHandler(async (req, res) => {
  const { colaRecurrentes } = await import('@config/queue');
  const job = await colaRecurrentes.add('generar-recurrentes', { usuarioId: req.user!.sub });
  res.json({ status: 'ok', data: { jobId: job.id, mensaje: 'Job encolado correctamente' } });
});
