import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto'
import { prisma } from '@config/database'
import { env } from '@config/env'
import { encrypt, decrypt } from './mp.crypto'

// ─── State OAuth ─────────────────────────────────────────────────────────────

interface StatePayload {
  usuarioId: string
  cuentaId: string
  nonce: string
  exp: number // timestamp en ms
}

/**
 * Construye un state HMAC-firmado para el OAuth flow.
 * Formato: `base64url(payload).hmac_sha256(payload, secret)`
 */
export function construirState(usuarioId: string, cuentaId: string, secret: string): string {
  const payload: StatePayload = {
    usuarioId,
    cuentaId,
    nonce: randomUUID(),
    exp: Date.now() + 10 * 60 * 1000, // 10 minutos
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const firma = createHmac('sha256', secret).update(payloadB64).digest('hex')
  return `${payloadB64}.${firma}`
}

/**
 * Valida un state OAuth. Lanza si es inválido, alterado o expirado.
 * @returns El payload extraído si es válido.
 */
export function validarState(state: string, secret: string): StatePayload {
  const dotIndex = state.lastIndexOf('.')
  if (dotIndex === -1) throw new Error('State malformado')

  const payloadB64 = state.slice(0, dotIndex)
  const firmaRecibida = state.slice(dotIndex + 1)

  const firmaEsperada = createHmac('sha256', secret).update(payloadB64).digest('hex')

  const bufRecibida = Buffer.from(firmaRecibida, 'hex')
  const bufEsperada = Buffer.from(firmaEsperada, 'hex')
  if (bufRecibida.length !== bufEsperada.length || !timingSafeEqual(bufRecibida, bufEsperada)) {
    throw new Error('Firma del state inválida')
  }

  const payload: StatePayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
  if (Date.now() > payload.exp) throw new Error('State expirado')

  return payload
}

// ─── OAuth Token Exchange ─────────────────────────────────────────────────────

interface MpTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  user_id: number
  token_type: string
}

/**
 * Intercambia el authorization code por access_token y refresh_token.
 */
export async function intercambiarCodigo(code: string): Promise<MpTokenResponse> {
  const resp = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.MP_CLIENT_ID,
      client_secret: env.MP_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.MP_REDIRECT_URI,
    }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`MP OAuth error: ${resp.status} - ${err}`)
  }

  return resp.json() as Promise<MpTokenResponse>
}

// ─── Token Refresh ────────────────────────────────────────────────────────────

/**
 * Refresca el access_token de un usuario usando el refresh_token.
 * Si el refresh falla, marca la conexión como revocada.
 */
export async function refrescarTokenSiNecesario(conexionId: string): Promise<string> {
  const conexion = await prisma.conexionMercadoPago.findUniqueOrThrow({
    where: { id: conexionId },
  })

  const expiraProximo = conexion.expiresAt.getTime() < Date.now() + 5 * 60 * 1000

  if (!expiraProximo) {
    return decrypt(conexion.accessToken, env.ENCRYPTION_KEY!)
  }

  try {
    const resp = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.MP_CLIENT_ID,
        client_secret: env.MP_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: decrypt(conexion.refreshToken, env.ENCRYPTION_KEY!),
      }),
    })

    if (!resp.ok) throw new Error(`Refresh failed: ${resp.status}`)

    const data = await resp.json() as MpTokenResponse
    const expiresAt = new Date(Date.now() + data.expires_in * 1000)

    await prisma.conexionMercadoPago.update({
      where: { id: conexionId },
      data: {
        accessToken: encrypt(data.access_token, env.ENCRYPTION_KEY!),
        refreshToken: encrypt(data.refresh_token, env.ENCRYPTION_KEY!),
        expiresAt,
        revocada: false,
      },
    })

    return data.access_token
  } catch (error) {
    await prisma.conexionMercadoPago.update({
      where: { id: conexionId },
      data: { revocada: true },
    })
    throw error
  }
}

// ─── Guardar conexión ─────────────────────────────────────────────────────────

export async function guardarConexion(
  usuarioId: string,
  cuentaId: string,
  tokens: MpTokenResponse,
) {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

  await prisma.conexionMercadoPago.upsert({
    where: { usuarioId },
    create: {
      usuarioId,
      cuentaId,
      mpUsuarioId: String(tokens.user_id),
      accessToken: encrypt(tokens.access_token, env.ENCRYPTION_KEY!),
      refreshToken: encrypt(tokens.refresh_token, env.ENCRYPTION_KEY!),
      expiresAt,
    },
    update: {
      cuentaId,
      mpUsuarioId: String(tokens.user_id),
      accessToken: encrypt(tokens.access_token, env.ENCRYPTION_KEY!),
      refreshToken: encrypt(tokens.refresh_token, env.ENCRYPTION_KEY!),
      expiresAt,
      revocada: false,
    },
  })
}
