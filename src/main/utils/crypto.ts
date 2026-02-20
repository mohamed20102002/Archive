import * as crypto from 'crypto'
import * as argon2 from 'argon2'
import { v4 as uuidv4 } from 'uuid'

// Argon2 configuration for password hashing
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,  // 64 MB
  timeCost: 3,        // 3 iterations
  parallelism: 4      // 4 parallel threads
}

/**
 * Hash a password using Argon2id
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS)
}

/**
 * Verify a password against an Argon2 hash
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password)
  } catch {
    return false
  }
}

/**
 * Generate a UUID v4
 */
export function generateId(): string {
  return uuidv4()
}

/**
 * Compute SHA-256 hash of data
 */
export function sha256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * Compute SHA-256 hash of a file
 */
export async function sha256File(filePath: string): Promise<string> {
  const fs = await import('fs')

  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)

    stream.on('data', (data) => hash.update(data))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

/**
 * Generate a cryptographically secure random string
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

/**
 * Generate a short random ID (for display purposes)
 */
export function generateShortId(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.randomBytes(length)
  let result = ''

  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length]
  }

  return result
}

/**
 * Encrypt data using AES-256-GCM
 */
export function encrypt(data: string, key: Buffer): { encrypted: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

  let encrypted = cipher.update(data, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const tag = cipher.getAuthTag()

  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex')
  }
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decrypt(encrypted: string, key: Buffer, iv: string, tag: string): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'hex')
  )

  decipher.setAuthTag(Buffer.from(tag, 'hex'))

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Derive a key from a password using PBKDF2
 */
export function deriveKey(password: string, salt: Buffer, iterations: number = 100000): Buffer {
  return crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256')
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

// ===== Field-Level Encryption =====

// Master key cache (derived from master password)
let masterKey: Buffer | null = null
let masterKeySalt: Buffer | null = null

/**
 * Initialize field encryption with a master password
 * This should be called once at application startup
 */
export function initializeFieldEncryption(masterPassword: string, existingSalt?: string): { salt: string } {
  // Use existing salt or generate new one
  masterKeySalt = existingSalt
    ? Buffer.from(existingSalt, 'hex')
    : crypto.randomBytes(32)

  // Derive master key from password
  masterKey = deriveKey(masterPassword, masterKeySalt)

  return { salt: masterKeySalt.toString('hex') }
}

/**
 * Check if field encryption is initialized
 */
export function isFieldEncryptionInitialized(): boolean {
  return masterKey !== null
}

/**
 * Clear the master key from memory
 */
export function clearFieldEncryptionKey(): void {
  if (masterKey) {
    masterKey.fill(0)
    masterKey = null
  }
  masterKeySalt = null
}

/**
 * Encrypted field format: version:iv:tag:encrypted
 * Version 1 = AES-256-GCM
 */
const ENCRYPTED_FIELD_VERSION = '1'

/**
 * Encrypt a field value for storage in the database
 * Returns a formatted string that can be stored directly
 */
export function encryptField(value: string): string {
  if (!masterKey) {
    throw new Error('Field encryption not initialized')
  }

  if (!value || value.length === 0) {
    return ''
  }

  const { encrypted, iv, tag } = encrypt(value, masterKey)

  // Format: version:iv:tag:encrypted
  return `${ENCRYPTED_FIELD_VERSION}:${iv}:${tag}:${encrypted}`
}

/**
 * Decrypt a field value from the database
 * Returns the decrypted string
 */
export function decryptField(encryptedValue: string): string {
  if (!masterKey) {
    throw new Error('Field encryption not initialized')
  }

  if (!encryptedValue || encryptedValue.length === 0) {
    return ''
  }

  // Parse format: version:iv:tag:encrypted
  const parts = encryptedValue.split(':')

  if (parts.length !== 4) {
    // Not encrypted or invalid format, return as-is
    // This allows gradual migration of existing data
    return encryptedValue
  }

  const [version, iv, tag, encrypted] = parts

  if (version !== ENCRYPTED_FIELD_VERSION) {
    throw new Error(`Unsupported encryption version: ${version}`)
  }

  return decrypt(encrypted, masterKey, iv, tag)
}

/**
 * Check if a value appears to be encrypted
 */
export function isEncryptedField(value: string): boolean {
  if (!value) return false

  const parts = value.split(':')
  return parts.length === 4 && parts[0] === ENCRYPTED_FIELD_VERSION
}

/**
 * Encrypt multiple fields in an object
 * Returns a new object with specified fields encrypted
 */
export function encryptFields<T extends Record<string, unknown>>(
  obj: T,
  fieldNames: (keyof T)[]
): T {
  const result = { ...obj }

  for (const field of fieldNames) {
    const value = obj[field]
    if (typeof value === 'string' && value.length > 0) {
      (result as Record<string, unknown>)[field as string] = encryptField(value)
    }
  }

  return result
}

/**
 * Decrypt multiple fields in an object
 * Returns a new object with specified fields decrypted
 */
export function decryptFields<T extends Record<string, unknown>>(
  obj: T,
  fieldNames: (keyof T)[]
): T {
  const result = { ...obj }

  for (const field of fieldNames) {
    const value = obj[field]
    if (typeof value === 'string' && value.length > 0) {
      try {
        (result as Record<string, unknown>)[field as string] = decryptField(value)
      } catch (e) {
        // If decryption fails, keep original value
        console.warn(`Failed to decrypt field ${String(field)}:`, e)
      }
    }
  }

  return result
}

/**
 * Generate a new encryption key from a password
 * Used for changing the master password
 */
export function generateNewMasterKey(newPassword: string): { key: Buffer; salt: string } {
  const salt = crypto.randomBytes(32)
  const key = deriveKey(newPassword, salt)
  return { key, salt: salt.toString('hex') }
}

/**
 * Re-encrypt all fields with a new key
 * Used when changing the master password
 */
export function reEncryptValue(value: string, oldKey: Buffer, newKey: Buffer): string {
  if (!value || value.length === 0) {
    return ''
  }

  // Parse and decrypt with old key
  const parts = value.split(':')
  if (parts.length !== 4) {
    // Not encrypted, encrypt with new key
    const { encrypted, iv, tag } = encrypt(value, newKey)
    return `${ENCRYPTED_FIELD_VERSION}:${iv}:${tag}:${encrypted}`
  }

  const [version, iv, tag, encrypted] = parts

  if (version !== ENCRYPTED_FIELD_VERSION) {
    throw new Error(`Unsupported encryption version: ${version}`)
  }

  // Decrypt with old key
  const decrypted = decrypt(encrypted, oldKey, iv, tag)

  // Re-encrypt with new key
  const newEncryption = encrypt(decrypted, newKey)
  return `${ENCRYPTED_FIELD_VERSION}:${newEncryption.iv}:${newEncryption.tag}:${newEncryption.encrypted}`
}
