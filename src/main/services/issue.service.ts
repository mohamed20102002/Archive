import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'
import { generateId } from '../utils/crypto'
import { getUsername } from './auth.service'

// Types

export interface Issue {
  id: string
  title: string
  description: string | null
  topic_id: string | null
  subcategory_id: string | null
  importance: string
  status: string
  closure_note: string | null
  completed_at: string | null
  completed_by: string | null
  reminder_date: string | null
  reminder_notified: number
  created_by: string
  created_at: string
  updated_at: string
  topic_title?: string
  subcategory_title?: string
  creator_name?: string
  completer_name?: string
}

export interface IssueHistory {
  id: string
  issue_id: string
  action: string
  field_name: string | null
  old_value: string | null
  new_value: string | null
  comment: string | null
  created_by: string
  created_at: string
  creator_name?: string
}

export interface CreateIssueData {
  title: string
  description?: string
  topic_id?: string
  subcategory_id?: string
  importance?: string
  reminder_date?: string
}

export interface UpdateIssueData {
  title?: string
  description?: string
  topic_id?: string
  subcategory_id?: string
  importance?: string
  reminder_date?: string | null
}

export interface IssueFilters {
  query?: string
  topic_id?: string
  importance?: string
  has_reminder?: boolean
  min_age_days?: number
}

// Helper: add a history entry
function addHistory(
  issueId: string,
  action: string,
  userId: string,
  fieldName?: string | null,
  oldValue?: string | null,
  newValue?: string | null,
  comment?: string | null
): void {
  const db = getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO issue_history (id, issue_id, action, field_name, old_value, new_value, comment, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, issueId, action, fieldName || null, oldValue || null, newValue || null, comment || null, userId, now)
}

// Create issue
export function createIssue(
  data: CreateIssueData,
  userId: string
): { success: boolean; issue?: Issue; error?: string } {
  const db = getDatabase()

  if (!data.title?.trim()) {
    return { success: false, error: 'Title is required' }
  }

  const id = generateId()
  const now = new Date().toISOString()
  const importance = data.importance || 'medium'

  try {
    db.prepare(`
      INSERT INTO issues (
        id, title, description, topic_id, subcategory_id, importance,
        status, reminder_date, reminder_notified, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, 0, ?, ?, ?)
    `).run(
      id,
      data.title.trim(),
      data.description?.trim() || null,
      data.topic_id || null,
      data.subcategory_id || null,
      importance,
      data.reminder_date || null,
      userId,
      now,
      now
    )

    // Add creation history entry
    addHistory(id, 'created', userId)

    logAudit(
      'ISSUE_CREATE',
      userId,
      getUsername(userId),
      'issue',
      id,
      { title: data.title.trim(), importance, topic_id: data.topic_id || null }
    )

    const issue = getIssueById(id)
    return { success: true, issue: issue || undefined }
  } catch (error) {
    console.error('Error creating issue:', error)
    return { success: false, error: 'Failed to create issue' }
  }
}

// Get issue by ID
export function getIssueById(id: string): Issue | null {
  const db = getDatabase()

  const issue = db.prepare(`
    SELECT
      i.*,
      t.title as topic_title,
      s.title as subcategory_title,
      u.display_name as creator_name,
      u2.display_name as completer_name
    FROM issues i
    LEFT JOIN topics t ON i.topic_id = t.id
    LEFT JOIN subcategories s ON i.subcategory_id = s.id
    LEFT JOIN users u ON i.created_by = u.id
    LEFT JOIN users u2 ON i.completed_by = u2.id
    WHERE i.id = ?
  `).get(id) as Issue | undefined

  return issue || null
}

