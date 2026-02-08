import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'
import { generateId } from '../utils/crypto'
import { getUsername } from './auth.service'

export interface Reminder {
  id: string
  topic_id: string | null
  record_id: string | null
  title: string
  description: string | null
  due_date: string
  priority: string
  is_completed: boolean
  completed_at: string | null
  completed_by: string | null
  created_by: string
  created_at: string
  updated_at: string
  topic_title?: string
  record_title?: string
  creator_name?: string
  is_overdue?: boolean
}

export interface CreateReminderData {
  topic_id?: string
  record_id?: string
  title: string
  description?: string
  due_date: string
  priority?: string
}

export interface UpdateReminderData {
  title?: string
  description?: string
  due_date?: string
  priority?: string
}

export function createReminder(
  data: CreateReminderData,
  userId: string
): { success: boolean; reminder?: Reminder; error?: string } {
  const db = getDatabase()

  if (!data.title?.trim()) {
    return { success: false, error: 'Title is required' }
  }

  if (!data.due_date) {
    return { success: false, error: 'Due date is required' }
  }

  const id = generateId()
  const now = new Date().toISOString()

  try {
    db.prepare(`
      INSERT INTO reminders (
        id, topic_id, record_id, title, description, due_date, priority,
        is_completed, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).run(
      id,
      data.topic_id || null,
      data.record_id || null,
      data.title.trim(),
      data.description?.trim() || null,
      data.due_date,
      data.priority || 'normal',
      userId,
      now,
      now
    )

    const reminder: Reminder = {
      id,
      topic_id: data.topic_id || null,
      record_id: data.record_id || null,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      due_date: data.due_date,
      priority: data.priority || 'normal',
      is_completed: false,
      completed_at: null,
      completed_by: null,
      created_by: userId,
      created_at: now,
      updated_at: now
    }

    logAudit(
      'REMINDER_CREATE',
      userId,
      getUsername(userId),
      'reminder',
      id,
      { title: reminder.title, due_date: reminder.due_date, priority: reminder.priority }
    )

    return { success: true, reminder }
  } catch (error) {
    console.error('Error creating reminder:', error)
    return { success: false, error: 'Failed to create reminder' }
  }
}

export function getAllReminders(): Reminder[] {
  const db = getDatabase()

  const reminders = db.prepare(`
    SELECT
      r.*,
      t.title as topic_title,
      rec.title as record_title,
      u.display_name as creator_name,
      CASE WHEN r.is_completed = 0 AND datetime(r.due_date) < datetime('now') THEN 1 ELSE 0 END as is_overdue
    FROM reminders r
    LEFT JOIN topics t ON r.topic_id = t.id
    LEFT JOIN records rec ON r.record_id = rec.id
    LEFT JOIN users u ON r.created_by = u.id
    ORDER BY r.is_completed ASC, r.due_date ASC
  `).all() as Reminder[]

  return reminders.map(r => ({
    ...r,
    is_completed: !!r.is_completed,
    is_overdue: !!r.is_overdue
  }))
}

export function getUpcomingReminders(days: number = 7): Reminder[] {
  const db = getDatabase()

  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + days)

  const reminders = db.prepare(`
    SELECT
      r.*,
      t.title as topic_title,
      rec.title as record_title,
      u.display_name as creator_name,
      0 as is_overdue
    FROM reminders r
    LEFT JOIN topics t ON r.topic_id = t.id
    LEFT JOIN records rec ON r.record_id = rec.id
    LEFT JOIN users u ON r.created_by = u.id
    WHERE r.is_completed = 0
      AND datetime(r.due_date) <= datetime(?)
      AND datetime(r.due_date) >= datetime('now')
    ORDER BY r.due_date ASC
  `).all(futureDate.toISOString()) as Reminder[]

  return reminders.map(r => ({
    ...r,
    is_completed: false,
    is_overdue: false
  }))
}

export function getOverdueReminders(): Reminder[] {
  const db = getDatabase()

  const reminders = db.prepare(`
    SELECT
      r.*,
      t.title as topic_title,
      rec.title as record_title,
      u.display_name as creator_name,
      1 as is_overdue
    FROM reminders r
    LEFT JOIN topics t ON r.topic_id = t.id
    LEFT JOIN records rec ON r.record_id = rec.id
    LEFT JOIN users u ON r.created_by = u.id
    WHERE r.is_completed = 0
      AND datetime(r.due_date) < datetime('now')
    ORDER BY r.due_date ASC
  `).all() as Reminder[]

  return reminders.map(r => ({
    ...r,
    is_completed: false,
    is_overdue: true
  }))
}

export function getReminderById(id: string): Reminder | null {
  const db = getDatabase()

  const reminder = db.prepare(`
    SELECT
      r.*,
      t.title as topic_title,
      rec.title as record_title,
      u.display_name as creator_name,
      CASE WHEN r.is_completed = 0 AND datetime(r.due_date) < datetime('now') THEN 1 ELSE 0 END as is_overdue
    FROM reminders r
    LEFT JOIN topics t ON r.topic_id = t.id
    LEFT JOIN records rec ON r.record_id = rec.id
    LEFT JOIN users u ON r.created_by = u.id
    WHERE r.id = ?
  `).get(id) as Reminder | undefined

  if (!reminder) return null

  return {
    ...reminder,
    is_completed: !!reminder.is_completed,
    is_overdue: !!reminder.is_overdue
  }
}

export function updateReminder(
  id: string,
  data: UpdateReminderData,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = getReminderById(id)
  if (!existing) {
    return { success: false, error: 'Reminder not found' }
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

  if (data.due_date !== undefined) {
    fields.push('due_date = ?')
    values.push(data.due_date)
    changes.due_date = { from: existing.due_date, to: data.due_date }
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
    db.prepare(`UPDATE reminders SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    logAudit(
      'REMINDER_UPDATE',
      userId,
      getUsername(userId),
      'reminder',
      id,
      { changes, reminder_title: existing.title }
    )

    return { success: true }
  } catch (error) {
    console.error('Error updating reminder:', error)
    return { success: false, error: 'Failed to update reminder' }
  }
}

export function completeReminder(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = getReminderById(id)
  if (!existing) {
    return { success: false, error: 'Reminder not found' }
  }

  if (existing.is_completed) {
    return { success: false, error: 'Reminder is already completed' }
  }

  const now = new Date().toISOString()

  try {
    db.prepare(`
      UPDATE reminders
      SET is_completed = 1, completed_at = ?, completed_by = ?, updated_at = ?
      WHERE id = ?
    `).run(now, userId, now, id)

    logAudit(
      'REMINDER_COMPLETE',
      userId,
      getUsername(userId),
      'reminder',
      id,
      { reminder_title: existing.title }
    )

    return { success: true }
  } catch (error) {
    console.error('Error completing reminder:', error)
    return { success: false, error: 'Failed to complete reminder' }
  }
}

export function deleteReminder(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = getReminderById(id)
  if (!existing) {
    return { success: false, error: 'Reminder not found' }
  }

  try {
    db.prepare('DELETE FROM reminders WHERE id = ?').run(id)

    logAudit(
      'REMINDER_DELETE',
      userId,
      getUsername(userId),
      'reminder',
      id,
      { reminder_title: existing.title }
    )

    return { success: true }
  } catch (error) {
    console.error('Error deleting reminder:', error)
    return { success: false, error: 'Failed to delete reminder' }
  }
}

export function getReminderStats(): {
  total: number
  pending: number
  overdue: number
  completedToday: number
  upcomingThisWeek: number
} {
  const db = getDatabase()

  const total = (db.prepare('SELECT COUNT(*) as count FROM reminders').get() as { count: number }).count

  const pending = (db.prepare(
    'SELECT COUNT(*) as count FROM reminders WHERE is_completed = 0'
  ).get() as { count: number }).count

  const overdue = (db.prepare(
    "SELECT COUNT(*) as count FROM reminders WHERE is_completed = 0 AND datetime(due_date) < datetime('now')"
  ).get() as { count: number }).count

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const completedToday = (db.prepare(
    'SELECT COUNT(*) as count FROM reminders WHERE is_completed = 1 AND datetime(completed_at) BETWEEN datetime(?) AND datetime(?)'
  ).get(todayStart.toISOString(), todayEnd.toISOString()) as { count: number }).count

  const weekEnd = new Date()
  weekEnd.setDate(weekEnd.getDate() + 7)

  const upcomingThisWeek = (db.prepare(
    "SELECT COUNT(*) as count FROM reminders WHERE is_completed = 0 AND datetime(due_date) BETWEEN datetime('now') AND datetime(?)"
  ).get(weekEnd.toISOString()) as { count: number }).count

  return {
    total,
    pending,
    overdue,
    completedToday,
    upcomingThisWeek
  }
}

export function getRemindersByTopic(topicId: string): Reminder[] {
  const db = getDatabase()

  const reminders = db.prepare(`
    SELECT
      r.*,
      t.title as topic_title,
      rec.title as record_title,
      u.display_name as creator_name,
      CASE WHEN r.is_completed = 0 AND datetime(r.due_date) < datetime('now') THEN 1 ELSE 0 END as is_overdue
    FROM reminders r
    LEFT JOIN topics t ON r.topic_id = t.id
    LEFT JOIN records rec ON r.record_id = rec.id
    LEFT JOIN users u ON r.created_by = u.id
    WHERE r.topic_id = ?
    ORDER BY r.is_completed ASC, r.due_date ASC
  `).all(topicId) as Reminder[]

  return reminders.map(r => ({
    ...r,
    is_completed: !!r.is_completed,
    is_overdue: !!r.is_overdue
  }))
}
