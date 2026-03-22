import { prisma, type DbClient } from '@config/database';
import { env } from '@config/env';
import { hashPassword, comparePassword, hashToken } from '@utils/hash';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
  JwtPayload,
} from '@utils/jwt';
import { ConflictError, UnauthorizedError, BadRequestError } from '@middlewares/errors';
import { crearCategoriasDefault } from '@modules/categoria/categoria.service';
import type { RegistroInput, LoginInput, CambiarPasswordInput } from './auth.schema';

function buildPayload(usuario: { id: string; email: string; rol?: string }): JwtPayload {
  return { sub: usuario.id, email: usuario.email, role: usuario.rol ?? 'USUARIO' };
}

interface SesionInfo {
  ip?: string;
  userAgent?: string;
}

/**
 * Crea una sesion en DB y devuelve el refresh token crudo (para la cookie)
 * y el access token (para el body).
 * Acepta un cliente de transaccion para ejecutar dentro de $transaction.
 */
async function crearSesion(payload: JwtPayload, info: SesionInfo, db: DbClient = prisma) {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  const tokenHash = hashToken(refreshToken);

  // Limpiar sesiones expiradas del usuario
  await db.sesion.deleteMany({
    where: { usuarioId: payload.sub, expiraEl: { lt: new Date() } },
  });

  // Limitar sesiones activas: si excede el maximo, eliminar la mas vieja
  const sesionesActivas = await db.sesion.count({
    where: { usuarioId: payload.sub },
  });

  if (sesionesActivas >= env.MAX_SESIONES) {
    const masVieja = await db.sesion.findFirst({
      where: { usuarioId: payload.sub },
      orderBy: { creadoEl: 'asc' },
      select: { id: true },
    });
    if (masVieja) {
      await db.sesion.delete({ where: { id: masVieja.id } });
    }
  }

  // Crear nueva sesion
  await db.sesion.create({
    data: {
      usuarioId: payload.sub,
      tokenHash,
      ipAddress: info.ip ?? null,
      userAgent: info.userAgent?.substring(0, 500) ?? null,
      expiraEl: getRefreshTokenExpiry(),
    },
  });

  return { accessToken, refreshToken };
}

export async function registrar(data: RegistroInput, info: SesionInfo) {
  const existe = await prisma.usuario.findUnique({ where: { email: data.email } });
  if (existe) throw new ConflictError('El email ya esta registrado');

  const passwordHash = await hashPassword(data.password);

  // Todo atomico: crear usuario + categorias default + sesion
  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: {
        email: data.email,
        nombre: data.nombre,
        passwordHash,
      },
      select: { id: true, email: true, nombre: true, moneda: true, rol: true, creadoEl: true },
    });

    await crearCategoriasDefault(usuario.id, tx);

    const payload = buildPayload(usuario);
    const tokens = await crearSesion(payload, info, tx);

    return { usuario, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  });
}

export async function login(data: LoginInput, info: SesionInfo) {
  const usuario = await prisma.usuario.findUnique({
    where: { email: data.email },
    select: { id: true, email: true, nombre: true, moneda: true, rol: true, passwordHash: true, creadoEl: true },
  });

  if (!usuario) throw new UnauthorizedError('Credenciales invalidas');

  if (!usuario.passwordHash) throw new UnauthorizedError('Esta cuenta usa Google para iniciar sesion');

  const passwordValida = await comparePassword(data.password, usuario.passwordHash);
  if (!passwordValida) throw new UnauthorizedError('Credenciales invalidas');

  const { passwordHash: _, ...usuarioSinPassword } = usuario;
  const payload = buildPayload(usuario);
  const tokens = await crearSesion(payload, info);

  return { usuario: usuarioSinPassword, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
}

export async function refresh(refreshToken: string, info: SesionInfo) {
  // Verificar firma JWT (fuera de la transaccion, es CPU-only)
  let payload: JwtPayload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError('Refresh token invalido o expirado');
  }

  const tokenHash = hashToken(refreshToken);

  // Transaccion serializable para evitar race condition en token rotation
  return prisma.$transaction(async (tx) => {
    // Buscar sesion en DB
    const sesion = await tx.sesion.findUnique({
      where: { tokenHash },
    });

    if (!sesion) {
      throw new UnauthorizedError('Sesion no encontrada');
    }

    // Verificar expiracion
    if (sesion.expiraEl < new Date()) {
      await tx.sesion.delete({ where: { id: sesion.id } });
      throw new UnauthorizedError('Sesion expirada');
    }

    // DETECCION DE REUSO: si el token ya fue rotado, alguien lo robo
    // Revocar TODAS las sesiones del usuario como medida de seguridad
    if (sesion.usado) {
      await tx.sesion.deleteMany({ where: { usuarioId: sesion.usuarioId } });
      throw new UnauthorizedError('Token reutilizado. Todas las sesiones fueron revocadas por seguridad.');
    }

    // Marcar como usado (rotado)
    await tx.sesion.update({
      where: { id: sesion.id },
      data: { usado: true },
    });

    // Verificar que el usuario sigue existiendo
    const usuario = await tx.usuario.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, nombre: true, moneda: true, rol: true, creadoEl: true },
    });

    if (!usuario) {
      throw new UnauthorizedError('Usuario no encontrado');
    }

    // Crear nueva sesion y eliminar la vieja, todo dentro de la transaccion
    const nuevoPayload = buildPayload(usuario);
    const tokens = await crearSesion(nuevoPayload, info, tx);
    await tx.sesion.delete({ where: { id: sesion.id } }).catch(() => {});

    return { usuario, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }, { isolationLevel: 'Serializable' });
}

