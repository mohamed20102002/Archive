import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { getDatabase } from '../database/connection'
import { getBasePath } from '../utils/fileSystem'
import { logAudit } from '../database/audit'

export interface RecordAttachment {
  id: string
  record_id: string
  filename: string
  filepath: string
  file_size: number | null
  mime_type: string | null
  checksum: string | null
  created_at: string
}

function getTopicsBasePath(): string {
  return path.join(getBasePath(), 'data', 'topics')
}

function calculateChecksum(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function sanitizeFolderName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100)
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.txt': 'text/plain',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.7z': 'application/x-7z-compressed'
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

export function getAttachmentsByRecordId(recordId: string): RecordAttachment[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM record_attachments WHERE record_id = ? ORDER BY created_at ASC
  `).all(recordId) as RecordAttachment[]
}

export function getAttachmentById(id: string): RecordAttachment | null {
  const db = getDatabase()
  return db.prepare('SELECT * FROM record_attachments WHERE id = ?').get(id) as RecordAttachment | null
}

export interface AddAttachmentData {
  recordId: string
  filename: string
  buffer: Buffer
  topicTitle: string
}

export function addAttachment(data: AddAttachmentData, userId: string): { success: boolean; attachment?: RecordAttachment; error?: string } {
  const db = getDatabase()

  try {
    const { recordId, filename, buffer, topicTitle } = data

    // Get record info to build folder path
    const record = db.prepare(`
      SELECT r.id, r.created_at, t.title as topic_title
      FROM records r
      JOIN topics t ON r.topic_id = t.id
      WHERE r.id = ?
    `).get(recordId) as { id: string; created_at: string; topic_title: string } | undefined

    if (!record) {
      return { success: false, error: 'Record not found' }
    }

    // Build folder structure: data/topics/{TopicTitle}/{recordID}_{Date}/
    const sanitizedTopicTitle = sanitizeFolderName(topicTitle || record.topic_title)
    const recordDate = record.created_at.split('T')[0].replace(/-/g, '')
    const folderName = `${recordId.substring(0, 8)}_${recordDate}`

    const relativePath = path.join(sanitizedTopicTitle, folderName)
    const fullFolderPath = path.join(getTopicsBasePath(), relativePath)

    // Ensure folder exists
    if (!fs.existsSync(fullFolderPath)) {
      fs.mkdirSync(fullFolderPath, { recursive: true })
    }

    // Generate unique filename if file exists
    let finalFilename = filename
    let counter = 1
    const ext = path.extname(filename)
    const baseName = path.basename(filename, ext)

    while (fs.existsSync(path.join(fullFolderPath, finalFilename))) {
      finalFilename = `${baseName}_${counter}${ext}`
      counter++
    }

    // Write file
    const fullFilePath = path.join(fullFolderPath, finalFilename)
    fs.writeFileSync(fullFilePath, buffer)

    // Calculate checksum and get file info
    const checksum = calculateChecksum(buffer)
    const fileSize = buffer.length
    const mimeType = getMimeType(finalFilename)

    // Store relative path in database
    const storedPath = path.join(relativePath, finalFilename)

    // Insert into database
    const id = uuidv4()
    db.prepare(`
      INSERT INTO record_attachments (id, record_id, filename, filepath, file_size, mime_type, checksum, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, recordId, finalFilename, storedPath, fileSize, mimeType, checksum)

    // Log audit
    logAudit('RECORD_UPDATE', userId, null, 'record', recordId, { action: 'attachment_added', filename: finalFilename })

    const attachment = getAttachmentById(id)
    return { success: true, attachment: attachment || undefined }

  } catch (error: any) {
    console.error('Error adding attachment:', error)
    return { success: false, error: error.message }
  }
}

export function deleteAttachment(attachmentId: string, userId: string): { success: boolean; error?: string } {
  const db = getDatabase()

  try {
    const attachment = getAttachmentById(attachmentId)
    if (!attachment) {
      return { success: false, error: 'Attachment not found' }
    }

    // Delete file from disk
    const fullPath = path.join(getTopicsBasePath(), attachment.filepath)
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
    }

    // Delete from database
    db.prepare('DELETE FROM record_attachments WHERE id = ?').run(attachmentId)

    // Log audit
    logAudit('RECORD_UPDATE', userId, null, 'record', attachment.record_id, { action: 'attachment_deleted', filename: attachment.filename })

    // Clean up empty folders
    const folderPath = path.dirname(fullPath)
    if (fs.existsSync(folderPath)) {
      const files = fs.readdirSync(folderPath)
      if (files.length === 0) {
        fs.rmdirSync(folderPath)

        // Also check parent topic folder
        const parentPath = path.dirname(folderPath)
        if (fs.existsSync(parentPath)) {
          const parentFiles = fs.readdirSync(parentPath)
          if (parentFiles.length === 0) {
            fs.rmdirSync(parentPath)
          }
        }
      }
    }

    return { success: true }

  } catch (error: any) {
    console.error('Error deleting attachment:', error)
    return { success: false, error: error.message }
  }
}

export function getAttachmentFullPath(attachmentId: string): string | null {
  const attachment = getAttachmentById(attachmentId)
  if (!attachment) return null
  return path.join(getTopicsBasePath(), attachment.filepath)
}

export function openAttachment(attachmentId: string): { success: boolean; error?: string } {
  const fullPath = getAttachmentFullPath(attachmentId)
  if (!fullPath || !fs.existsSync(fullPath)) {
    return { success: false, error: 'File not found' }
  }

  // Return the path - the shell.openPath will be called from the handler
  return { success: true }
}
