/**
 * Notification Service
 *
 * Manages in-app notifications, @mentions, and email notifications.
 * Provides notification storage, retrieval, and delivery.
 */

import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  entity_type?: string
  entity_id?: string
  actor_id?: string
  actor_name?: string
  is_read: boolean
  email_sent: boolean
  created_at: string
  read_at?: string
}

export type NotificationType =
  | 'mention'
  | 'assignment'
  | 'comment'
  | 'status_change'
  | 'reminder'
  | 'system'

export interface CreateNotificationInput {
  user_id: string
  type: NotificationType
  title: string
  message: string
  entity_type?: string
  entity_id?: string
  actor_id?: string
  actor_name?: string
  send_email?: boolean
}

export interface MentionMatch {
  username: string
  start: number
  end: number
}

// Initialize notifications table
const NOTIFICATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    actor_id TEXT,
    actor_name TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    email_sent INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    read_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`

const NOTIFICATIONS_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
  CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
`

// User preferences for notifications
const USER_NOTIFICATION_PREFS_TABLE = `
  CREATE TABLE IF NOT EXISTS user_notification_preferences (
    user_id TEXT PRIMARY KEY,
    email_mentions INTEGER NOT NULL DEFAULT 1,
    email_assignments INTEGER NOT NULL DEFAULT 1,
    email_comments INTEGER NOT NULL DEFAULT 0,
    email_status_changes INTEGER NOT NULL DEFAULT 0,
    email_reminders INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`

/**
 * Initialize notification tables
 */
export function initNotificationTables(): void {
  const db = getDatabase()
  db.exec(NOTIFICATIONS_TABLE)
  db.exec(NOTIFICATIONS_INDEXES)
  db.exec(USER_NOTIFICATION_PREFS_TABLE)
}

/**
 * Generate unique notification ID
 */
function generateNotificationId(): string {
  return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create a new notification
 */
export function createNotification(input: CreateNotificationInput): Notification {
  const db = getDatabase()
  const id = generateNotificationId()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, entity_type, entity_id, actor_id, actor_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.user_id,
    input.type,
    input.title,
    input.message,
    input.entity_type || null,
    input.entity_id || null,
    input.actor_id || null,
    input.actor_name || null,
    now
  )

  const notification: Notification = {
    id,
    user_id: input.user_id,
    type: input.type,
    title: input.title,
    message: input.message,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    actor_id: input.actor_id,
    actor_name: input.actor_name,
    is_read: false,
    email_sent: false,
    created_at: now
  }

  // Send email notification if requested
  if (input.send_email) {
    sendEmailNotification(notification).catch(err => {
      console.error('Failed to send email notification:', err)
    })
  }

  return notification
}

/**
 * Get notifications for a user
 */
export function getNotifications(
  userId: string,
  options: {
    unreadOnly?: boolean
    limit?: number
    offset?: number
    type?: NotificationType
  } = {}
): { notifications: Notification[]; total: number; unread: number } {
  const db = getDatabase()
  const { unreadOnly = false, limit = 50, offset = 0, type } = options

  let whereClause = 'WHERE user_id = ?'
  const params: unknown[] = [userId]

  if (unreadOnly) {
    whereClause += ' AND is_read = 0'
  }

  if (type) {
    whereClause += ' AND type = ?'
    params.push(type)
  }

  // Get total and unread counts
  const counts = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread
    FROM notifications
    WHERE user_id = ?
  `).get(userId) as { total: number; unread: number }

  // Get notifications
  const notifications = db.prepare(`
    SELECT * FROM notifications
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as Notification[]

  return {
    notifications: notifications.map(n => ({
      ...n,
      is_read: Boolean(n.is_read),
      email_sent: Boolean(n.email_sent)
    })),
    total: counts.total,
    unread: counts.unread
  }
}

/**
 * Mark notification as read
 */
export function markAsRead(notificationId: string, userId: string): boolean {
  const db = getDatabase()
  const now = new Date().toISOString()

  const result = db.prepare(`
    UPDATE notifications
    SET is_read = 1, read_at = ?
    WHERE id = ? AND user_id = ?
  `).run(now, notificationId, userId)

  return result.changes > 0
}

/**
 * Mark all notifications as read for a user
 */
export function markAllAsRead(userId: string): number {
  const db = getDatabase()
  const now = new Date().toISOString()

  const result = db.prepare(`
    UPDATE notifications
    SET is_read = 1, read_at = ?
    WHERE user_id = ? AND is_read = 0
  `).run(now, userId)

  return result.changes
}

/**
 * Delete old notifications
 */
export function cleanupOldNotifications(daysToKeep: number = 30): number {
  const db = getDatabase()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysToKeep)

  // Only delete read notifications older than cutoff
  const result = db.prepare(`
    DELETE FROM notifications
    WHERE is_read = 1 AND created_at < ?
  `).run(cutoff.toISOString())

  return result.changes
}

/**
 * Parse @mentions from text
 */
