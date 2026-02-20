/**
 * Document Version Service
 *
 * Manages document versioning for attachments and files.
 * Tracks version history and enables comparison between versions.
 */

import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

export interface DocumentVersion {
  id: string
  document_type: 'letter_attachment' | 'record_attachment' | 'mom_draft' | 'letter_draft'
  document_id: string
  version_number: number
  file_path: string
  file_name: string
  file_size: number
  file_hash: string
  mime_type: string
  created_by: string | null
  created_at: string
  change_summary: string | null
  is_current: boolean
}

export interface CreateVersionInput {
  document_type: DocumentVersion['document_type']
  document_id: string
  file_path: string
  file_name: string
  mime_type: string
  created_by: string | null
  change_summary?: string
}

export interface VersionComparison {
  older_version: DocumentVersion
  newer_version: DocumentVersion
  size_change: number
  size_change_percent: number
  time_between: number // milliseconds
}

/**
 * Generate unique version ID
 */
function generateVersionId(): string {
  return `ver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Calculate file hash for integrity checking
 */
function calculateFileHash(filePath: string): string {
  try {
    const fileBuffer = fs.readFileSync(filePath)
    return crypto.createHash('sha256').update(fileBuffer).digest('hex')
  } catch {
    return ''
  }
}

/**
 * Get file size in bytes
 */
function getFileSize(filePath: string): number {
  try {
    const stats = fs.statSync(filePath)
    return stats.size
  } catch {
    return 0
  }
}

/**
 * Create a new version of a document
 */
export function createVersion(input: CreateVersionInput): DocumentVersion {
  const db = getDatabase()
  const id = generateVersionId()
  const now = new Date().toISOString()

  // Get current highest version number for this document
  const currentMax = db.prepare(`
    SELECT MAX(version_number) as max_version
    FROM document_versions
    WHERE document_type = ? AND document_id = ?
  `).get(input.document_type, input.document_id) as { max_version: number | null }

  const versionNumber = (currentMax?.max_version || 0) + 1

  // Mark all previous versions as not current
  db.prepare(`
    UPDATE document_versions
    SET is_current = 0
    WHERE document_type = ? AND document_id = ?
  `).run(input.document_type, input.document_id)

  const fileHash = calculateFileHash(input.file_path)
  const fileSize = getFileSize(input.file_path)

  // Insert new version
  db.prepare(`
    INSERT INTO document_versions (
      id, document_type, document_id, version_number,
      file_path, file_name, file_size, file_hash, mime_type,
      created_by, created_at, change_summary, is_current
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    id,
    input.document_type,
    input.document_id,
    versionNumber,
    input.file_path,
    input.file_name,
    fileSize,
    fileHash,
    input.mime_type,
    input.created_by,
    now,
    input.change_summary || null
  )

  logAudit({
    action: 'DOCUMENT_VERSION_CREATE',
    entityType: input.document_type,
    entityId: input.document_id,
    userId: input.created_by,
    details: { version: versionNumber, fileName: input.file_name }
  })

  return {
    id,
    document_type: input.document_type,
    document_id: input.document_id,
    version_number: versionNumber,
    file_path: input.file_path,
    file_name: input.file_name,
    file_size: fileSize,
    file_hash: fileHash,
    mime_type: input.mime_type,
    created_by: input.created_by,
    created_at: now,
    change_summary: input.change_summary || null,
    is_current: true
  }
}

/**
 * Get all versions of a document
 */
export function getVersions(
  documentType: DocumentVersion['document_type'],
  documentId: string
): DocumentVersion[] {
  const db = getDatabase()

  const rows = db.prepare(`
    SELECT * FROM document_versions
    WHERE document_type = ? AND document_id = ?
    ORDER BY version_number DESC
  `).all(documentType, documentId) as DocumentVersion[]

  return rows.map(row => ({
    ...row,
    is_current: Boolean(row.is_current)
  }))
}

/**
 * Get a specific version
 */
export function getVersion(versionId: string): DocumentVersion | null {
  const db = getDatabase()

  const row = db.prepare(`
    SELECT * FROM document_versions WHERE id = ?
  `).get(versionId) as DocumentVersion | undefined

  if (!row) return null

  return {
    ...row,
    is_current: Boolean(row.is_current)
  }
}

