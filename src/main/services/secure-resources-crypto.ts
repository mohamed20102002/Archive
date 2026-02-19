import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { app } from 'electron'
import { encrypt, decrypt, deriveKey } from '../utils/crypto'

const APPLICATION_PEPPER = 'ArchiveSystem_SecureResources_v1'
const KEYFILE_NAME = '.keyfile'

function getBasePath(): string {
  return app.isPackaged
    ? path.dirname(app.getPath('exe'))
    : process.cwd()
}

function getSecureResourcesDir(): string {
  return path.join(getBasePath(), 'data', 'secure-resources')
}

function getKeyfilePath(): string {
  return path.join(getSecureResourcesDir(), KEYFILE_NAME)
}

function ensureSecureResourcesDir(): void {
  const dir = getSecureResourcesDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function getOrCreateSalt(): Buffer {
  ensureSecureResourcesDir()
  const keyfilePath = getKeyfilePath()

  if (fs.existsSync(keyfilePath)) {
    return fs.readFileSync(keyfilePath)
  }

  // Generate a random 32-byte salt
  const salt = crypto.randomBytes(32)
  fs.writeFileSync(keyfilePath, salt)
  return salt
}

function getEncryptionKey(): Buffer {
  const salt = getOrCreateSalt()
  return deriveKey(APPLICATION_PEPPER, salt, 100000)
}

export function encryptPassword(plaintext: string): { encrypted: string; iv: string; tag: string } {
  const key = getEncryptionKey()
  return encrypt(plaintext, key)
}

export function decryptPassword(encrypted: string, iv: string, tag: string): string {
  // Validate inputs - AES-256-GCM requires 12-byte IV (24 hex chars) and 16-byte tag (32 hex chars)
  if (!encrypted || typeof encrypted !== 'string') {
    throw new Error('Invalid encrypted data: missing or not a string')
  }
  if (!iv || typeof iv !== 'string' || iv.length !== 24) {
    throw new Error(`Invalid IV: expected 24 hex characters, got ${iv ? iv.length : 0}`)
  }
  if (!tag || typeof tag !== 'string' || tag.length !== 32) {
    throw new Error(`Invalid auth tag: expected 32 hex characters, got ${tag ? tag.length : 0}`)
  }

  const key = getEncryptionKey()
  return decrypt(encrypted, key, iv, tag)
}

export function getReferencesStorageDir(): string {
  const dir = path.join(getSecureResourcesDir(), 'references')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

// File encryption for admin-only secure references
// Uses AES-256-GCM like password encryption but operates on file buffers

export function encryptFile(fileBuffer: Buffer): { encryptedBuffer: Buffer; iv: string; tag: string } {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(12)

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(fileBuffer), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    encryptedBuffer: encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex')
  }
}

export function decryptFile(encryptedBuffer: Buffer, iv: string, tag: string): Buffer {
  const key = getEncryptionKey()
  const ivBuffer = Buffer.from(iv, 'hex')
  const tagBuffer = Buffer.from(tag, 'hex')

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuffer)
  decipher.setAuthTag(tagBuffer)

  return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()])
}

export function getTempDir(): string {
  const tempDir = path.join(getSecureResourcesDir(), '.temp')
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  return tempDir
}

export function cleanupTempFile(tempPath: string): void {
  try {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath)
    }
  } catch (err) {
    console.error('Failed to cleanup temp file:', err)
  }
}

// Clear all files in the temp folder (for startup/shutdown cleanup)
export function clearTempFolder(): void {
  try {
    const tempDir = path.join(getSecureResourcesDir(), '.temp')
    if (!fs.existsSync(tempDir)) return

    const files = fs.readdirSync(tempDir)
    let clearedCount = 0

    for (const file of files) {
      const filePath = path.join(tempDir, file)
      try {
        const stat = fs.statSync(filePath)
        if (stat.isFile()) {
          fs.unlinkSync(filePath)
          clearedCount++
        }
      } catch (err) {
        console.error(`Failed to delete temp file ${file}:`, err)
      }
    }

    if (clearedCount > 0) {
      console.log(`[SecureResources] Cleared ${clearedCount} temp file(s)`)
    }
  } catch (err) {
    console.error('Failed to clear temp folder:', err)
  }
}

// Decrypt file to temp location and return path for opening
export function decryptFileToTemp(encryptedFilePath: string, originalFilename: string, iv: string, tag: string): string {
  const encryptedBuffer = fs.readFileSync(encryptedFilePath)
  const decryptedBuffer = decryptFile(encryptedBuffer, iv, tag)

  const tempDir = getTempDir()
  const tempFilename = `${Date.now()}_${originalFilename}`
  const tempPath = path.join(tempDir, tempFilename)

  fs.writeFileSync(tempPath, decryptedBuffer)

  // Schedule cleanup after 5 minutes
  setTimeout(() => cleanupTempFile(tempPath), 5 * 60 * 1000)

  return tempPath
}

// Check if keyfile exists
export function keyfileExists(): boolean {
  return fs.existsSync(getKeyfilePath())
}

// Export/backup keyfile to a specified path
export function exportKeyfile(destinationPath: string): { success: boolean; error?: string } {
  try {
    const keyfilePath = getKeyfilePath()

    if (!fs.existsSync(keyfilePath)) {
      return { success: false, error: 'Keyfile does not exist. No secure resources have been created yet.' }
    }

    // Copy keyfile to destination
    fs.copyFileSync(keyfilePath, destinationPath)

    return { success: true }
  } catch (err: any) {
    console.error('Failed to export keyfile:', err)
    return { success: false, error: err.message }
  }
}

// Import/restore keyfile from a specified path (dangerous - can break existing encrypted data!)
export function importKeyfile(sourcePath: string): { success: boolean; error?: string } {
  try {
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: 'Source keyfile does not exist' }
    }

    // Validate keyfile format (should be exactly 32 bytes)
    const keyfileData = fs.readFileSync(sourcePath)
    if (keyfileData.length !== 32) {
      return { success: false, error: 'Invalid keyfile format. Expected 32 bytes.' }
    }

    ensureSecureResourcesDir()
    const keyfilePath = getKeyfilePath()

    // Backup existing keyfile if it exists
    if (fs.existsSync(keyfilePath)) {
      const backupPath = keyfilePath + '.backup.' + Date.now()
      fs.copyFileSync(keyfilePath, backupPath)
    }

    // Copy new keyfile
    fs.copyFileSync(sourcePath, keyfilePath)

    return { success: true }
  } catch (err: any) {
    console.error('Failed to import keyfile:', err)
    return { success: false, error: err.message }
  }
}
