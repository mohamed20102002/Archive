import * as fs from 'fs'
import * as path from 'path'
import { getDatabase } from '../database/connection'
import { getEmailsPath } from '../database/connection'
import { logAudit } from '../database/audit'
import { generateId, sha256File } from '../utils/crypto'
import { getUsername } from './auth.service'
import * as outlookService from './outlook.service'

export interface ArchivedEmail {
  id: string
  subject: string
  sender: string
  sender_name: string | null
  recipients: string
  cc: string | null
  bcc: string | null
  sent_at: string | null
  received_at: string | null
  has_attachments: boolean
  attachment_count: number
  attachment_names: string | null
  importance: string
  outlook_entry_id: string | null
  outlook_store_id: string | null
  folder_path: string | null
  storage_path: string
  file_size: number | null
  checksum: string | null
  body_preview: string | null
  archived_by: string
  archived_at: string
}

interface ArchiveEmailData {
  entryId: string
  storeId: string
  subject: string
  sender: string
  senderName?: string
  recipients: string[]
  cc?: string[]
  sentAt?: string
  receivedAt?: string
  hasAttachments: boolean
  attachmentCount: number
  attachmentNames?: string[]
  importance: number
  folderPath?: string
  bodyPreview?: string
}

export async function archiveEmail(
  emailData: ArchiveEmailData,
  topicId: string,
  userId: string,
  subcategoryId?: string
): Promise<{ success: boolean; email?: ArchivedEmail; recordId?: string; error?: string }> {
  const db = getDatabase()

  if (!emailData.entryId || !emailData.storeId) {
    return { success: false, error: 'Email entry ID and store ID are required' }
  }

  const id = generateId()
  const now = new Date()
  const dateFolder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`

  // Create storage directory
  const storagePath = path.join(getEmailsPath(), dateFolder, id)
  fs.mkdirSync(storagePath, { recursive: true })

  // Save the email file
  const emailFilePath = path.join(storagePath, 'email.msg')
  const saveResult = outlookService.saveEmailToFile(emailData.entryId, emailData.storeId, emailFilePath)

  if (!saveResult.success) {
    // Clean up the directory
    fs.rmSync(storagePath, { recursive: true, force: true })
    return { success: false, error: saveResult.error || 'Failed to save email file' }
  }

  // Get file stats
  const fileStats = fs.statSync(emailFilePath)
  const fileSize = fileStats.size

  // Calculate checksum
  let checksum: string | null = null
  try {
    checksum = await sha256File(emailFilePath)
  } catch (error) {
    console.error('Error calculating checksum:', error)
  }

  // Save attachments
  if (emailData.hasAttachments && emailData.attachmentCount > 0) {
    const attachmentsDir = path.join(storagePath, 'attachments')
    fs.mkdirSync(attachmentsDir, { recursive: true })

    for (let i = 1; i <= emailData.attachmentCount; i++) {
      const attachmentName = emailData.attachmentNames?.[i - 1] || `attachment_${i}`
      const attachmentPath = path.join(attachmentsDir, attachmentName)

      try {
        outlookService.saveAttachment(emailData.entryId, emailData.storeId, i, attachmentPath)
      } catch (error) {
        console.error(`Error saving attachment ${i}:`, error)
      }
    }
  }

  // Save metadata JSON
  const metadata = {
    id,
    subject: emailData.subject,
    sender: emailData.sender,
    senderName: emailData.senderName,
    recipients: emailData.recipients,
    cc: emailData.cc,
    sentAt: emailData.sentAt,
    receivedAt: emailData.receivedAt,
    hasAttachments: emailData.hasAttachments,
    attachmentCount: emailData.attachmentCount,
    attachmentNames: emailData.attachmentNames,
    importance: emailData.importance,
    folderPath: emailData.folderPath,
    outlookEntryId: emailData.entryId,
    outlookStoreId: emailData.storeId,
    archivedAt: now.toISOString(),
    archivedBy: userId,
    checksum
  }

  fs.writeFileSync(
    path.join(storagePath, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  )

  // Map importance number to string
  const importanceMap: Record<number, string> = {
    0: 'low',
    1: 'normal',
    2: 'high'
  }

  // Store relative path for portability
  const relativeStoragePath = path.join(dateFolder, id)

  try {
    // Insert email record
    db.prepare(`
      INSERT INTO emails (
        id, subject, sender, sender_name, recipients, cc, bcc,
        sent_at, received_at, has_attachments, attachment_count, attachment_names,
        importance, outlook_entry_id, outlook_store_id, folder_path,
        storage_path, file_size, checksum, body_preview, archived_by, archived_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      emailData.subject,
      emailData.sender,
      emailData.senderName || null,
      JSON.stringify(emailData.recipients),
      emailData.cc ? JSON.stringify(emailData.cc) : null,
      null, // BCC not available from received emails
      emailData.sentAt || null,
      emailData.receivedAt || null,
      emailData.hasAttachments ? 1 : 0,
      emailData.attachmentCount,
      emailData.attachmentNames?.join(',') || null,
      importanceMap[emailData.importance] || 'normal',
      emailData.entryId,
      emailData.storeId,
      emailData.folderPath || null,
      relativeStoragePath,
      fileSize,
      checksum,
      emailData.bodyPreview || null,
      userId,
      now.toISOString()
    )

    // Create a record entry for the timeline
    const recordId = generateId()
    db.prepare(`
      INSERT INTO records (id, topic_id, subcategory_id, type, title, content, email_id, created_by, created_at, updated_at)
      VALUES (?, ?, ?, 'email', ?, ?, ?, ?, ?, ?)
    `).run(
      recordId,
      topicId,
      subcategoryId || null,
      emailData.subject,
      null,
      id,
      userId,
      now.toISOString(),
      now.toISOString()
    )

    // Update topic's updated_at
    db.prepare('UPDATE topics SET updated_at = ? WHERE id = ?').run(now.toISOString(), topicId)

    const email: ArchivedEmail = {
      id,
      subject: emailData.subject,
      sender: emailData.sender,
      sender_name: emailData.senderName || null,
      recipients: JSON.stringify(emailData.recipients),
      cc: emailData.cc ? JSON.stringify(emailData.cc) : null,
      bcc: null,
      sent_at: emailData.sentAt || null,
      received_at: emailData.receivedAt || null,
      has_attachments: emailData.hasAttachments,
      attachment_count: emailData.attachmentCount,
      attachment_names: emailData.attachmentNames?.join(',') || null,
      importance: importanceMap[emailData.importance] || 'normal',
      outlook_entry_id: emailData.entryId,
      outlook_store_id: emailData.storeId,
      folder_path: emailData.folderPath || null,
      storage_path: relativeStoragePath,
      file_size: fileSize,
      checksum,
      body_preview: emailData.bodyPreview || null,
      archived_by: userId,
      archived_at: now.toISOString()
    }

    logAudit(
      'EMAIL_ARCHIVE',
      userId,
      getUsername(userId),
      'email',
      id,
      {
        subject: emailData.subject,
        sender: emailData.sender,
        topic_id: topicId,
        subcategory_id: subcategoryId || null,
        has_attachments: emailData.hasAttachments
      }
    )

    return { success: true, email, recordId }
  } catch (error: any) {
    // Clean up on failure
    fs.rmSync(storagePath, { recursive: true, force: true })
    console.error('Error archiving email:', error)
    return { success: false, error: `Failed to archive email: ${error.message}` }
  }
}