// Get open issues with optional filters
export function getOpenIssues(filters?: IssueFilters): Issue[] {
  const db = getDatabase()

  const conditions: string[] = ["i.status = 'open'"]
  const values: unknown[] = []

  if (filters?.query?.trim()) {
    conditions.push("(i.title LIKE ? OR i.description LIKE ?)")
    const q = `%${filters.query.trim()}%`
    values.push(q, q)
  }

  if (filters?.topic_id) {
    conditions.push("i.topic_id = ?")
    values.push(filters.topic_id)
  }

  if (filters?.importance) {
    conditions.push("i.importance = ?")
    values.push(filters.importance)
  }

  if (filters?.has_reminder === true) {
    conditions.push("i.reminder_date IS NOT NULL")
  } else if (filters?.has_reminder === false) {
    conditions.push("i.reminder_date IS NULL")
  }

  if (filters?.min_age_days && filters.min_age_days > 0) {
    conditions.push("julianday('now') - julianday(i.created_at) >= ?")
    values.push(filters.min_age_days)
  }

  const whereClause = conditions.join(' AND ')

  const issues = db.prepare(`
    SELECT
      i.*,
      t.title as topic_title,
      s.title as subcategory_title,
      u.display_name as creator_name,
      u2.display_name as completer_name
    FROM issues i
    LEFT JOIN topics t ON i.topic_id = t.id
    LEFT JOIN subcategories s ON i.subcategory_id = s.id
    LEFT JOIN users u ON i.created_by = u.id
    LEFT JOIN users u2 ON i.completed_by = u2.id
    WHERE ${whereClause}
    ORDER BY
      CASE i.importance
        WHEN 'critical' THEN 0
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
      END ASC,
      i.created_at DESC
  `).all(...values) as Issue[]

  return issues
}

// Get completed issues with optional filters
export function getCompletedIssues(filters?: IssueFilters): Issue[] {
  const db = getDatabase()

  const conditions: string[] = ["i.status = 'completed'"]
  const values: unknown[] = []

  if (filters?.query?.trim()) {
    conditions.push("(i.title LIKE ? OR i.description LIKE ?)")
    const q = `%${filters.query.trim()}%`
    values.push(q, q)
  }

  if (filters?.topic_id) {
    conditions.push("i.topic_id = ?")
    values.push(filters.topic_id)
  }

  if (filters?.importance) {
    conditions.push("i.importance = ?")
    values.push(filters.importance)
  }

  const whereClause = conditions.join(' AND ')

  const issues = db.prepare(`
    SELECT
      i.*,
      t.title as topic_title,
      s.title as subcategory_title,
      u.display_name as creator_name,
      u2.display_name as completer_name
    FROM issues i
    LEFT JOIN topics t ON i.topic_id = t.id
    LEFT JOIN subcategories s ON i.subcategory_id = s.id
    LEFT JOIN users u ON i.created_by = u.id
    LEFT JOIN users u2 ON i.completed_by = u2.id
    WHERE ${whereClause}
    ORDER BY i.completed_at DESC
  `).all(...values) as Issue[]

  return issues
}

