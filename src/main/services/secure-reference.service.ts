import * as fs from 'fs'
import * as path from 'path'
import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'
import { generateId, sha256 } from '../utils/crypto'
import { getUsername } from './auth.service'
import { getReferencesStorageDir } from './secure-resources-crypto'

// Types

export interface SecureReferenceView {
  id: string
  name: string
  description: string | null
  category: string
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
  created_by: string
  created_at: string
  creator_name?: string
}

export interface CreateReferenceData {
  name: string
  description?: string
  category?: string
}

export interface UpdateReferenceData {
  name?: string
  description?: string
  category?: string
}

export interface ReferenceFilters {
  query?: string
  category?: string
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

  try {
    db.prepare(`
      INSERT INTO secure_references (id, name, description, category, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name.trim(),
      data.description?.trim() || null,
      category,
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

  return db.prepare(`
    SELECT
      r.id, r.name, r.description, r.category,
      r.created_by, r.created_at, r.updated_at,
      u.display_name as creator_name,
      (SELECT COUNT(*) FROM secure_reference_files f WHERE f.reference_id = r.id AND f.deleted_at IS NULL) as file_count
    FROM secure_references r
    LEFT JOIN users u ON r.created_by = u.id
    WHERE ${whereClause}
    ORDER BY r.name ASC
  `).all(...values) as SecureReferenceView[]
}

// Get single reference by ID
export function getReferenceById(id: string): SecureReferenceView | null {
  const db = getDatabase()

  const ref = db.prepare(`
    SELECT
      r.id, r.name, r.description, r.category,
      r.created_by, r.created_at, r.updated_at,
      u.display_name as creator_name,
      (SELECT COUNT(*) FROM secure_reference_files f WHERE f.reference_id = r.id AND f.deleted_at IS NULL) as file_count
    FROM secure_references r
    LEFT JOIN users u ON r.created_by = u.id
    WHERE r.id = ? AND r.deleted_at IS NULL
  `).get(id) as SecureReferenceView | undefined

  return ref || null
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

  const ref = db.prepare(
    'SELECT name FROM secure_references WHERE id = ? AND deleted_at IS NULL'
  ).get(refId) as { name: string } | undefined

  if (!ref) {
    return { success: false, error: 'Reference not found' }
  }

  const id = generateId()
  const now = new Date().toISOString()

  // Build unique filename
  const ext = path.extname(filename)
  const basename = path.basename(filename, ext)
  const uniqueFilename = `${basename}_${Date.now()}${ext}`
  const storagePath = path.join(refId, uniqueFilename)

  // Ensure reference directory exists
  const refsDir = getReferencesStorageDir()
  const refDir = path.join(refsDir, refId)
  if (!fs.existsSync(refDir)) {
    fs.mkdirSync(refDir, { recursive: true })
  }

  // Write file to disk
  const fullPath = path.join(refsDir, storagePath)
  fs.writeFileSync(fullPath, fileBuffer)

  // Compute checksum
  const checksum = sha256(fileBuffer)

  // Determine file type from extension
  const fileType = ext ? ext.slice(1).toLowerCase() : null

  try {
    db.prepare(`
      INSERT INTO secure_reference_files (
        id, reference_id, filename, storage_path, file_type, file_size, checksum,
        created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, refId, filename, storagePath, fileType, fileBuffer.length, checksum,
      userId, now
    )

    logAudit(
      'SECURE_REFERENCE_FILE_ADD' as any,
      userId,
      getUsername(userId),
      'secure_reference_file',
      id,
      { reference_id: refId, reference_name: ref.name, filename }
    )

    const file = db.prepare(`
      SELECT f.*, u.display_name as creator_name
      FROM secure_reference_files f
      LEFT JOIN users u ON f.created_by = u.id
      WHERE f.id = ?
    `).get(id) as SecureReferenceFileView | undefined

    return { success: true, file: file || undefined }
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

  return db.prepare(`
    SELECT f.*, u.display_name as creator_name
    FROM secure_reference_files f
    LEFT JOIN users u ON f.created_by = u.id
    WHERE f.reference_id = ? AND f.deleted_at IS NULL
    ORDER BY f.created_at DESC
  `).all(refId) as SecureReferenceFileView[]
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
export function getReferenceFilePath(fileId: string): string | null {
  const db = getDatabase()

  const file = db.prepare(
    'SELECT storage_path FROM secure_reference_files WHERE id = ? AND deleted_at IS NULL'
  ).get(fileId) as { storage_path: string } | undefined

  if (!file) return null

  const refsDir = getReferencesStorageDir()
  return path.join(refsDir, file.storage_path)
}