export function getEmailById(id: string): ArchivedEmail | null {
  const db = getDatabase()
  const email = db.prepare('SELECT * FROM emails WHERE id = ?').get(id) as ArchivedEmail | undefined
  return email || null
}

export function getEmailByRecord(recordId: string): ArchivedEmail | null {
  const db = getDatabase()
  const email = db.prepare(`
    SELECT e.* FROM emails e
    JOIN records r ON r.email_id = e.id
    WHERE r.id = ?
  `).get(recordId) as ArchivedEmail | undefined
  return email || null
}

export function searchEmails(query: string): ArchivedEmail[] {
  const db = getDatabase()

  if (!query.trim()) {
    return db.prepare('SELECT * FROM emails ORDER BY archived_at DESC LIMIT 50').all() as ArchivedEmail[]
  }

  return db.prepare(`
    SELECT e.* FROM emails e
    WHERE e.id IN (
      SELECT rowid FROM emails_fts WHERE emails_fts MATCH ?
    )
    ORDER BY e.archived_at DESC
    LIMIT 50
  `).all(`${query}*`) as ArchivedEmail[]
}

export function getEmailStoragePath(email: ArchivedEmail): string {
  return path.join(getEmailsPath(), email.storage_path)
}

export function getEmailFilePath(email: ArchivedEmail): string {
  return path.join(getEmailsPath(), email.storage_path, 'email.msg')
}

export function getEmailAttachmentsPath(email: ArchivedEmail): string {
  return path.join(getEmailsPath(), email.storage_path, 'attachments')
}

export function isEmailArchived(outlookEntryId: string): { archived: boolean; emailId?: string; topicId?: string } {
  const db = getDatabase()

  const result = db.prepare(`
    SELECT e.id as email_id, r.topic_id
    FROM emails e
    LEFT JOIN records r ON r.email_id = e.id
    WHERE e.outlook_entry_id = ?
    LIMIT 1
  `).get(outlookEntryId) as { email_id: string; topic_id: string } | undefined

  if (result) {
    return { archived: true, emailId: result.email_id, topicId: result.topic_id }
  }
  return { archived: false }
}

export function getArchivedEmailIds(): string[] {
  const db = getDatabase()
  const results = db.prepare('SELECT outlook_entry_id FROM emails WHERE outlook_entry_id IS NOT NULL').all() as { outlook_entry_id: string }[]
  return results.map(r => r.outlook_entry_id)
}

export function openEmailFile(emailId: string): { success: boolean; error?: string } {
  const email = getEmailById(emailId)
  if (!email) {
    return { success: false, error: 'Email not found' }
  }

  const filePath = getEmailFilePath(email)
  if (!fs.existsSync(filePath)) {
    return { success: false, error: 'Email file not found' }
  }

  try {
    // Use shell.openPath to open with default application
    const { shell } = require('electron')
    shell.openPath(filePath)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: `Failed to open email: ${error.message}` }
  }
}

export function deleteArchivedEmail(id: string, userId: string): { success: boolean; error?: string } {
  const db = getDatabase()

  const email = getEmailById(id)
  if (!email) {
    return { success: false, error: 'Email not found' }
  }

  try {
    // Delete associated records first
    db.prepare('DELETE FROM records WHERE email_id = ?').run(id)

    // Delete the email record
    db.prepare('DELETE FROM emails WHERE id = ?').run(id)

    // Delete the storage files
    const storagePath = getEmailStoragePath(email)
    if (fs.existsSync(storagePath)) {
      fs.rmSync(storagePath, { recursive: true, force: true })
    }

    logAudit(
      'EMAIL_DELETE',
      userId,
      getUsername(userId),
      'email',
      id,
      { subject: email.subject }
    )

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting email:', error)
    return { success: false, error: `Failed to delete email: ${error.message}` }
  }
}