export function parseMentions(text: string): MentionMatch[] {
  const mentionRegex = /@(\w+)/g
  const matches: MentionMatch[] = []
  let match

  while ((match = mentionRegex.exec(text)) !== null) {
    matches.push({
      username: match[1],
      start: match.index,
      end: match.index + match[0].length
    })
  }

  return matches
}

/**
 * Process mentions and create notifications
 */
export function processMentions(
  text: string,
  entityType: string,
  entityId: string,
  actorId: string,
  actorName: string,
  entityTitle: string
): Notification[] {
  const db = getDatabase()
  const mentions = parseMentions(text)
  const notifications: Notification[] = []

  if (mentions.length === 0) return notifications

  // Get user IDs for mentioned usernames
  const usernames = mentions.map(m => m.username)
  const placeholders = usernames.map(() => '?').join(',')

  const users = db.prepare(`
    SELECT id, username, display_name FROM users
    WHERE username IN (${placeholders}) AND is_active = 1 AND id != ?
  `).all(...usernames, actorId) as Array<{ id: string; username: string; display_name: string }>

  // Create notification for each mentioned user
  for (const user of users) {
    const notification = createNotification({
      user_id: user.id,
      type: 'mention',
      title: `${actorName} mentioned you`,
      message: `You were mentioned in ${entityType}: "${entityTitle}"`,
      entity_type: entityType,
      entity_id: entityId,
      actor_id: actorId,
      actor_name: actorName,
      send_email: true
    })

    notifications.push(notification)
  }

  return notifications
}

/**
 * Get notification preferences for a user
 */
export function getNotificationPreferences(userId: string): Record<string, boolean> {
  const db = getDatabase()

  const prefs = db.prepare(`
    SELECT * FROM user_notification_preferences WHERE user_id = ?
  `).get(userId) as Record<string, number> | undefined

  if (!prefs) {
    // Return defaults
    return {
      email_mentions: true,
      email_assignments: true,
      email_comments: false,
      email_status_changes: false,
      email_reminders: true
    }
  }

  return {
    email_mentions: Boolean(prefs.email_mentions),
    email_assignments: Boolean(prefs.email_assignments),
    email_comments: Boolean(prefs.email_comments),
    email_status_changes: Boolean(prefs.email_status_changes),
    email_reminders: Boolean(prefs.email_reminders)
  }
}

/**
 * Update notification preferences
 */
export function updateNotificationPreferences(
  userId: string,
  preferences: Partial<Record<string, boolean>>
): void {
  const db = getDatabase()

  const existing = db.prepare(`
    SELECT 1 FROM user_notification_preferences WHERE user_id = ?
  `).get(userId)

  if (existing) {
    const setClauses: string[] = []
    const values: unknown[] = []

    for (const [key, value] of Object.entries(preferences)) {
      if (key.startsWith('email_')) {
        setClauses.push(`${key} = ?`)
        values.push(value ? 1 : 0)
      }
    }

    if (setClauses.length > 0) {
      values.push(userId)
      db.prepare(`
        UPDATE user_notification_preferences
        SET ${setClauses.join(', ')}
        WHERE user_id = ?
      `).run(...values)
    }
  } else {
    db.prepare(`
      INSERT INTO user_notification_preferences (user_id, email_mentions, email_assignments, email_comments, email_status_changes, email_reminders)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      preferences.email_mentions ?? 1,
      preferences.email_assignments ?? 1,
      preferences.email_comments ?? 0,
      preferences.email_status_changes ?? 0,
      preferences.email_reminders ?? 1
    )
  }
}

/**
 * Send email notification (placeholder - integrate with Outlook service)
 */
async function sendEmailNotification(notification: Notification): Promise<void> {
  const db = getDatabase()

  // Get user email preferences
  const prefs = getNotificationPreferences(notification.user_id)
  const prefKey = `email_${notification.type}s` as keyof typeof prefs

  if (!prefs[prefKey]) {
    return // User has disabled email for this type
  }

  // Get user email
  const user = db.prepare(`
    SELECT username, display_name FROM users WHERE id = ?
  `).get(notification.user_id) as { username: string; display_name: string } | undefined

  if (!user) return

  // TODO: Integrate with Outlook service to send email
  // For now, just mark as sent
  db.prepare(`
    UPDATE notifications SET email_sent = 1 WHERE id = ?
  `).run(notification.id)

  console.log(`[Notification] Would send email to ${user.username}: ${notification.title}`)
}

/**
 * Get unread count for a user
 */
export function getUnreadCount(userId: string): number {
  const db = getDatabase()

  const result = db.prepare(`
    SELECT COUNT(*) as count FROM notifications
    WHERE user_id = ? AND is_read = 0
  `).get(userId) as { count: number }

  return result.count
}

export default {
  initNotificationTables,
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  cleanupOldNotifications,
  parseMentions,
  processMentions,
  getNotificationPreferences,
  updateNotificationPreferences,
  getUnreadCount
}
