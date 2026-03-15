import { asyncHandler } from '@utils/asyncHandler';
import { env } from '@config/env';
import * as authService from './auth.service';

const COOKIE_NAME = 'gastitos_rt';

// Opciones de la cookie del refresh token
function cookieOptions() {
  const isProduction = env.NODE_ENV === 'production';
  return {
    httpOnly: true,                    // JS no puede leerla
    secure: isProduction,              // solo HTTPS en produccion
    sameSite: 'strict' as const,       // no se envia cross-site
    path: '/api/auth',                 // solo se envia a rutas de auth
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 dias en ms
  };
}

function getSesionInfo(req: any) {
  return {
    ip: req.ip ?? req.headers['x-forwarded-for']?.toString(),
    userAgent: req.headers['user-agent'],
  };
}

export const registrar = asyncHandler(async (req, res) => {
  const resultado = await authService.registrar(req.body, getSesionInfo(req));

  res.cookie(COOKIE_NAME, resultado.refreshToken, cookieOptions());

  res.status(201).json({
    status: 'ok',
    data: {
      usuario: resultado.usuario,
      accessToken: resultado.accessToken,
    },
  });
});

export const login = asyncHandler(async (req, res) => {
  const resultado = await authService.login(req.body, getSesionInfo(req));

  res.cookie(COOKIE_NAME, resultado.refreshToken, cookieOptions());

  res.json({
    status: 'ok',
    data: {
      usuario: resultado.usuario,
      accessToken: resultado.accessToken,
    },
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.[COOKIE_NAME];
  if (!refreshToken) {
    res.status(401).json({ status: 'error', message: 'No hay sesion activa' });
    return;
  }

  const resultado = await authService.refresh(refreshToken, getSesionInfo(req));

  res.cookie(COOKIE_NAME, resultado.refreshToken, cookieOptions());

  res.json({
    status: 'ok',
    data: { accessToken: resultado.accessToken, usuario: resultado.usuario },
  });
});

export const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.[COOKIE_NAME];
  if (refreshToken) {
    await authService.logout(refreshToken);
  }

  res.clearCookie(COOKIE_NAME, { path: '/api/auth' });
  res.json({ status: 'ok', message: 'Sesion cerrada' });
});

export const listarSesiones = asyncHandler(async (req, res) => {
  const sesiones = await authService.listarSesiones(req.user!.sub);
  res.json({ status: 'ok', data: sesiones });
});

export const cerrarSesion = asyncHandler(async (req, res) => {
  await authService.cerrarSesion(req.user!.sub, req.params.id as string);
  res.json({ status: 'ok', message: 'Sesion cerrada' });
});

export const cerrarTodasSesiones = asyncHandler(async (req, res) => {
  const resultado = await authService.cerrarTodasSesiones(req.user!.sub);

  res.clearCookie(COOKIE_NAME, { path: '/api/auth' });
  res.json({ status: 'ok', data: resultado });
});

export const cambiarPassword = asyncHandler(async (req, res) => {
  await authService.cambiarPassword(req.user!.sub, req.body);

  res.clearCookie(COOKIE_NAME, { path: '/api/auth' });
  res.json({ status: 'ok', message: 'Contrasena actualizada. Todas las sesiones fueron cerradas.' });
});
