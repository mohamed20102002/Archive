import * as fs from 'fs'
import * as path from 'path'
import { getDatabase } from '../database/connection'
import { getEmailsPath } from '../database/connection'
import { logAudit } from '../database/audit'
import { generateId } from '../utils/crypto'
import { getUsername } from './auth.service'
import { getAttachmentsByRecordId, deleteAttachment } from './record-attachment.service'
import { getBasePath, sanitizeFilename } from '../utils/fileSystem'

export interface Topic {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  record_count?: number
  last_activity?: string
  creator_name?: string
}

export interface CreateTopicData {
  title: string
  description?: string
  status?: string
  priority?: string
}

export interface UpdateTopicData {
  title?: string
  description?: string
  status?: string
  priority?: string
}

export function createTopic(
  data: CreateTopicData,
  userId: string
): { success: boolean; topic?: Topic; error?: string } {
  const db = getDatabase()

  if (!data.title?.trim()) {
    return { success: false, error: 'Title is required' }
  }

  const id = generateId()
  const now = new Date().toISOString()

  try {
    db.prepare(`
      INSERT INTO topics (id, title, description, status, priority, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.title.trim(),
      data.description?.trim() || null,
      data.status || 'active',
      data.priority || 'normal',
      userId,
      now,
      now
    )

    const topic: Topic = {
      id,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      status: data.status || 'active',
      priority: data.priority || 'normal',
      created_by: userId,
      created_at: now,
      updated_at: now,
      deleted_at: null
    }

    logAudit(
      'TOPIC_CREATE',
      userId,
      getUsername(userId),
      'topic',
      id,
      { title: topic.title, status: topic.status, priority: topic.priority }
    )

    return { success: true, topic }
  } catch (error) {
    console.error('Error creating topic:', error)
    return { success: false, error: 'Failed to create topic' }
  }
}

export interface TopicFilters {
  query?: string
  status?: string
  priority?: string
  limit?: number
  offset?: number
}

export interface PaginatedTopics {
  data: Topic[]
  total: number
  hasMore: boolean
}

export function getAllTopics(filters?: TopicFilters): PaginatedTopics {
  const db = getDatabase()

  const conditions: string[] = ['t.deleted_at IS NULL']
  const values: unknown[] = []

  if (filters?.query?.trim()) {
    conditions.push("(t.title LIKE ? OR t.description LIKE ?)")
    const q = `%${filters.query.trim()}%`
    values.push(q, q)
  }

  if (filters?.status) {
    conditions.push('t.status = ?')
    values.push(filters.status)
  }

  if (filters?.priority) {
    conditions.push('t.priority = ?')
    values.push(filters.priority)
  }

  const whereClause = conditions.join(' AND ')

  // Get total count first
  const countResult = db.prepare(`
    SELECT COUNT(*) as count FROM topics t WHERE ${whereClause}
  `).get(...values) as { count: number }
  const total = countResult.count

  // Build main query with pagination
  let query = `
    SELECT
      t.*,
      u.display_name as creator_name,
      (SELECT COUNT(*) FROM records r WHERE r.topic_id = t.id AND r.deleted_at IS NULL) as record_count,
      (SELECT MAX(r.created_at) FROM records r WHERE r.topic_id = t.id AND r.deleted_at IS NULL) as last_activity
    FROM topics t
    LEFT JOIN users u ON t.created_by = u.id
    WHERE ${whereClause}
    ORDER BY t.updated_at DESC
  `

  const queryValues = [...values]

  if (filters?.limit) {
    query += ' LIMIT ?'
    queryValues.push(filters.limit)
    if (filters?.offset) {
      query += ' OFFSET ?'
      queryValues.push(filters.offset)
    }
  }

  const topics = db.prepare(query).all(...queryValues) as Topic[]

  const hasMore = filters?.limit ? (filters.offset || 0) + topics.length < total : false

  return { data: topics, total, hasMore }
}

export function getTopicById(id: string): Topic | null {
  const db = getDatabase()

  const topic = db.prepare(`
    SELECT
      t.*,
      u.display_name as creator_name,
      (SELECT COUNT(*) FROM records r WHERE r.topic_id = t.id AND r.deleted_at IS NULL) as record_count,
      (SELECT MAX(r.created_at) FROM records r WHERE r.topic_id = t.id AND r.deleted_at IS NULL) as last_activity
    FROM topics t
    LEFT JOIN users u ON t.created_by = u.id
    WHERE t.id = ? AND t.deleted_at IS NULL
  `).get(id) as Topic | undefined

  return topic || null
}

export function updateTopic(
  id: string,
  data: UpdateTopicData,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = getTopicById(id)
  if (!existing) {
    return { success: false, error: 'Topic not found' }
  }

  const fields: string[] = []
  const values: unknown[] = []
  const changes: Record<string, unknown> = {}

  if (data.title !== undefined) {
    if (!data.title.trim()) {
      return { success: false, error: 'Title cannot be empty' }
    }
    fields.push('title = ?')
    values.push(data.title.trim())
    changes.title = { from: existing.title, to: data.title.trim() }
  }

  if (data.description !== undefined) {
    fields.push('description = ?')
    values.push(data.description?.trim() || null)
    changes.description = { from: existing.description, to: data.description?.trim() || null }
  }

  if (data.status !== undefined) {
    fields.push('status = ?')
    values.push(data.status)
    changes.status = { from: existing.status, to: data.status }
  }

  if (data.priority !== undefined) {
    fields.push('priority = ?')
    values.push(data.priority)
    changes.priority = { from: existing.priority, to: data.priority }
  }

  if (fields.length === 0) {
    return { success: false, error: 'No updates provided' }
  }

  fields.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id)

  try {
    db.prepare(`UPDATE topics SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    logAudit(
      'TOPIC_UPDATE',
      userId,
      getUsername(userId),
      'topic',
      id,
      { changes, topic_title: existing.title }
    )

    return { success: true }
  } catch (error) {
    console.error('Error updating topic:', error)
    return { success: false, error: 'Failed to update topic' }
  }
}

export function deleteTopic(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = getTopicById(id)
  if (!existing) {
    return { success: false, error: 'Topic not found' }
  }

  const now = new Date().toISOString()

  try {
    // Get all records for this topic (including already soft-deleted ones for full cleanup)
    const records = db.prepare(`
      SELECT r.id, r.email_id, e.storage_path
      FROM records r
      LEFT JOIN emails e ON r.email_id = e.id
      WHERE r.topic_id = ?
    `).all(id) as { id: string; email_id: string | null; storage_path: string | null }[]

    let attachmentsDeleted = 0
    let emailsDeleted = 0

    // Clean up each record's associated files
    for (const record of records) {
      // 1. Delete all record attachments (files + DB entries)
      const attachments = getAttachmentsByRecordId(record.id)
      for (const attachment of attachments) {
        deleteAttachment(attachment.id, userId)
        attachmentsDeleted++
      }

      // 2. Delete archived email files and DB entry if exists
      if (record.email_id && record.storage_path) {
        // Delete email storage files
        const emailStoragePath = path.join(getEmailsPath(), record.storage_path)
        if (fs.existsSync(emailStoragePath)) {
          fs.rmSync(emailStoragePath, { recursive: true, force: true })

          // Clean up empty parent date folders (day -> month -> year)
          let parentPath = path.dirname(emailStoragePath)
          for (let i = 0; i < 3; i++) { // day, month, year
            if (fs.existsSync(parentPath) && parentPath !== getEmailsPath()) {
              const items = fs.readdirSync(parentPath)
              if (items.length === 0) {
                fs.rmdirSync(parentPath)
                parentPath = path.dirname(parentPath)
              } else {
                break
              }
            } else {
              break
            }
          }
        }
        // Clear references to this email from records, letters and issues
        db.prepare('UPDATE records SET email_id = NULL WHERE email_id = ?').run(record.email_id)
        db.prepare('UPDATE letters SET email_id = NULL WHERE email_id = ?').run(record.email_id)
        db.prepare('UPDATE issues SET linked_email_id = NULL WHERE linked_email_id = ?').run(record.email_id)

        // Delete email DB record
        db.prepare('DELETE FROM emails WHERE id = ?').run(record.email_id)
        emailsDeleted++
      }

      // 3. Delete reminders associated with this record
      db.prepare('DELETE FROM reminders WHERE record_id = ?').run(record.id)
    }

    // 4. Delete all reminders directly linked to this topic (not via record)
    db.prepare('DELETE FROM reminders WHERE topic_id = ? AND record_id IS NULL').run(id)

    // 5. Keep MOM record links - they will show as "deleted" in the MOM view
    // The LEFT JOIN in getLinkedRecords will return NULL for deleted records

    // 6. Clear issue links to records from this topic (set to NULL instead of delete)
    for (const record of records) {
      db.prepare('UPDATE issues SET linked_record_id = NULL WHERE linked_record_id = ?').run(record.id)
    }

    // 7. Get subcategories FIRST, then clear ALL references to them before any deletions
    const topicSubcategories = db.prepare('SELECT id FROM subcategories WHERE topic_id = ?').all(id) as { id: string }[]
    for (const sub of topicSubcategories) {
      db.prepare('UPDATE records SET subcategory_id = NULL WHERE subcategory_id = ?').run(sub.id)
      db.prepare('UPDATE letters SET subcategory_id = NULL WHERE subcategory_id = ?').run(sub.id)
      db.prepare('UPDATE issues SET subcategory_id = NULL WHERE subcategory_id = ?').run(sub.id)
    }

    // 8. Hard delete all records
    // Disable FK checks to handle edge cases from restored backups
    db.pragma('foreign_keys = OFF')
    try {
      db.prepare('DELETE FROM records WHERE topic_id = ?').run(id)
    } finally {
      db.pragma('foreign_keys = ON')
    }

    // 9. Delete issue history, history records, comment edits, then issues
    const topicIssues = db.prepare('SELECT id FROM issues WHERE topic_id = ?').all(id) as { id: string }[]
    for (const issue of topicIssues) {
      const historyEntries = db.prepare('SELECT id FROM issue_history WHERE issue_id = ?').all(issue.id) as { id: string }[]
      for (const history of historyEntries) {
        db.prepare('DELETE FROM issue_history_records WHERE history_id = ?').run(history.id)
        db.prepare('DELETE FROM comment_edits WHERE history_id = ?').run(history.id)
      }
      db.prepare('DELETE FROM issue_history WHERE issue_id = ?').run(issue.id)
    }

    // Delete issues - disable FK checks for edge cases
    db.pragma('foreign_keys = OFF')
    try {
      db.prepare('DELETE FROM issues WHERE topic_id = ?').run(id)
    } finally {
      db.pragma('foreign_keys = ON')
    }

    // 10. Soft-delete letters linked to this topic
    const now2 = new Date().toISOString()
    db.prepare('UPDATE letters SET deleted_at = ?, updated_at = ? WHERE topic_id = ? AND deleted_at IS NULL').run(now2, now2, id)

    // 11. Delete MOM topic links
    db.prepare('DELETE FROM mom_topic_links WHERE topic_id = ?').run(id)

    // 12. Delete all subcategories - disable FK checks for edge cases
    db.pragma('foreign_keys = OFF')
    try {
      db.prepare('DELETE FROM subcategories WHERE topic_id = ?').run(id)
    } finally {
      db.pragma('foreign_keys = ON')
    }

    // 13. Soft delete the topic (keep for audit trail)
    db.prepare('UPDATE topics SET deleted_at = ?, updated_at = ? WHERE id = ?')
      .run(now, now, id)

    // 14. Clean up topic folder in data/topics/ if it exists and is empty
    const sanitizedTopicTitle = sanitizeFilename(existing.title)
    const topicFolderPath = path.join(getBasePath(), 'data', 'topics', sanitizedTopicTitle)
    if (fs.existsSync(topicFolderPath)) {
      try {
        // Check if folder is empty or only has empty subfolders
        const isEmpty = (dir: string): boolean => {
          const items = fs.readdirSync(dir)
          for (const item of items) {
            const itemPath = path.join(dir, item)
            const stat = fs.statSync(itemPath)
            if (stat.isDirectory()) {
              if (!isEmpty(itemPath)) return false
            } else {
              return false // Has a file
            }
          }
          return true
        }

        if (isEmpty(topicFolderPath)) {
          fs.rmSync(topicFolderPath, { recursive: true, force: true })
        }
      } catch (err) {
        console.warn('Could not clean up topic folder:', err)
      }
    }

    logAudit(
      'TOPIC_DELETE',
      userId,
      getUsername(userId),
      'topic',
      id,
      {
        topic_title: existing.title,
        records_deleted: records.length,
        attachments_deleted: attachmentsDeleted,
        emails_deleted: emailsDeleted
      }
    )

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting topic:', error)
    // Provide more specific error message
    let errorMessage = 'Failed to delete topic'
    if (error.code === 'SQLITE_CONSTRAINT') {
      errorMessage = `Database constraint error: ${error.message}`
    } else if (error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'EACCES') {
      errorMessage = `File access error: ${error.message}. Some files may be in use.`
    } else if (error.message) {
      errorMessage = `Error: ${error.message}`
    }
    return { success: false, error: errorMessage }
  }
}

export function searchTopics(query: string): Topic[] {
  const db = getDatabase()

  if (!query.trim()) {
    return getAllTopics()
  }

  const topics = db.prepare(`
    SELECT
      t.*,
      u.display_name as creator_name,
      (SELECT COUNT(*) FROM records r WHERE r.topic_id = t.id AND r.deleted_at IS NULL) as record_count,
      (SELECT MAX(r.created_at) FROM records r WHERE r.topic_id = t.id AND r.deleted_at IS NULL) as last_activity
    FROM topics t
    LEFT JOIN users u ON t.created_by = u.id
    WHERE t.deleted_at IS NULL
      AND t.id IN (
        SELECT rowid FROM topics_fts WHERE topics_fts MATCH ?
      )
    ORDER BY t.updated_at DESC
  `).all(`${query}*`) as Topic[]

  return topics
}

export function getTopicsByStatus(status: string): Topic[] {
  const db = getDatabase()

  const topics = db.prepare(`
    SELECT
      t.*,
      u.display_name as creator_name,
      (SELECT COUNT(*) FROM records r WHERE r.topic_id = t.id AND r.deleted_at IS NULL) as record_count,
      (SELECT MAX(r.created_at) FROM records r WHERE r.topic_id = t.id AND r.deleted_at IS NULL) as last_activity
    FROM topics t
    LEFT JOIN users u ON t.created_by = u.id
    WHERE t.status = ? AND t.deleted_at IS NULL
    ORDER BY t.updated_at DESC
  `).all(status) as Topic[]

  return topics
}

export function getTopicStats(): {
  total: number
  byStatus: Record<string, number>
  byPriority: Record<string, number>
  recentlyUpdated: Topic[]
} {
  const db = getDatabase()

  const total = (db.prepare(
    'SELECT COUNT(*) as count FROM topics WHERE deleted_at IS NULL'
  ).get() as { count: number }).count

  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM topics
    WHERE deleted_at IS NULL
    GROUP BY status
  `).all() as { status: string; count: number }[]

  const byPriority = db.prepare(`
    SELECT priority, COUNT(*) as count FROM topics
    WHERE deleted_at IS NULL
    GROUP BY priority
  `).all() as { priority: string; count: number }[]

  const recentlyUpdated = db.prepare(`
    SELECT * FROM topics
    WHERE deleted_at IS NULL
    ORDER BY updated_at DESC
    LIMIT 5
  `).all() as Topic[]

  return {
    total,
    byStatus: Object.fromEntries(byStatus.map(s => [s.status, s.count])),
    byPriority: Object.fromEntries(byPriority.map(p => [p.priority, p.count])),
    recentlyUpdated
  }
}
