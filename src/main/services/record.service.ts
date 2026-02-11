import * as fs from 'fs'
import * as path from 'path'
import { getDatabase } from '../database/connection'
import { getEmailsPath } from '../database/connection'
import { logAudit } from '../database/audit'
import { generateId } from '../utils/crypto'
import { getUsername } from './auth.service'
import { getTopicById } from './topic.service'
import { getAttachmentsByRecordId, deleteAttachment } from './record-attachment.service'

export interface Record {
  id: string
  topic_id: string
  subcategory_id: string | null
  type: string
  title: string
  content: string | null
  email_id: string | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  creator_name?: string
  email_subject?: string
  subcategory_title?: string
}

export interface CreateRecordData {
  topic_id: string
  subcategory_id?: string
  type: string
  title: string
  content?: string
  email_id?: string
}

export interface UpdateRecordData {
  title?: string
  content?: string
  type?: string
  subcategory_id?: string | null
}

export function createRecord(
  data: CreateRecordData,
  userId: string
): { success: boolean; record?: Record; error?: string } {
  const db = getDatabase()

  if (!data.topic_id) {
    return { success: false, error: 'Topic ID is required' }
  }

  if (!data.title?.trim()) {
    return { success: false, error: 'Title is required' }
  }

  // Verify topic exists
  const topic = getTopicById(data.topic_id)
  if (!topic) {
    return { success: false, error: 'Topic not found' }
  }

  const id = generateId()
  const now = new Date().toISOString()

  try {
    db.prepare(`
      INSERT INTO records (id, topic_id, subcategory_id, type, title, content, email_id, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.topic_id,
      data.subcategory_id || null,
      data.type || 'note',
      data.title.trim(),
      data.content?.trim() || null,
      data.email_id || null,
      userId,
      now,
      now
    )

    // Update topic's updated_at
    db.prepare('UPDATE topics SET updated_at = ? WHERE id = ?').run(now, data.topic_id)

    const record: Record = {
      id,
      topic_id: data.topic_id,
      subcategory_id: data.subcategory_id || null,
      type: data.type || 'note',
      title: data.title.trim(),
      content: data.content?.trim() || null,
      email_id: data.email_id || null,
      created_by: userId,
      created_at: now,
      updated_at: now,
      deleted_at: null
    }

    // Get subcategory title if applicable
    let subcategoryTitle: string | undefined
    if (data.subcategory_id) {
      const subcat = db.prepare('SELECT title FROM subcategories WHERE id = ?').get(data.subcategory_id) as { title: string } | undefined
      subcategoryTitle = subcat?.title
    }

    logAudit(
      'RECORD_CREATE',
      userId,
      getUsername(userId),
      'record',
      id,
      { title: record.title, type: record.type, topic_id: data.topic_id, topic_title: topic.title, subcategory_id: data.subcategory_id, subcategory_title: subcategoryTitle }
    )

    return { success: true, record }
  } catch (error) {
    console.error('Error creating record:', error)
    return { success: false, error: 'Failed to create record' }
  }
}

export function getRecordsByTopic(topicId: string, subcategoryId?: string | null): Record[] {
  const db = getDatabase()

  let sql = `
    SELECT
      r.*,
      u.display_name as creator_name,
      e.subject as email_subject,
      s.title as subcategory_title
    FROM records r
    LEFT JOIN users u ON r.created_by = u.id
    LEFT JOIN emails e ON r.email_id = e.id
    LEFT JOIN subcategories s ON r.subcategory_id = s.id
    WHERE r.topic_id = ? AND r.deleted_at IS NULL
  `

  const params: unknown[] = [topicId]

  // Filter by subcategory if specified
  if (subcategoryId === null) {
    // Only general (no subcategory)
    sql += ' AND r.subcategory_id IS NULL'
  } else if (subcategoryId) {
    // Specific subcategory
    sql += ' AND r.subcategory_id = ?'
    params.push(subcategoryId)
  }
  // If subcategoryId is undefined, get all records for the topic

  sql += ' ORDER BY r.created_at DESC'

  const records = db.prepare(sql).all(...params) as Record[]

  return records
}

export function getRecordById(id: string): Record | null {
  const db = getDatabase()

  const record = db.prepare(`
    SELECT
      r.*,
      u.display_name as creator_name,
      e.subject as email_subject
    FROM records r
    LEFT JOIN users u ON r.created_by = u.id
    LEFT JOIN emails e ON r.email_id = e.id
    WHERE r.id = ? AND r.deleted_at IS NULL
  `).get(id) as Record | undefined

  return record || null
}

export function updateRecord(
  id: string,
  data: UpdateRecordData,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = getRecordById(id)
  if (!existing) {
    return { success: false, error: 'Record not found' }
  }

  const fields: string[] = []
  const values: unknown[] = []
  const changes: globalThis.Record<string, unknown> = {}

  if (data.title !== undefined) {
    if (!data.title.trim()) {
      return { success: false, error: 'Title cannot be empty' }
    }
    fields.push('title = ?')
    values.push(data.title.trim())
    changes.title = { from: existing.title, to: data.title.trim() }
  }

  if (data.content !== undefined) {
    fields.push('content = ?')
    values.push(data.content?.trim() || null)
    changes.content = { from: existing.content, to: data.content?.trim() || null }
  }

  if (data.type !== undefined) {
    fields.push('type = ?')
    values.push(data.type)
    changes.type = { from: existing.type, to: data.type }
  }

  if (data.subcategory_id !== undefined) {
    fields.push('subcategory_id = ?')
    values.push(data.subcategory_id)
    changes.subcategory_id = { from: existing.subcategory_id, to: data.subcategory_id }
  }

  if (fields.length === 0) {
    return { success: false, error: 'No updates provided' }
  }

  const now = new Date().toISOString()
  fields.push('updated_at = ?')
  values.push(now)
  values.push(id)

  try {
    db.prepare(`UPDATE records SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    // Update topic's updated_at
    db.prepare('UPDATE topics SET updated_at = ? WHERE id = ?').run(now, existing.topic_id)

    logAudit(
      'RECORD_UPDATE',
      userId,
      getUsername(userId),
      'record',
      id,
      { changes, record_title: existing.title, topic_id: existing.topic_id }
    )

    return { success: true }
  } catch (error) {
    console.error('Error updating record:', error)
    return { success: false, error: 'Failed to update record' }
  }
}

// Helper function to clean up empty timeline folders after email deletion
function cleanupEmptyTimelineFolders(emailStoragePath: string): void {
  const emailsBasePath = getEmailsPath()

  try {
    // The email storage path is like: Emails/2026/02/02/email-id
    // After deleting the email folder, check if day/month/year folders are empty
    const dayFolder = path.dirname(emailStoragePath)
    const monthFolder = path.dirname(dayFolder)
    const yearFolder = path.dirname(monthFolder)

    // Check and remove empty day folder
    if (fs.existsSync(dayFolder) && dayFolder !== emailsBasePath) {
      const dayContents = fs.readdirSync(dayFolder)
      if (dayContents.length === 0) {
        fs.rmdirSync(dayFolder)

        // Check and remove empty month folder
        if (fs.existsSync(monthFolder) && monthFolder !== emailsBasePath) {
          const monthContents = fs.readdirSync(monthFolder)
          if (monthContents.length === 0) {
            fs.rmdirSync(monthFolder)

            // Check and remove empty year folder
            if (fs.existsSync(yearFolder) && yearFolder !== emailsBasePath) {
              const yearContents = fs.readdirSync(yearFolder)
              if (yearContents.length === 0) {
                fs.rmdirSync(yearFolder)
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning up empty timeline folders:', error)
    // Non-critical error, don't throw
  }
}

export function deleteRecord(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = getRecordById(id)
  if (!existing) {
    return { success: false, error: 'Record not found' }
  }

  const now = new Date().toISOString()

  try {
    // 1. Delete all attachments (files + DB records)
    const attachments = getAttachmentsByRecordId(id)
    for (const attachment of attachments) {
      deleteAttachment(attachment.id, userId)
    }

    // 2. Delete any reminders associated with this record
    db.prepare('DELETE FROM reminders WHERE record_id = ?').run(id)

    // 3. Delete linked email storage if exists
    let emailDeleted = false
    if (existing.email_id) {
      // Get the email storage path from the database
      const email = db.prepare('SELECT storage_path FROM emails WHERE id = ?').get(existing.email_id) as { storage_path: string } | undefined

      if (email && email.storage_path) {
        const emailStoragePath = path.join(getEmailsPath(), email.storage_path)

        if (fs.existsSync(emailStoragePath)) {
          // Delete the email folder and its contents
          fs.rmSync(emailStoragePath, { recursive: true, force: true })
          emailDeleted = true

          // Clean up empty timeline folders (day/month/year)
          cleanupEmptyTimelineFolders(emailStoragePath)
        }

        // Clear the email_id foreign key reference first to avoid constraint violation
        db.prepare('UPDATE records SET email_id = NULL WHERE id = ?').run(id)

        // Now delete the email record from the database
        db.prepare('DELETE FROM emails WHERE id = ?').run(existing.email_id)
      }
    }

    // 4. Soft delete the record
    db.prepare('UPDATE records SET deleted_at = ?, updated_at = ? WHERE id = ?')
      .run(now, now, id)

    logAudit(
      'RECORD_DELETE',
      userId,
      getUsername(userId),
      'record',
      id,
      {
        record_title: existing.title,
        topic_id: existing.topic_id,
        attachments_deleted: attachments.length,
        had_email: existing.email_id ? true : false,
        email_deleted: emailDeleted
      }
    )

    return { success: true }
  } catch (error) {
    console.error('Error deleting record:', error)
    return { success: false, error: 'Failed to delete record' }
  }
}

export function searchRecords(query: string, topicId?: string): Record[] {
  const db = getDatabase()

  if (!query.trim()) {
    return topicId ? getRecordsByTopic(topicId) : []
  }

  let sql = `
    SELECT
      r.*,
      u.display_name as creator_name,
      e.subject as email_subject
    FROM records r
    LEFT JOIN users u ON r.created_by = u.id
    LEFT JOIN emails e ON r.email_id = e.id
    WHERE r.deleted_at IS NULL
      AND r.id IN (
        SELECT rowid FROM records_fts WHERE records_fts MATCH ?
      )
  `

  const params: unknown[] = [`${query}*`]

  if (topicId) {
    sql += ' AND r.topic_id = ?'
    params.push(topicId)
  }

  sql += ' ORDER BY r.created_at DESC'

  const records = db.prepare(sql).all(...params) as Record[]

  return records
}

export function getRecordsByType(type: string, topicId?: string): Record[] {
  const db = getDatabase()

  let sql = `
    SELECT
      r.*,
      u.display_name as creator_name,
      e.subject as email_subject
    FROM records r
    LEFT JOIN users u ON r.created_by = u.id
    LEFT JOIN emails e ON r.email_id = e.id
    WHERE r.type = ? AND r.deleted_at IS NULL
  `

  const params: unknown[] = [type]

  if (topicId) {
    sql += ' AND r.topic_id = ?'
    params.push(topicId)
  }

  sql += ' ORDER BY r.created_at DESC'

  const records = db.prepare(sql).all(...params) as Record[]

  return records
}

export function getRecordStats(topicId?: string): {
  total: number
  byType: globalThis.Record<string, number>
  recentRecords: Record[]
} {
  const db = getDatabase()

  let whereClause = 'WHERE deleted_at IS NULL'
  const params: unknown[] = []

  if (topicId) {
    whereClause += ' AND topic_id = ?'
    params.push(topicId)
  }

  const total = (db.prepare(
    `SELECT COUNT(*) as count FROM records ${whereClause}`
  ).get(...params) as { count: number }).count

  const byType = db.prepare(`
    SELECT type, COUNT(*) as count FROM records
    ${whereClause}
    GROUP BY type
  `).all(...params) as { type: string; count: number }[]

  const recentRecords = db.prepare(`
    SELECT
      r.*,
      u.display_name as creator_name
    FROM records r
    LEFT JOIN users u ON r.created_by = u.id
    ${whereClause}
    ORDER BY r.created_at DESC
    LIMIT 5
  `).all(...params) as Record[]

  return {
    total,
    byType: Object.fromEntries(byType.map(t => [t.type, t.count])),
    recentRecords
  }
}
