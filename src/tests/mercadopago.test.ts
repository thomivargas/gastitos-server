import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from '../modules/mercadopago/mp.crypto'

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
})
