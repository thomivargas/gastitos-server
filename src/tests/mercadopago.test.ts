import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from '../modules/mercadopago/mp.crypto'
import { construirState, validarState } from '../modules/mercadopago/mp.service'
import { validarFirmaWebhook } from '../modules/mercadopago/mp.webhook'

const TEST_KEY = 'a'.repeat(64)

describe('mp.crypto', () => {
  it('encripta y desencripta un string correctamente', () => {
    const original = 'APP_USR-abc123-token-secreto'
    const encrypted = encrypt(original, TEST_KEY)
    expect(encrypted).not.toBe(original)
    expect(encrypted).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/)
    expect(decrypt(encrypted, TEST_KEY)).toBe(original)
  })

  it('produce outputs distintos para el mismo input (IV aleatorio)', () => {
    const original = 'mismo-token'
    const enc1 = encrypt(original, TEST_KEY)
    const enc2 = encrypt(original, TEST_KEY)
    expect(enc1).not.toBe(enc2)
    expect(decrypt(enc1, TEST_KEY)).toBe(original)
    expect(decrypt(enc2, TEST_KEY)).toBe(original)
  })

  it('lanza error si el ciphertext está corrupto', () => {
    expect(() => decrypt('invalido:invalido:invalido', TEST_KEY)).toThrow()
  })

  it('lanza error si la clave no tiene 64 caracteres hex', () => {
    expect(() => encrypt('test', 'clave_corta')).toThrow('64 caracteres hex')
    expect(() => decrypt('aa:bb:cc', 'clave_corta')).toThrow('64 caracteres hex')
  })
})

const TEST_STATE_SECRET = 'test_state_secret_min_16_chars!!'

describe('mp.service - state OAuth', () => {
  it('construye un state válido y lo valida correctamente', () => {
    const state = construirState('user-123', 'cuenta-456', TEST_STATE_SECRET)
    expect(state).toMatch(/^[^.]+\.[^.]+$/)

    const payload = validarState(state, TEST_STATE_SECRET)
    expect(payload.usuarioId).toBe('user-123')
    expect(payload.cuentaId).toBe('cuenta-456')
  })

  it('rechaza un state con firma alterada', () => {
    const state = construirState('user-123', 'cuenta-456', TEST_STATE_SECRET)
    const [payloadB64] = state.split('.')
    const tampered = `${payloadB64}.firma_falsa`
    expect(() => validarState(tampered, TEST_STATE_SECRET)).toThrow()
  })

  it('rechaza un state expirado', () => {
    const payload = {
      usuarioId: 'user-123',
      cuentaId: 'cuenta-456',
      nonce: 'test',
      exp: Date.now() - 1000,
    }
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const { createHmac } = require('node:crypto')
    const firma = createHmac('sha256', TEST_STATE_SECRET).update(payloadB64).digest('hex')
    const expiredState = `${payloadB64}.${firma}`
    expect(() => validarState(expiredState, TEST_STATE_SECRET)).toThrow('State expirado')
  })
})

// ─── Helpers HMAC ─────────────────────────────────────────────────────────────

function buildXSignature(dataId: string, xRequestId: string, ts: string, secret: string): string {
  const { createHmac } = require('node:crypto')
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const hash = createHmac('sha256', secret).update(manifest).digest('hex')
  return `ts=${ts},v1=${hash}`
}

describe('validarFirmaWebhook', () => {
  const secret = 'test_webhook_secret_16chars!'

  it('acepta firma HMAC valida', () => {
    const dataId = '12345'
    const xRequestId = 'req-abc'
    const ts = String(Date.now())
    const xSig = buildXSignature(dataId, xRequestId, ts, secret)
    expect(() => validarFirmaWebhook(xSig, xRequestId, dataId, secret)).not.toThrow()
  })

  it('rechaza firma alterada', () => {
    expect(() =>
      validarFirmaWebhook('ts=123,v1=firma_falsa', 'req-abc', '12345', secret)
    ).toThrow()
  })
})
