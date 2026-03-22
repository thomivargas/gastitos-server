import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12   // 96 bits — recomendado para GCM
const TAG_LENGTH = 16  // 128 bits

/**
 * Encripta un string con AES-256-GCM.
 * @param plaintext - String a encriptar
 * @param keyHex - Clave de 64 caracteres hex (32 bytes)
 * @returns `iv_hex:authTag_hex:ciphertext_hex`
 */
export function encrypt(plaintext: string, keyHex: string): string {
  if (keyHex.length !== 64) throw new Error('Clave debe tener exactamente 64 caracteres hex (32 bytes)')
  const key = Buffer.from(keyHex, 'hex')
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])

  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Desencripta un string encriptado con `encrypt()`.
 * @param encryptedStr - `iv_hex:authTag_hex:ciphertext_hex`
 * @param keyHex - Clave de 64 caracteres hex (32 bytes)
 */
export function decrypt(encryptedStr: string, keyHex: string): string {
  if (keyHex.length !== 64) throw new Error('Clave debe tener exactamente 64 caracteres hex (32 bytes)')
  const parts = encryptedStr.split(':')
  if (parts.length !== 3) throw new Error('Formato de token encriptado inválido')

  const [ivHex, tagHex, ciphertextHex] = parts
  if (!ivHex || !tagHex || !ciphertextHex) throw new Error('Formato de token encriptado inválido')
  const key = Buffer.from(keyHex, 'hex')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
