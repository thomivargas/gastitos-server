import { asyncHandler } from '@utils/asyncHandler';
import { env } from '@config/env';
import * as authService from './auth.service';

const COOKIE_NAME = 'gastitos_rt';

// Opciones de la cookie del refresh token
function cookieOptions() {
  const isProduction = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' as const : 'strict' as const,
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
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

export const googleAuth = asyncHandler(async (_req, res) => {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_CALLBACK_URL,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

export const googleCallback = asyncHandler(async (req, res) => {
  const { code } = req.query as { code?: string };
  const errorRedirect = `${env.CORS_ORIGIN}/login?error=${encodeURIComponent('Error al iniciar sesion con Google')}`;

  if (!code) {
    res.redirect(errorRedirect);
    return;
  }

  try {
    // Intercambiar code por access token de Google
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_CALLBACK_URL,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };

    if (!tokenData.access_token) {
      res.redirect(errorRedirect);
      return;
    }

    // Obtener info del usuario de Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const googleUser = await userRes.json() as {
      id: string;
      email: string;
      name: string;
      verified_email: boolean;
    };

    if (!googleUser.email || !googleUser.verified_email) {
      res.redirect(errorRedirect);
      return;
    }

    const resultado = await authService.loginConGoogle(googleUser, getSesionInfo(req));

    res.cookie(COOKIE_NAME, resultado.refreshToken, cookieOptions());

    // Pasar datos al frontend en la URL para que la pestaña los lea y cierre
    const u = Buffer.from(JSON.stringify(resultado.usuario)).toString('base64');
    res.redirect(`${env.CORS_ORIGIN}/auth/google/exito?token=${resultado.accessToken}&u=${encodeURIComponent(u)}`);
  } catch {
    res.redirect(errorRedirect);
  }
});
