import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'
import { getLettersBasePath } from './letter.service'

export interface LetterAttachment {
  id: string
  letter_id: string
  draft_id: string | null
  filename: string
  storage_path: string
  file_type: string | null
  file_size: number | null
  checksum: string | null
  created_by: string
  created_at: string
  deleted_at: string | null
  creator_name?: string
}

function generateId(): string {
  return `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function getUsername(userId: string): string {
  const db = getDatabase()
  const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as { username: string } | undefined
  return user?.username || 'unknown'
}

function calculateChecksum(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(fileBuffer).digest('hex')
}

// Add attachment to a letter
export function addAttachment(
  letterId: string,
  fileBuffer: Buffer,
  filename: string,
  userId: string,
  draftId?: string
): { success: boolean; attachment?: LetterAttachment; error?: string } {
  const db = getDatabase()

  // Get letter storage path
  const letter = db.prepare('SELECT storage_path FROM letters WHERE id = ? AND deleted_at IS NULL').get(letterId) as { storage_path: string } | undefined
  if (!letter?.storage_path) {
    return { success: false, error: 'Letter not found' }
  }

  const id = generateId()
  const now = new Date().toISOString()
  const attachmentsDir = path.join(getLettersBasePath(), letter.storage_path, 'attachments')

  // Ensure attachments directory exists
  fs.mkdirSync(attachmentsDir, { recursive: true })

  // Generate unique filename to avoid collisions
  const ext = path.extname(filename)
  const baseName = path.basename(filename, ext)
  const uniqueFilename = `${baseName}_${Date.now()}${ext}`
  const storagePath = path.join(letter.storage_path, 'attachments', uniqueFilename)
  const fullPath = path.join(getLettersBasePath(), storagePath)

  try {
    // Write file
    fs.writeFileSync(fullPath, fileBuffer)

    const checksum = calculateChecksum(fullPath)
    const fileType = ext.toLowerCase().replace('.', '')

    // Insert into database
    db.prepare(`
      INSERT INTO letter_attachments (
        id, letter_id, draft_id, filename, storage_path,
        file_type, file_size, checksum, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      letterId,
      draftId || null,
      filename,
      storagePath,
      fileType,
      fileBuffer.length,
      checksum,
      userId,
      now
    )

    // Update letter's updated_at
    db.prepare('UPDATE letters SET updated_at = ? WHERE id = ?').run(now, letterId)

    // Log audit
    logAudit('LETTER_FILE_UPLOAD', userId, getUsername(userId), 'letter_attachment', id, {
      letter_id: letterId,
      filename,
      file_size: fileBuffer.length
    })

    const attachment = getAttachmentById(id)
    return { success: true, attachment: attachment || undefined }
  } catch (error: any) {
    console.error('Error adding attachment:', error)
    return { success: false, error: error.message }
  }
}

// Get attachment by ID
export function getAttachmentById(id: string): LetterAttachment | null {
  const db = getDatabase()

  const attachment = db.prepare(`
    SELECT a.*, u.display_name as creator_name
    FROM letter_attachments a
    LEFT JOIN users u ON a.created_by = u.id
    WHERE a.id = ? AND a.deleted_at IS NULL
  `).get(id) as LetterAttachment | undefined

  return attachment || null
}

// Get all attachments for a letter
export function getAttachmentsByLetter(letterId: string): LetterAttachment[] {
  const db = getDatabase()

  return db.prepare(`
    SELECT a.*, u.display_name as creator_name
    FROM letter_attachments a
    LEFT JOIN users u ON a.created_by = u.id
    WHERE a.letter_id = ? AND a.deleted_at IS NULL
    ORDER BY a.created_at DESC
  `).all(letterId) as LetterAttachment[]
}

// Get attachments for a draft
export function getAttachmentsByDraft(draftId: string): LetterAttachment[] {
  const db = getDatabase()

  return db.prepare(`
    SELECT a.*, u.display_name as creator_name
    FROM letter_attachments a
    LEFT JOIN users u ON a.created_by = u.id
    WHERE a.draft_id = ? AND a.deleted_at IS NULL
    ORDER BY a.created_at DESC
  `).all(draftId) as LetterAttachment[]
}

// Delete attachment
export function deleteAttachment(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const attachment = getAttachmentById(id)
  if (!attachment) {
    return { success: false, error: 'Attachment not found' }
  }

  const now = new Date().toISOString()

  try {
    // Soft delete
    db.prepare(`
      UPDATE letter_attachments SET deleted_at = ? WHERE id = ?
    `).run(now, id)

    // Optionally delete the actual file
    const fullPath = path.join(getLettersBasePath(), attachment.storage_path)
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
    }

    // Log audit
    logAudit('LETTER_DELETE', userId, getUsername(userId), 'letter_attachment', id, {
      letter_id: attachment.letter_id,
      filename: attachment.filename
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting attachment:', error)
    return { success: false, error: error.message }
  }
}

// Get attachment file path
export function getAttachmentFilePath(id: string): string | null {
  const attachment = getAttachmentById(id)
  if (!attachment) return null

  return path.join(getLettersBasePath(), attachment.storage_path)
}

// Get the data directory path (for user reference)
export function getDataDirectoryPath(): string {
  return getLettersBasePath()
}
