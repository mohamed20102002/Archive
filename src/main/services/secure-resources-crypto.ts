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