/**
 * Get the current version of a document
 */
export function getCurrentVersion(
  documentType: DocumentVersion['document_type'],
  documentId: string
): DocumentVersion | null {
  const db = getDatabase()

  const row = db.prepare(`
    SELECT * FROM document_versions
    WHERE document_type = ? AND document_id = ? AND is_current = 1
  `).get(documentType, documentId) as DocumentVersion | undefined

  if (!row) return null

  return {
    ...row,
    is_current: true
  }
}

/**
 * Restore a previous version as current
 */
export function restoreVersion(versionId: string, userId: string | null): DocumentVersion | null {
  const db = getDatabase()

  const version = getVersion(versionId)
  if (!version) return null

  // Mark all versions as not current
  db.prepare(`
    UPDATE document_versions
    SET is_current = 0
    WHERE document_type = ? AND document_id = ?
  `).run(version.document_type, version.document_id)

  // Mark this version as current
  db.prepare(`
    UPDATE document_versions
    SET is_current = 1
    WHERE id = ?
  `).run(versionId)

  logAudit({
    action: 'DOCUMENT_VERSION_RESTORE',
    entityType: version.document_type,
    entityId: version.document_id,
    userId,
    details: { restoredVersion: version.version_number }
  })

  return { ...version, is_current: true }
}

/**
 * Compare two versions
 */
export function compareVersions(
  versionId1: string,
  versionId2: string
): VersionComparison | null {
  const version1 = getVersion(versionId1)
  const version2 = getVersion(versionId2)

  if (!version1 || !version2) return null

  // Determine which is older/newer
  const [older, newer] = version1.version_number < version2.version_number
    ? [version1, version2]
    : [version2, version1]

  const sizeChange = newer.file_size - older.file_size
  const sizeChangePercent = older.file_size > 0
    ? (sizeChange / older.file_size) * 100
    : 0

  const timeBetween = new Date(newer.created_at).getTime() - new Date(older.created_at).getTime()

  return {
    older_version: older,
    newer_version: newer,
    size_change: sizeChange,
    size_change_percent: Math.round(sizeChangePercent * 100) / 100,
    time_between: timeBetween
  }
}

/**
 * Delete old versions (keep last N versions)
 */
export function pruneVersions(
  documentType: DocumentVersion['document_type'],
  documentId: string,
  keepCount: number = 10
): number {
  const db = getDatabase()

  // Get versions to delete (keep newest keepCount)
  const toDelete = db.prepare(`
    SELECT id, file_path FROM document_versions
    WHERE document_type = ? AND document_id = ?
    ORDER BY version_number DESC
    LIMIT -1 OFFSET ?
  `).all(documentType, documentId, keepCount) as { id: string; file_path: string }[]

  if (toDelete.length === 0) return 0

  // Delete from database
  const ids = toDelete.map(v => v.id)
  const placeholders = ids.map(() => '?').join(',')

  const result = db.prepare(`
    DELETE FROM document_versions WHERE id IN (${placeholders})
  `).run(...ids)

  return result.changes
}

/**
 * Get version count for a document
 */
export function getVersionCount(
  documentType: DocumentVersion['document_type'],
  documentId: string
): number {
  const db = getDatabase()

  const result = db.prepare(`
    SELECT COUNT(*) as count FROM document_versions
    WHERE document_type = ? AND document_id = ?
  `).get(documentType, documentId) as { count: number }

  return result.count
}

/**
 * Verify file integrity against stored hash
 */
export function verifyIntegrity(versionId: string): { valid: boolean; details?: string } {
  const version = getVersion(versionId)
  if (!version) {
    return { valid: false, details: 'Version not found' }
  }

  if (!fs.existsSync(version.file_path)) {
    return { valid: false, details: 'File not found' }
  }

  const currentHash = calculateFileHash(version.file_path)
  if (currentHash !== version.file_hash) {
    return { valid: false, details: 'Hash mismatch - file may have been modified' }
  }

  return { valid: true }
}

export default {
  createVersion,
  getVersions,
  getVersion,
  getCurrentVersion,
  restoreVersion,
  compareVersions,
  pruneVersions,
  getVersionCount,
  verifyIntegrity
}
