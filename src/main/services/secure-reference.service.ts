import * as fs from 'fs'
import * as path from 'path'
import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'
import { generateId, sha256 } from '../utils/crypto'
import { getUsername } from './auth.service'
import { getReferencesStorageDir, encryptFile, decryptFileToTemp } from './secure-resources-crypto'

// File size limit: 100MB
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024

// Types

export type ResourceColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | null

export interface SecureReferenceView {
  id: string
  name: string
  description: string | null
  category: string
  admin_only: boolean
  color: ResourceColor
  created_by: string
  created_at: string
  updated_at: string
  creator_name?: string
  file_count?: number
}

export interface SecureReferenceFileView {
  id: string
  reference_id: string
  filename: string
  storage_path: string
  file_type: string | null
  file_size: number | null
  checksum: string | null
  is_encrypted: boolean
  created_by: string
  created_at: string
  creator_name?: string
}

export interface CreateReferenceData {
  name: string
  description?: string
  category?: string
  admin_only?: boolean
  color?: ResourceColor
}

export interface UpdateReferenceData {
  name?: string
  description?: string
  category?: string
  admin_only?: boolean
  color?: ResourceColor
}

export interface ReferenceFilters {
  query?: string
  category?: string
  isAdmin?: boolean
}

// Create reference
export function createReference(
  data: CreateReferenceData,
  userId: string
): { success: boolean; reference?: SecureReferenceView; error?: string } {
  const db = getDatabase()

  if (!data.name?.trim()) {
    return { success: false, error: 'Name is required' }
  }

  const id = generateId()
  const now = new Date().toISOString()
  const category = data.category || 'General'
  const adminOnly = data.admin_only ? 1 : 0
  const color = data.color || null

  // DEBUG: Log the admin_only value being stored
  console.log('[createReference] data.admin_only:', data.admin_only, 'storing as:', adminOnly)

  try {
    db.prepare(`
      INSERT INTO secure_references (id, name, description, category, admin_only, color, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name.trim(),
      data.description?.trim() || null,
      category,
      adminOnly,
      color,
      userId,
      now,
      now
    )

    logAudit(
      'SECURE_REFERENCE_CREATE' as any,
      userId,
      getUsername(userId),
      'secure_reference',
      id,
      { name: data.name.trim(), category }
    )

    const reference = getReferenceById(id)
    return { success: true, reference: reference || undefined }
  } catch (error) {
    console.error('Error creating reference:', error)
    return { success: false, error: 'Failed to create reference' }
  }
}

// Get all references with file count
export function getAllReferences(filters?: ReferenceFilters): SecureReferenceView[] {
  const db = getDatabase()

  const conditions: string[] = ['r.deleted_at IS NULL']
  const values: unknown[] = []

  // Filter out admin_only resources for non-admin users
  if (!filters?.isAdmin) {
    conditions.push('r.admin_only = 0')
  }

  if (filters?.query?.trim()) {
    conditions.push('(r.name LIKE ? OR r.description LIKE ?)')
    const q = `%${filters.query.trim()}%`
    values.push(q, q)
  }

  if (filters?.category) {
    conditions.push('r.category = ?')
    values.push(filters.category)
  }

  const whereClause = conditions.join(' AND ')

  const rows = db.prepare(`
    SELECT
      r.id, r.name, r.description, r.category, r.admin_only, r.color,
      r.created_by, r.created_at, r.updated_at,
      u.display_name as creator_name,
      (SELECT COUNT(*) FROM secure_reference_files f WHERE f.reference_id = r.id AND f.deleted_at IS NULL) as file_count
    FROM secure_references r
    LEFT JOIN users u ON r.created_by = u.id
    WHERE ${whereClause}
    ORDER BY r.name ASC
  `).all(...values) as (SecureReferenceView & { admin_only: number })[]

  // Convert admin_only from integer to boolean
  return rows.map(row => ({
    ...row,
    admin_only: row.admin_only === 1
  }))
}

// Get single reference by ID
export function getReferenceById(id: string, isAdmin: boolean = true): SecureReferenceView | null {
  const db = getDatabase()

  const conditions = ['r.id = ?', 'r.deleted_at IS NULL']
  if (!isAdmin) {
    conditions.push('r.admin_only = 0')
  }

  const row = db.prepare(`
    SELECT
      r.id, r.name, r.description, r.category, r.admin_only, r.color,
      r.created_by, r.created_at, r.updated_at,
      u.display_name as creator_name,
      (SELECT COUNT(*) FROM secure_reference_files f WHERE f.reference_id = r.id AND f.deleted_at IS NULL) as file_count
    FROM secure_references r
    LEFT JOIN users u ON r.created_by = u.id
    WHERE ${conditions.join(' AND ')}
  `).get(id) as (SecureReferenceView & { admin_only: number }) | undefined

  if (!row) return null

  return {
    ...row,
    admin_only: row.admin_only === 1
  }
}

// Update reference
export function updateReference(
  id: string,
  data: UpdateReferenceData,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = db.prepare(
    'SELECT name FROM secure_references WHERE id = ? AND deleted_at IS NULL'
  ).get(id) as { name: string } | undefined

  if (!existing) {
    return { success: false, error: 'Reference not found' }
  }

  const fields: string[] = []
  const values: unknown[] = []

  if (data.name !== undefined) {
    if (!data.name.trim()) {
      return { success: false, error: 'Name cannot be empty' }
    }
    fields.push('name = ?')
    values.push(data.name.trim())
  }

  if (data.description !== undefined) {
    fields.push('description = ?')
    values.push(data.description?.trim() || null)
  }

  if (data.category !== undefined) {
    fields.push('category = ?')
    values.push(data.category)
  }

  if (data.admin_only !== undefined) {
    fields.push('admin_only = ?')
    values.push(data.admin_only ? 1 : 0)
  }

  if (data.color !== undefined) {
    fields.push('color = ?')
    values.push(data.color)
  }

  if (fields.length === 0) {
    return { success: true }
  }

  fields.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id)

  try {
    db.prepare(`UPDATE secure_references SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    logAudit(
      'SECURE_REFERENCE_UPDATE' as any,
      userId,
      getUsername(userId),
      'secure_reference',
      id,
      { name: existing.name }
    )

    return { success: true }
  } catch (error) {
    console.error('Error updating reference:', error)
    return { success: false, error: 'Failed to update reference' }
  }
}

// Soft delete reference and all its files
export function deleteReference(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = db.prepare(
    'SELECT name FROM secure_references WHERE id = ? AND deleted_at IS NULL'
  ).get(id) as { name: string } | undefined

  if (!existing) {
    return { success: false, error: 'Reference not found' }
  }

  const now = new Date().toISOString()

  try {
    db.transaction(() => {
      // Get files to delete from disk
      const files = db.prepare(
        'SELECT storage_path FROM secure_reference_files WHERE reference_id = ? AND deleted_at IS NULL'
      ).all(id) as { storage_path: string }[]

      // Hard delete files from disk
      const refsDir = getReferencesStorageDir()
      for (const file of files) {
        const fullPath = path.join(refsDir, file.storage_path)
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath)
        }
      }

      // Remove the reference folder if it exists and is empty
      const refDir = path.join(refsDir, id)
      if (fs.existsSync(refDir)) {
        try {
          fs.rmdirSync(refDir) // Only removes if empty
        } catch {
          // Folder not empty or other error - ignore
        }
      }

      // Soft delete all files in DB
      db.prepare(
        'UPDATE secure_reference_files SET deleted_at = ? WHERE reference_id = ? AND deleted_at IS NULL'
      ).run(now, id)

      // Soft delete the reference
      db.prepare(
        'UPDATE secure_references SET deleted_at = ? WHERE id = ?'
      ).run(now, id)
    })()

    logAudit(
      'SECURE_REFERENCE_DELETE' as any,
      userId,
      getUsername(userId),
      'secure_reference',
      id,
      { name: existing.name }
    )

    return { success: true }
  } catch (error) {
    console.error('Error deleting reference:', error)
    return { success: false, error: 'Failed to delete reference' }
  }
}