export async function logout(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);

  // Eliminar sesion si existe (no lanzar error si no existe)
  await prisma.sesion.deleteMany({ where: { tokenHash } });
}

export async function listarSesiones(usuarioId: string) {
  return prisma.sesion.findMany({
    where: { usuarioId, expiraEl: { gt: new Date() }, usado: false },
    select: {
      id: true,
      ipAddress: true,
      userAgent: true,
      creadoEl: true,
      expiraEl: true,
    },
    orderBy: { creadoEl: 'desc' },
  });
}

export async function cerrarSesion(usuarioId: string, sesionId: string) {
  const sesion = await prisma.sesion.findFirst({
    where: { id: sesionId, usuarioId },
  });
  if (!sesion) throw new UnauthorizedError('Sesion no encontrada');

  await prisma.sesion.delete({ where: { id: sesionId } });
}

export async function cerrarTodasSesiones(usuarioId: string) {
  const resultado = await prisma.sesion.deleteMany({ where: { usuarioId } });
  return { sesionesRevocadas: resultado.count };
}

interface GoogleUserInfo {
  id: string
  email: string
  name: string
  verified_email: boolean
}

export async function loginConGoogle(googleUser: GoogleUserInfo, info: SesionInfo) {
  // Buscar por googleId primero, luego por email
  let usuario = await prisma.usuario.findUnique({
    where: { googleId: googleUser.id },
    select: { id: true, email: true, nombre: true, moneda: true, rol: true, creadoEl: true },
  });

  if (!usuario) {
    // Buscar por email — puede ser cuenta existente con password
    const porEmail = await prisma.usuario.findUnique({
      where: { email: googleUser.email },
      select: { id: true, email: true, nombre: true, moneda: true, rol: true, creadoEl: true },
    });

    if (porEmail) {
      // Vincular cuenta existente con Google
      usuario = await prisma.usuario.update({
        where: { id: porEmail.id },
        data: { googleId: googleUser.id },
        select: { id: true, email: true, nombre: true, moneda: true, rol: true, creadoEl: true },
      });
    } else {
      // Crear nuevo usuario via Google
      usuario = await prisma.$transaction(async (tx) => {
        const nuevo = await tx.usuario.create({
          data: {
            email: googleUser.email,
            nombre: googleUser.name,
            googleId: googleUser.id,
          },
          select: { id: true, email: true, nombre: true, moneda: true, rol: true, creadoEl: true },
        });
        await crearCategoriasDefault(nuevo.id, tx);
        return nuevo;
      });
    }
  }

  const payload = buildPayload(usuario);
  const tokens = await crearSesion(payload, info);

  return { usuario, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
}

export async function cambiarPassword(userId: string, data: CambiarPasswordInput) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!usuario) throw new UnauthorizedError('Usuario no encontrado');
  if (!usuario.passwordHash) throw new BadRequestError('El usuario no tiene password configurada');

  const passwordValida = await comparePassword(data.passwordActual, usuario.passwordHash);
  if (!passwordValida) throw new BadRequestError('La contrasena actual es incorrecta');

  const nuevoHash = await hashPassword(data.passwordNueva);

  // Actualizar password y revocar todas las sesiones (forzar re-login)
  await prisma.$transaction([
    prisma.usuario.update({
      where: { id: userId },
      data: { passwordHash: nuevoHash },
    }),
    prisma.sesion.deleteMany({ where: { usuarioId: userId } }),
  ]);
}
