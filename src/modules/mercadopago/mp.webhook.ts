import type { Request, Response } from 'express'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { prisma } from '@config/database'
import { env } from '@config/env'
import { logger } from '@config/logger'
import { Decimal } from '@utils/decimal'
import { refrescarTokenSiNecesario } from './mp.service'
import { webhookBodySchema } from './mp.schema'

// ─── Validación HMAC ──────────────────────────────────────────────────────────

export function validarFirmaWebhook(
  xSignature: string,
  xRequestId: string,
  dataId: string,
  secret: string,
): void {
  const parts = Object.fromEntries(
    xSignature.split(',').map((p) => {
      const [k, v] = p.trim().split('=', 2)
      return [k!, v ?? '']
    }),
  )

  const ts = parts['ts']
  const receivedHash = parts['v1']

  if (!ts || !receivedHash) throw new Error('x-signature malformado')

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const expectedHash = createHmac('sha256', secret).update(manifest).digest('hex')

  const bufReceived = Buffer.from(receivedHash, 'hex')
  const bufExpected = Buffer.from(expectedHash, 'hex')

  if (bufReceived.length !== bufExpected.length || !timingSafeEqual(bufReceived, bufExpected)) {
    throw new Error('Firma HMAC invalida')
  }
}

// ─── Tipos del pago MP ────────────────────────────────────────────────────────

interface MpPago {
  id: number
  status: string
  operation_type: string
  transaction_amount: number
  currency_id: string
  description: string | null
  date_approved: string
  payer: { id: number | null }
  collector: { id: number | null }
}

async function fetchPago(paymentId: string, accessToken: string): Promise<MpPago> {
  const resp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!resp.ok) throw new Error(`MP payments API error: ${resp.status}`)
  return resp.json() as Promise<MpPago>
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  const xSignature = req.headers['x-signature'] as string | undefined
  const xRequestId = req.headers['x-request-id'] as string | undefined

  if (!xSignature || !xRequestId) {
    res.status(400).json({ status: 'error', message: 'Headers de firma faltantes' })
    return
  }

  const body = webhookBodySchema.safeParse(req.body)
  if (!body.success || !body.data.data?.id) {
    res.status(200).json({ status: 'ok' })
    return
  }

  const { data: payload } = body
  const dataId = String(payload.data!.id)

  try {
    validarFirmaWebhook(xSignature, xRequestId, dataId, env.MP_WEBHOOK_SECRET!)
  } catch {
    logger.warn({ xSignature, xRequestId }, 'Webhook MP con firma HMAC invalida')
    res.status(400).json({ status: 'error', message: 'Firma invalida' })
    return
  }

  if (payload.type !== 'payment' || !payload.user_id) {
    res.status(200).json({ status: 'ok' })
    return
  }

  // Responder 200 inmediatamente y procesar en background
  res.status(200).json({ status: 'ok' })

  importarPagoMP(dataId, String(payload.user_id)).catch((err: unknown) => {
    logger.error({ err, paymentId: dataId }, 'Error importando pago de MP')
  })
}

// ─── Importación del pago ─────────────────────────────────────────────────────

async function importarPagoMP(paymentId: string, mpUsuarioId: string): Promise<void> {
  const conexion = await prisma.conexionMercadoPago.findFirst({
    where: { mpUsuarioId },
  })
  if (!conexion || conexion.revocada) return

  const existe = await prisma.transaccion.findUnique({
    where: { mpPaymentId: paymentId },
    select: { id: true },
  })
  if (existe) return

  const accessToken = await refrescarTokenSiNecesario(conexion.id)
  const pago = await fetchPago(paymentId, accessToken)

  if (pago.status !== 'approved') return

  const OPERATION_TYPES_ACEPTADOS = new Set([
    'regular_payment',
    'money_transfer',
    'pos_payment',
  ])
  if (!OPERATION_TYPES_ACEPTADOS.has(pago.operation_type)) return

  if (pago.payer?.id == null || pago.collector?.id == null) {
    logger.warn({ paymentId, pago }, 'Pago MP sin payer.id o collector.id')
    return
  }

  const esPago = String(pago.payer.id) === mpUsuarioId
  const esIngreso = String(pago.collector.id) === mpUsuarioId

  if (!esPago && !esIngreso) {
    logger.warn({ paymentId, mpUsuarioId }, 'Pago MP no pertenece al usuario')
    return
  }

  const tipo = esPago ? 'GASTO' : 'INGRESO'
  const descripcion = pago.description?.trim() || 'Pago Mercado Pago'
  const monto = new Decimal(pago.transaction_amount)

  // Categorización automática
  let categoriaId: string | null = null
  try {
    const { sugerirCategoria } = await import('../regla/regla.service')
    const sugerencia = await sugerirCategoria(conexion.usuarioId, descripcion)
    if (sugerencia) categoriaId = sugerencia.id
  } catch {
    // Si falla, crear sin categoria
  }

  const delta = tipo === 'INGRESO' ? monto : monto.negated()
  const fecha = new Date(pago.date_approved)

  await prisma.$transaction(async (tx) => {
    await tx.transaccion.create({
      data: {
        usuarioId: conexion.usuarioId,
        cuentaId: conexion.cuentaId,
        tipo,
        monto,
        moneda: pago.currency_id,
        fecha,
        descripcion,
        categoriaId,
        mpPaymentId: paymentId,
      },
    })

    await tx.cuenta.update({
      where: { id: conexion.cuentaId },
      data: { balance: { increment: delta } },
    })
  })

  logger.info(
    { paymentId, tipo, monto: pago.transaction_amount, usuarioId: conexion.usuarioId },
    'Transaccion MP importada',
  )
}