// Add file to reference
export function addReferenceFile(
  refId: string,
  fileBuffer: Buffer,
  filename: string,
  userId: string
): { success: boolean; file?: SecureReferenceFileView; error?: string } {
  const db = getDatabase()

  // Check file size limit
  if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
    const sizeMB = Math.round(fileBuffer.length / (1024 * 1024))
    return { success: false, error: `File too large (${sizeMB}MB). Maximum allowed size is 100MB.` }
  }

  const ref = db.prepare(
    'SELECT name, admin_only FROM secure_references WHERE id = ? AND deleted_at IS NULL'
  ).get(refId) as { name: string; admin_only: number } | undefined

  if (!ref) {
    return { success: false, error: 'Reference not found' }
  }

  // DEBUG: Log the admin_only value
  console.log('[addReferenceFile] Reference:', ref.name, 'admin_only value:', ref.admin_only, 'type:', typeof ref.admin_only)

  const id = generateId()
  const now = new Date().toISOString()

  // Determine if we should encrypt this file
  const shouldEncrypt = ref.admin_only === 1

  // Get file extension (needed for both encrypted and non-encrypted paths)
  const ext = path.extname(filename)

  // Build storage filename
  // For encrypted files: use random ID with .enc extension (obfuscated)
  // For regular files: use original name with timestamp
  let storagePath: string
  if (shouldEncrypt) {
    // Obfuscated name - no trace of original filename or extension
    const obfuscatedName = `${id}.enc`
    storagePath = path.join(refId, obfuscatedName)
  } else {
    const basename = path.basename(filename, ext)
    const uniqueFilename = `${basename}_${Date.now()}${ext}`
    storagePath = path.join(refId, uniqueFilename)
  }

  // Ensure reference directory exists
  const refsDir = getReferencesStorageDir()
  const refDir = path.join(refsDir, refId)
  if (!fs.existsSync(refDir)) {
    fs.mkdirSync(refDir, { recursive: true })
  }

  console.log('[addReferenceFile] shouldEncrypt:', shouldEncrypt)
  let bufferToWrite = fileBuffer
  let encryptionIv: string | null = null
  let encryptionTag: string | null = null

  if (shouldEncrypt) {
    console.log('[addReferenceFile] Encrypting file:', filename)
    const encrypted = encryptFile(fileBuffer)
    bufferToWrite = encrypted.encryptedBuffer
    encryptionIv = encrypted.iv
    encryptionTag = encrypted.tag
    console.log('[addReferenceFile] File encrypted, IV length:', encryptionIv?.length, 'Tag length:', encryptionTag?.length)
  } else {
    console.log('[addReferenceFile] NOT encrypting file:', filename)
  }

  // Write file to disk (encrypted or plain)
  const fullPath = path.join(refsDir, storagePath)
  fs.writeFileSync(fullPath, bufferToWrite)

  // Compute checksum of original file (before encryption)
  const checksum = sha256(fileBuffer)

  // Determine file type from extension
  const fileType = ext ? ext.slice(1).toLowerCase() : null

  try {
    db.prepare(`
      INSERT INTO secure_reference_files (
        id, reference_id, filename, storage_path, file_type, file_size, checksum,
        is_encrypted, encryption_iv, encryption_tag,
        created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, refId, filename, storagePath, fileType, fileBuffer.length, checksum,
      shouldEncrypt ? 1 : 0, encryptionIv, encryptionTag,
      userId, now
    )

    logAudit(
      'SECURE_REFERENCE_FILE_ADD' as any,
      userId,
      getUsername(userId),
      'secure_reference_file',
      id,
      { reference_id: refId, reference_name: ref.name, filename, encrypted: shouldEncrypt }
    )

    const fileRow = db.prepare(`
      SELECT f.*, u.display_name as creator_name
      FROM secure_reference_files f
      LEFT JOIN users u ON f.created_by = u.id
      WHERE f.id = ?
    `).get(id) as (SecureReferenceFileView & { is_encrypted: number }) | undefined

    const file = fileRow ? { ...fileRow, is_encrypted: fileRow.is_encrypted === 1 } : undefined

    return { success: true, file }
  } catch (error) {
    console.error('Error adding reference file:', error)
    // Clean up the written file on DB error
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
    }
    return { success: false, error: 'Failed to add file' }
  }
}

// Get files for a reference
export function getReferenceFiles(refId: string): SecureReferenceFileView[] {
  const db = getDatabase()

  const rows = db.prepare(`
    SELECT f.*, u.display_name as creator_name
    FROM secure_reference_files f
    LEFT JOIN users u ON f.created_by = u.id
    WHERE f.reference_id = ? AND f.deleted_at IS NULL
    ORDER BY f.created_at DESC
  `).all(refId) as (SecureReferenceFileView & { is_encrypted: number })[]

  // Convert is_encrypted from integer to boolean
  return rows.map(row => ({
    ...row,
    is_encrypted: row.is_encrypted === 1
  }))
}

// Delete a reference file (soft delete DB + hard delete disk)
export function deleteReferenceFile(
  fileId: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const file = db.prepare(
    'SELECT f.*, r.name as reference_name FROM secure_reference_files f LEFT JOIN secure_references r ON f.reference_id = r.id WHERE f.id = ? AND f.deleted_at IS NULL'
  ).get(fileId) as (SecureReferenceFileView & { reference_name: string }) | undefined

  if (!file) {
    return { success: false, error: 'File not found' }
  }

  try {
    // Hard delete from disk
    const refsDir = getReferencesStorageDir()
    const fullPath = path.join(refsDir, file.storage_path)
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
    }

    // Soft delete in DB
    db.prepare(
      'UPDATE secure_reference_files SET deleted_at = ? WHERE id = ?'
    ).run(new Date().toISOString(), fileId)

    logAudit(
      'SECURE_REFERENCE_FILE_DELETE' as any,
      userId,
      getUsername(userId),
      'secure_reference_file',
      fileId,
      { reference_id: file.reference_id, reference_name: file.reference_name, filename: file.filename }
    )

    return { success: true }
  } catch (error) {
    console.error('Error deleting reference file:', error)
    return { success: false, error: 'Failed to delete file' }
  }
}

// Get full filesystem path for a reference file
// For encrypted files, decrypts to a temp file and returns that path
export function getReferenceFilePath(fileId: string): string | null {
  const db = getDatabase()

  const file = db.prepare(
    'SELECT storage_path, filename, is_encrypted, encryption_iv, encryption_tag FROM secure_reference_files WHERE id = ? AND deleted_at IS NULL'
  ).get(fileId) as {
    storage_path: string
    filename: string
    is_encrypted: number
    encryption_iv: string | null
    encryption_tag: string | null
  } | undefined

  if (!file) return null

  const refsDir = getReferencesStorageDir()
  const fullPath = path.join(refsDir, file.storage_path)

  // If the file is encrypted, decrypt it to a temp file
  if (file.is_encrypted === 1 && file.encryption_iv && file.encryption_tag) {
    try {
      return decryptFileToTemp(fullPath, file.filename, file.encryption_iv, file.encryption_tag)
    } catch (error) {
      console.error('Error decrypting file:', error)
      return null
    }
  }

  return fullPath
}

// Toggle admin_only status for reference
export function toggleReferenceAdminOnly(
  id: string,
  adminOnly: boolean,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = db.prepare(
    'SELECT name FROM secure_references WHERE id = ? AND deleted_at IS NULL'
  ).get(id) as { name: string } | undefined

  if (!existing) {
    return { success: false, error: 'Reference not found' }
  }

  try {
    db.prepare(
      'UPDATE secure_references SET admin_only = ?, updated_at = ? WHERE id = ?'
    ).run(adminOnly ? 1 : 0, new Date().toISOString(), id)

    logAudit(
      'SECURE_REFERENCE_TOGGLE_ADMIN_ONLY' as any,
      userId,
      getUsername(userId),
      'secure_reference',
      id,
      { name: existing.name, admin_only: adminOnly }
    )

    return { success: true }
  } catch (error) {
    console.error('Error toggling reference admin_only:', error)
    return { success: false, error: 'Failed to update reference' }
  }
}
