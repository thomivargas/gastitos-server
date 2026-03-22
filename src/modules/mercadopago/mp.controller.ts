import type { Request, Response } from 'express'
import { prisma } from '@config/database'
import { env } from '@config/env'
import { asyncHandler } from '@utils/asyncHandler'
import {
  construirState,
  validarState,
  intercambiarCodigo,
  guardarConexion,
  sincronizarPagosMP,
} from './mp.service'
import { conectarQuerySchema, callbackQuerySchema } from './mp.schema'

const CLIENT_URL = (env.CORS_ORIGIN ?? 'http://localhost:5173').split(',')[0]!.trim()

/**
 * GET /api/mercadopago/conectar?cuentaId=UUID
 */
export const iniciarConexion = asyncHandler(async (req: Request, res: Response) => {
  const { cuentaId } = conectarQuerySchema.parse(req.query)
  const usuarioId = req.user!.sub

  const cuenta = await prisma.cuenta.findFirst({
    where: { id: cuentaId, usuarioId },
    select: { id: true },
  })
  if (!cuenta) {
    res.status(404).json({ status: 'error', message: 'Cuenta no encontrada' })
    return
  }

  const state = construirState(usuarioId, cuentaId, env.MP_STATE_SECRET!)

  const url = new URL('https://auth.mercadopago.com/authorization')
  url.searchParams.set('client_id', env.MP_CLIENT_ID!)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('platform_id', 'mp')
  url.searchParams.set('redirect_uri', env.MP_REDIRECT_URI!)
  url.searchParams.set('state', state)

  res.json({ status: 'ok', data: { url: url.toString() } })
})

/**
 * GET /api/mercadopago/callback?code=...&state=...
 */
export const callback = asyncHandler(async (req: Request, res: Response) => {
  const redirectBase = `${CLIENT_URL}/mp/callback`

  try {
    const { code, state } = callbackQuerySchema.parse(req.query)
    const { usuarioId, cuentaId } = validarState(state, env.MP_STATE_SECRET!)

    const tokens = await intercambiarCodigo(code)
    await guardarConexion(usuarioId, cuentaId, tokens)

    res.redirect(`${redirectBase}?status=ok`)
  } catch {
    res.redirect(`${redirectBase}?status=error`)
  }
})

/**
 * GET /api/mercadopago/estado
 */
export const obtenerEstado = asyncHandler(async (req: Request, res: Response) => {
  const conexion = await prisma.conexionMercadoPago.findUnique({
    where: { usuarioId: req.user!.sub },
    select: { cuentaId: true, revocada: true },
  })

  if (!conexion) {
    res.json({ status: 'ok', data: { conectado: false } })
    return
  }

  res.json({
    status: 'ok',
    data: {
      conectado: !conexion.revocada,
      cuentaId: conexion.cuentaId,
    },
  })
})

/**
 * DELETE /api/mercadopago/desconectar
 */
export const desconectar = asyncHandler(async (req: Request, res: Response) => {
  await prisma.conexionMercadoPago.deleteMany({
    where: { usuarioId: req.user!.sub },
  })
  res.json({ status: 'ok', data: null })
})

/**
 * POST /api/mercadopago/sincronizar
 * Sincroniza manualmente los pagos de MP para el usuario autenticado.
 */
export const sincronizar = asyncHandler(async (req: Request, res: Response) => {
  const importados = await sincronizarPagosMP(req.user!.sub)
  res.json({ status: 'ok', data: { importados } })
})
