import { asyncHandler } from '@utils/asyncHandler';
import * as usuarioService from './usuario.service';

export const obtenerPerfil = asyncHandler(async (req, res) => {
  const usuario = await usuarioService.obtenerPerfil(req.user!.sub);
  res.json({ status: 'ok', data: usuario });
});

export const actualizarPerfil = asyncHandler(async (req, res) => {
  const usuario = await usuarioService.actualizarPerfil(req.user!.sub, req.body);
  res.json({ status: 'ok', data: usuario });
});