// Update issue fields
export function updateIssue(
  id: string,
  data: UpdateIssueData,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = getIssueById(id)
  if (!existing) {
    return { success: false, error: 'Issue not found' }
  }

  const fields: string[] = []
  const values: unknown[] = []

  if (data.title !== undefined) {
    if (!data.title.trim()) {
      return { success: false, error: 'Title cannot be empty' }
    }
    if (data.title.trim() !== existing.title) {
      fields.push('title = ?')
      values.push(data.title.trim())
      addHistory(id, 'field_edit', userId, 'title', existing.title, data.title.trim())
    }
  }

  if (data.description !== undefined) {
    const newDesc = data.description?.trim() || null
    if (newDesc !== existing.description) {
      fields.push('description = ?')
      values.push(newDesc)
      addHistory(id, 'field_edit', userId, 'description', existing.description, newDesc)
    }
  }

  if (data.topic_id !== undefined) {
    const newTopic = data.topic_id || null
    if (newTopic !== existing.topic_id) {
      fields.push('topic_id = ?')
      values.push(newTopic)
      addHistory(id, 'field_edit', userId, 'topic_id', existing.topic_id, newTopic)
    }
  }

  if (data.subcategory_id !== undefined) {
    const newSub = data.subcategory_id || null
    if (newSub !== existing.subcategory_id) {
      fields.push('subcategory_id = ?')
      values.push(newSub)
      addHistory(id, 'field_edit', userId, 'subcategory_id', existing.subcategory_id, newSub)
    }
  }

  if (data.importance !== undefined && data.importance !== existing.importance) {
    fields.push('importance = ?')
    values.push(data.importance)
    addHistory(id, 'importance_change', userId, 'importance', existing.importance, data.importance)
  }

  if (data.reminder_date !== undefined) {
    const newReminder = data.reminder_date || null
    if (newReminder !== existing.reminder_date) {
      fields.push('reminder_date = ?')
      values.push(newReminder)
      // Reset notified flag when reminder changes
      fields.push('reminder_notified = 0')
      addHistory(id, 'reminder_change', userId, 'reminder_date', existing.reminder_date, newReminder)
    }
  }

  if (fields.length === 0) {
    return { success: true }
  }

  fields.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id)

  try {
    db.prepare(`UPDATE issues SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    logAudit(
      'ISSUE_UPDATE',
      userId,
      getUsername(userId),
      'issue',
      id,
      { title: existing.title }
    )

    return { success: true }
  } catch (error) {
    console.error('Error updating issue:', error)
    return { success: false, error: 'Failed to update issue' }
  }
}

// Close issue
export function closeIssue(
  id: string,
  closureNote: string | null,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = getIssueById(id)
  if (!existing) {
    return { success: false, error: 'Issue not found' }
  }

  if (existing.status === 'completed') {
    return { success: false, error: 'Issue is already completed' }
  }

  const now = new Date().toISOString()

  try {
    db.prepare(`
      UPDATE issues
      SET status = 'completed', closure_note = ?, completed_at = ?, completed_by = ?, updated_at = ?
      WHERE id = ?
    `).run(closureNote?.trim() || null, now, userId, now, id)

    addHistory(id, 'status_change', userId, 'status', 'open', 'completed')
    if (closureNote?.trim()) {
      addHistory(id, 'closure_note', userId, null, null, null, closureNote.trim())
    }

    logAudit(
      'ISSUE_CLOSE',
      userId,
      getUsername(userId),
      'issue',
      id,
      { title: existing.title, closure_note: closureNote?.trim() || null }
    )

    return { success: true }
  } catch (error) {
    console.error('Error closing issue:', error)
    return { success: false, error: 'Failed to close issue' }
  }
}

// Reopen issue
export function reopenIssue(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = getIssueById(id)
  if (!existing) {
    return { success: false, error: 'Issue not found' }
  }

  if (existing.status === 'open') {
    return { success: false, error: 'Issue is already open' }
  }

  const now = new Date().toISOString()

  try {
    db.prepare(`
      UPDATE issues
      SET status = 'open', closure_note = NULL, completed_at = NULL, completed_by = NULL, updated_at = ?
      WHERE id = ?
    `).run(now, id)

    addHistory(id, 'status_change', userId, 'status', 'completed', 'open')

    logAudit(
      'ISSUE_REOPEN',
      userId,
      getUsername(userId),
      'issue',
      id,
      { title: existing.title }
    )

    return { success: true }
  } catch (error) {
    console.error('Error reopening issue:', error)
    return { success: false, error: 'Failed to reopen issue' }
  }
}

// Add comment
export function addComment(
  issueId: string,
  comment: string,
  userId: string
): { success: boolean; error?: string } {
  if (!comment?.trim()) {
    return { success: false, error: 'Comment cannot be empty' }
  }

  const existing = getIssueById(issueId)
  if (!existing) {
    return { success: false, error: 'Issue not found' }
  }

  try {
    addHistory(issueId, 'comment', userId, null, null, null, comment.trim())

    // Update the updated_at timestamp
    const db = getDatabase()
    db.prepare('UPDATE issues SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), issueId)

    logAudit(
      'ISSUE_COMMENT',
      userId,
      getUsername(userId),
      'issue',
      issueId,
      { title: existing.title, comment: comment.trim() }
    )

    return { success: true }
  } catch (error) {
    console.error('Error adding comment:', error)
    return { success: false, error: 'Failed to add comment' }
  }
}

// Get issue history
export function getIssueHistory(issueId: string): IssueHistory[] {
  const db = getDatabase()

  const history = db.prepare(`
    SELECT
      h.*,
      u.display_name as creator_name
    FROM issue_history h
    LEFT JOIN users u ON h.created_by = u.id
    WHERE h.issue_id = ?
    ORDER BY h.created_at ASC
  `).all(issueId) as IssueHistory[]

  return history
}

// Get issue stats
export function getIssueStats(): {
  totalOpen: number
  totalCompleted: number
  byImportance: Record<string, number>
  overdueReminders: number
} {
  const db = getDatabase()

  const totalOpen = (db.prepare(
    "SELECT COUNT(*) as count FROM issues WHERE status = 'open'"
  ).get() as { count: number }).count

  const totalCompleted = (db.prepare(
    "SELECT COUNT(*) as count FROM issues WHERE status = 'completed'"
  ).get() as { count: number }).count

  const importanceStats = db.prepare(
    "SELECT importance, COUNT(*) as count FROM issues WHERE status = 'open' GROUP BY importance"
  ).all() as { importance: string; count: number }[]

  const byImportance: Record<string, number> = {}
  for (const s of importanceStats) {
    byImportance[s.importance] = s.count
  }

  const overdueReminders = (db.prepare(
    "SELECT COUNT(*) as count FROM issues WHERE status = 'open' AND reminder_date IS NOT NULL AND datetime(reminder_date) < datetime('now') AND reminder_notified = 0"
  ).get() as { count: number }).count

  return { totalOpen, totalCompleted, byImportance, overdueReminders }
}

// Get issues with due reminders (past-due, not yet notified — for OS notifications)
export function getIssuesWithDueReminders(): Issue[] {
  const db = getDatabase()

  const issues = db.prepare(`
    SELECT
      i.*,
      t.title as topic_title,
      s.title as subcategory_title,
      u.display_name as creator_name,
      u2.display_name as completer_name
    FROM issues i
    LEFT JOIN topics t ON i.topic_id = t.id
    LEFT JOIN subcategories s ON i.subcategory_id = s.id
    LEFT JOIN users u ON i.created_by = u.id
    LEFT JOIN users u2 ON i.completed_by = u2.id
    WHERE i.status = 'open'
      AND i.reminder_date IS NOT NULL
      AND datetime(i.reminder_date) <= datetime('now')
      AND i.reminder_notified = 0
    ORDER BY i.reminder_date ASC
  `).all() as Issue[]

  return issues
}

// Get all open issues that have a reminder set (both overdue and upcoming)
// Used by the ReminderBadge and ReminderList to show issue reminders
export function getIssuesWithReminders(days?: number): Issue[] {
  const db = getDatabase()

  let query = `
    SELECT
      i.*,
      t.title as topic_title,
      s.title as subcategory_title,
      u.display_name as creator_name,
      u2.display_name as completer_name
    FROM issues i
    LEFT JOIN topics t ON i.topic_id = t.id
    LEFT JOIN subcategories s ON i.subcategory_id = s.id
    LEFT JOIN users u ON i.created_by = u.id
    LEFT JOIN users u2 ON i.completed_by = u2.id
    WHERE i.status = 'open'
      AND i.reminder_date IS NOT NULL
  `

  const values: unknown[] = []

  if (days !== undefined && days > 0) {
    query += ` AND datetime(i.reminder_date) <= datetime('now', '+' || ? || ' days')`
    values.push(days)
  }

  query += ` ORDER BY i.reminder_date ASC`

  const issues = db.prepare(query).all(...values) as Issue[]
  return issues
}

// Mark reminder as notified
export function markReminderNotified(id: string): { success: boolean; error?: string } {
  const db = getDatabase()

  try {
    db.prepare('UPDATE issues SET reminder_notified = 1 WHERE id = ?').run(id)
    return { success: true }
  } catch (error) {
    console.error('Error marking reminder notified:', error)
    return { success: false, error: 'Failed to mark reminder as notified' }
  }
}
