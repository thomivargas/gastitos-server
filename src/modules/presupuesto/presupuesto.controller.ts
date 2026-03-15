import { asyncHandler } from '@utils/asyncHandler';
import { typedQuery } from '@middlewares/validate.middleware';
import { paramId } from '@utils/params';
import * as presupuestoService from './presupuesto.service';
import type { ListaPresupuestoQuery } from './presupuesto.schema';

export const crearPresupuesto = asyncHandler(async (req, res) => {
  const presupuesto = await presupuestoService.crear(req.user!.sub, req.body);
  res.status(201).json({ status: 'ok', data: presupuesto });
});

export const listarPresupuestos = asyncHandler(async (req, res) => {
  const resultado = await presupuestoService.listar(req.user!.sub, typedQuery<ListaPresupuestoQuery>(req));
  res.json({ status: 'ok', ...resultado });
});

export const obtenerPresupuestoActual = asyncHandler(async (req, res) => {
  const presupuesto = await presupuestoService.obtenerActual(req.user!.sub);
  res.json({ status: 'ok', data: presupuesto });
});

export const obtenerPresupuesto = asyncHandler(async (req, res) => {
  const presupuesto = await presupuestoService.obtener(req.user!.sub, paramId(req));
  res.json({ status: 'ok', data: presupuesto });
});

export const obtenerProgreso = asyncHandler(async (req, res) => {
  const progreso = await presupuestoService.obtenerProgreso(req.user!.sub, paramId(req));
  res.json({ status: 'ok', data: progreso });
});

export const actualizarPresupuesto = asyncHandler(async (req, res) => {
  const presupuesto = await presupuestoService.actualizar(
    req.user!.sub,
    paramId(req),
    req.body
  );
  res.json({ status: 'ok', data: presupuesto });
});

export const asignarCategoria = asyncHandler(async (req, res) => {
  const asignacion = await presupuestoService.asignarCategoria(
    req.user!.sub,
    paramId(req),
    req.body
  );
  res.status(201).json({ status: 'ok', data: asignacion });
});

export const eliminarCategoria = asyncHandler(async (req, res) => {
  await presupuestoService.eliminarCategoria(
    req.user!.sub,
    paramId(req),
    req.params.categoriaId as string
  );
  res.json({ status: 'ok', data: null });
});

export const copiarPresupuesto = asyncHandler(async (req, res) => {
  const presupuesto = await presupuestoService.copiarPresupuesto(
    req.user!.sub,
    paramId(req),
    req.body
  );
  res.status(201).json({ status: 'ok', data: presupuesto });
});

export const eliminarPresupuesto = asyncHandler(async (req, res) => {
  await presupuestoService.eliminar(req.user!.sub, paramId(req));
  res.json({ status: 'ok', data: null });
});
