import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'
import { getUsername } from './auth.service'
import * as crypto from 'crypto'

// ===== Types =====

export type EntityType = 'record' | 'mom' | 'letter' | 'issue'
export type MentionStatus = 'pending' | 'acknowledged' | 'archived'

export interface Mention {
  id: string
  entity_type: EntityType
  entity_id: string
  mentioned_user_id: string
  created_by: string
  note: string | null
  status: MentionStatus
  acknowledged_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  // Joined fields
  mentioned_user_name?: string
  creator_name?: string
  entity_title?: string
  topic_id?: string // For records - needed for navigation
  entity_deleted?: boolean // True if the referenced entity was deleted
}

export interface CreateMentionInput {
  entity_type: EntityType
  entity_id: string
  mentioned_user_id: string
  note?: string
}

export interface MentionFilters {
  status?: MentionStatus
  entity_type?: EntityType
}

// ===== Helper Functions =====

function generateId(): string {
  return crypto.randomUUID()
}

interface EntityInfo {
  title: string | null
  topic_id?: string
  entity_deleted?: boolean
}

function getEntityInfo(db: ReturnType<typeof getDatabase>, entityType: EntityType, entityId: string): EntityInfo {
  try {
    switch (entityType) {
      case 'record': {
        const record = db.prepare('SELECT title, topic_id, deleted_at FROM records WHERE id = ?').get(entityId) as { title: string; topic_id: string; deleted_at: string | null } | undefined
        if (!record) return { title: null, entity_deleted: true }
        if (record.deleted_at) return { title: record.title, topic_id: record.topic_id, entity_deleted: true }
        return { title: record.title, topic_id: record.topic_id, entity_deleted: false }
      }
      case 'mom': {
        const mom = db.prepare('SELECT title, mom_id, deleted_at FROM moms WHERE id = ?').get(entityId) as { title: string; mom_id: string | null; deleted_at: string | null } | undefined
        if (!mom) return { title: null, entity_deleted: true }
        if (mom.deleted_at) return { title: `${mom.mom_id || 'MOM'}: ${mom.title}`, entity_deleted: true }
        return { title: `${mom.mom_id || 'MOM'}: ${mom.title}`, entity_deleted: false }
      }
      case 'letter': {
        const letter = db.prepare('SELECT subject, reference_number, deleted_at FROM letters WHERE id = ?').get(entityId) as { subject: string; reference_number: string | null; deleted_at: string | null } | undefined
        if (!letter) return { title: null, entity_deleted: true }
        if (letter.deleted_at) return { title: `${letter.reference_number || 'Letter'}: ${letter.subject}`, entity_deleted: true }
        return { title: `${letter.reference_number || 'Letter'}: ${letter.subject}`, entity_deleted: false }
      }
      case 'issue': {
        const issue = db.prepare('SELECT title, deleted_at FROM issues WHERE id = ?').get(entityId) as { title: string; deleted_at: string | null } | undefined
        if (!issue) return { title: null, entity_deleted: true }
        if (issue.deleted_at) return { title: issue.title, entity_deleted: true }
        return { title: issue.title, entity_deleted: false }
      }
      default:
        return { title: null, entity_deleted: true }
    }
  } catch {
    return { title: null, entity_deleted: true }
  }
}

// ===== Mention CRUD =====

export function createMention(
  input: CreateMentionInput,
  userId: string
): { success: boolean; mention?: Mention; error?: string } {
  const db = getDatabase()

  if (!input.entity_type || !input.entity_id || !input.mentioned_user_id) {
    return { success: false, error: 'Missing required fields' }
  }

  // Cannot mention yourself
  if (input.mentioned_user_id === userId) {
    return { success: false, error: 'Cannot mention yourself' }
  }

  const id = generateId()
  const now = new Date().toISOString()

  try {
    db.prepare(`
      INSERT INTO mentions (id, entity_type, entity_id, mentioned_user_id, created_by, note, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(id, input.entity_type, input.entity_id, input.mentioned_user_id, userId, input.note || null, now, now)

    logAudit('MENTION_CREATE', userId, getUsername(userId), 'mention', id, {
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      mentioned_user_id: input.mentioned_user_id
    })

    return {
      success: true,
      mention: {
        id,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        mentioned_user_id: input.mentioned_user_id,
        created_by: userId,
        note: input.note || null,
        status: 'pending',
        acknowledged_at: null,
        archived_at: null,
        created_at: now,
        updated_at: now
      }
    }
  } catch (error: any) {
    console.error('Error creating mention:', error)
    return { success: false, error: 'Failed to create mention' }
  }
}

export function createMentions(
  inputs: CreateMentionInput[],
  userId: string
): { success: boolean; count?: number; error?: string } {
  const db = getDatabase()
  const now = new Date().toISOString()

  try {
    const insert = db.prepare(`
      INSERT INTO mentions (id, entity_type, entity_id, mentioned_user_id, created_by, note, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `)

    let count = 0

    db.transaction(() => {
      for (const input of inputs) {
        // Skip self-mentions
        if (input.mentioned_user_id === userId) continue

        const id = generateId()
        insert.run(id, input.entity_type, input.entity_id, input.mentioned_user_id, userId, input.note || null, now, now)
        count++

        logAudit('MENTION_CREATE', userId, getUsername(userId), 'mention', id, {
          entity_type: input.entity_type,
          entity_id: input.entity_id,
          mentioned_user_id: input.mentioned_user_id
        })
      }
    })()

    return { success: true, count }
  } catch (error: any) {
    console.error('Error creating mentions:', error)
    return { success: false, error: 'Failed to create mentions' }
  }
}

export function getMentionById(id: string): Mention | null {
  const db = getDatabase()

  const mention = db.prepare(`
    SELECT
      m.*,
      mu.display_name as mentioned_user_name,
      cu.display_name as creator_name
    FROM mentions m
    LEFT JOIN users mu ON mu.id = m.mentioned_user_id
    LEFT JOIN users cu ON cu.id = m.created_by
    WHERE m.id = ?
  `).get(id) as Mention | undefined

  if (!mention) return null

  const entityInfo = getEntityInfo(db, mention.entity_type, mention.entity_id)
  mention.entity_title = entityInfo.title
  if (entityInfo.topic_id) mention.topic_id = entityInfo.topic_id
  mention.entity_deleted = entityInfo.entity_deleted
  return mention
}

export function getMentionsForUser(
  userId: string,
  filters: MentionFilters = {}
): Mention[] {
  const db = getDatabase()

  let query = `
    SELECT
      m.*,
      mu.display_name as mentioned_user_name,
      cu.display_name as creator_name
    FROM mentions m
    LEFT JOIN users mu ON mu.id = m.mentioned_user_id
    LEFT JOIN users cu ON cu.id = m.created_by
    WHERE m.mentioned_user_id = ?
  `

  const params: any[] = [userId]

  if (filters.status) {
    query += ' AND m.status = ?'
    params.push(filters.status)
  }

  if (filters.entity_type) {
    query += ' AND m.entity_type = ?'
    params.push(filters.entity_type)
  }

  query += ' ORDER BY m.created_at DESC'

  const mentions = db.prepare(query).all(...params) as Mention[]

  // Add entity info (title + topic_id for records + deleted status)
  for (const mention of mentions) {
    const entityInfo = getEntityInfo(db, mention.entity_type, mention.entity_id)
    mention.entity_title = entityInfo.title
    if (entityInfo.topic_id) mention.topic_id = entityInfo.topic_id
    mention.entity_deleted = entityInfo.entity_deleted
  }

  return mentions
}

export function getMentionsSentByUser(
  userId: string,
  filters: MentionFilters = {}
): Mention[] {
  const db = getDatabase()

  let query = `
    SELECT
      m.*,
      mu.display_name as mentioned_user_name,
      cu.display_name as creator_name
    FROM mentions m
    LEFT JOIN users mu ON mu.id = m.mentioned_user_id
    LEFT JOIN users cu ON cu.id = m.created_by
    WHERE m.created_by = ?
  `

  const params: any[] = [userId]

  if (filters.status) {
    query += ' AND m.status = ?'
    params.push(filters.status)
  }

  if (filters.entity_type) {
    query += ' AND m.entity_type = ?'
    params.push(filters.entity_type)
  }

  query += ' ORDER BY m.created_at DESC'

  const mentions = db.prepare(query).all(...params) as Mention[]

  // Add entity info (title + topic_id for records + deleted status)
  for (const mention of mentions) {
    const entityInfo = getEntityInfo(db, mention.entity_type, mention.entity_id)
    mention.entity_title = entityInfo.title
    if (entityInfo.topic_id) mention.topic_id = entityInfo.topic_id
    mention.entity_deleted = entityInfo.entity_deleted
  }

  return mentions
}

export function getMentionsForEntity(
  entityType: EntityType,
  entityId: string
): Mention[] {
  const db = getDatabase()

  const mentions = db.prepare(`
    SELECT
      m.*,
      mu.display_name as mentioned_user_name,
      cu.display_name as creator_name
    FROM mentions m
    LEFT JOIN users mu ON mu.id = m.mentioned_user_id
    LEFT JOIN users cu ON cu.id = m.created_by
    WHERE m.entity_type = ? AND m.entity_id = ?
    ORDER BY m.created_at DESC
  `).all(entityType, entityId) as Mention[]

  return mentions
}

export function getAllMentions(filters: MentionFilters = {}): Mention[] {
  const db = getDatabase()

  let query = `
    SELECT
      m.*,
      mu.display_name as mentioned_user_name,
      cu.display_name as creator_name
    FROM mentions m
    LEFT JOIN users mu ON mu.id = m.mentioned_user_id
    LEFT JOIN users cu ON cu.id = m.created_by
    WHERE 1=1
  `

  const params: any[] = []

  if (filters.status) {
    query += ' AND m.status = ?'
    params.push(filters.status)
  }

  if (filters.entity_type) {
    query += ' AND m.entity_type = ?'
    params.push(filters.entity_type)
  }

  query += ' ORDER BY m.created_at DESC'

  const mentions = db.prepare(query).all(...params) as Mention[]

  // Add entity info (title + topic_id for records + deleted status)
  for (const mention of mentions) {
    const entityInfo = getEntityInfo(db, mention.entity_type, mention.entity_id)
    mention.entity_title = entityInfo.title
    if (entityInfo.topic_id) mention.topic_id = entityInfo.topic_id
    mention.entity_deleted = entityInfo.entity_deleted
  }

  return mentions
}

export function acknowledgeMention(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const mention = getMentionById(id)
  if (!mention) {
    return { success: false, error: 'Mention not found' }
  }

  // Only the mentioned user can acknowledge
  if (mention.mentioned_user_id !== userId) {
    return { success: false, error: 'Only the mentioned user can acknowledge this mention' }
  }

  if (mention.status !== 'pending') {
    return { success: false, error: 'Mention is not pending' }
  }

  const now = new Date().toISOString()

  try {
    db.prepare(`
      UPDATE mentions
      SET status = 'acknowledged', acknowledged_at = ?, updated_at = ?
      WHERE id = ?
    `).run(now, now, id)

    logAudit('MENTION_ACKNOWLEDGE', userId, getUsername(userId), 'mention', id, {})

    return { success: true }
  } catch (error) {
    console.error('Error acknowledging mention:', error)
    return { success: false, error: 'Failed to acknowledge mention' }
  }
}

export function archiveMention(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const mention = getMentionById(id)
  if (!mention) {
    return { success: false, error: 'Mention not found' }
  }

  // Only the mentioned user can archive
  if (mention.mentioned_user_id !== userId) {
    return { success: false, error: 'Only the mentioned user can archive this mention' }
  }

  if (mention.status !== 'acknowledged') {
    return { success: false, error: 'Mention must be acknowledged before archiving' }
  }

  const now = new Date().toISOString()

  try {
    db.prepare(`
      UPDATE mentions
      SET status = 'archived', archived_at = ?, updated_at = ?
      WHERE id = ?
    `).run(now, now, id)

    logAudit('MENTION_ARCHIVE', userId, getUsername(userId), 'mention', id, {})

    return { success: true }
  } catch (error) {
    console.error('Error archiving mention:', error)
    return { success: false, error: 'Failed to archive mention' }
  }
}

export function updateMentionNote(
  id: string,
  note: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const mention = getMentionById(id)
  if (!mention) {
    return { success: false, error: 'Mention not found' }
  }

  // Only the creator can edit the note
  if (mention.created_by !== userId) {
    return { success: false, error: 'Only the creator can edit this mention' }
  }

  // Can only edit pending mentions
  if (mention.status !== 'pending') {
    return { success: false, error: 'Cannot edit an acknowledged or archived mention' }
  }

  const now = new Date().toISOString()

  try {
    db.prepare(`
      UPDATE mentions
      SET note = ?, updated_at = ?
      WHERE id = ?
    `).run(note || null, now, id)

    logAudit('MENTION_UPDATE', userId, getUsername(userId), 'mention', id, { note })

    return { success: true }
  } catch (error) {
    console.error('Error updating mention note:', error)
    return { success: false, error: 'Failed to update mention note' }
  }
}

export function deleteMention(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const mention = getMentionById(id)
  if (!mention) {
    return { success: false, error: 'Mention not found' }
  }

  // Only the creator can delete
  if (mention.created_by !== userId) {
    return { success: false, error: 'Only the creator can delete this mention' }
  }

  // Can only delete pending mentions
  if (mention.status !== 'pending') {
    return { success: false, error: 'Cannot delete an acknowledged or archived mention' }
  }

  try {
    db.prepare('DELETE FROM mentions WHERE id = ?').run(id)

    logAudit('MENTION_DELETE', userId, getUsername(userId), 'mention', id, {})

    return { success: true }
  } catch (error) {
    console.error('Error deleting mention:', error)
    return { success: false, error: 'Failed to delete mention' }
  }
}

export function getUnacknowledgedCount(userId: string): number {
  const db = getDatabase()

  const result = db.prepare(`
    SELECT COUNT(*) as count FROM mentions
    WHERE mentioned_user_id = ? AND status = 'pending'
  `).get(userId) as { count: number }

  return result.count
}

export function searchUsersForMention(query: string): { id: string; display_name: string; username: string }[] {
  const db = getDatabase()

  if (!query || query.length < 1) {
    return db.prepare(`
      SELECT id, display_name, username FROM users
      WHERE deleted_at IS NULL AND is_active = 1
      ORDER BY display_name
      LIMIT 20
    `).all() as { id: string; display_name: string; username: string }[]
  }

  const searchTerm = `%${query}%`
  return db.prepare(`
    SELECT id, display_name, username FROM users
    WHERE deleted_at IS NULL AND is_active = 1
      AND (display_name LIKE ? OR username LIKE ?)
    ORDER BY display_name
    LIMIT 20
  `).all(searchTerm, searchTerm) as { id: string; display_name: string; username: string }[]
}

export function cleanupOldArchivedMentions(): { success: boolean; deleted?: number; error?: string } {
  const db = getDatabase()

  // Delete mentions archived more than 1 month ago
  const oneMonthAgo = new Date()
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
  const cutoffDate = oneMonthAgo.toISOString()

  try {
    const result = db.prepare(`
      DELETE FROM mentions
      WHERE status = 'archived' AND archived_at < ?
    `).run(cutoffDate)

    const deleted = result.changes || 0

    if (deleted > 0) {
      console.log(`[Mention Cleanup] Deleted ${deleted} archived mentions older than 1 month`)
    }

    return { success: true, deleted }
  } catch (error) {
    console.error('Error cleaning up archived mentions:', error)
    return { success: false, error: 'Failed to cleanup archived mentions' }
  }
}

// Get mentions count by status for a user
export function getMentionCounts(userId: string): { pending: number; acknowledged: number; archived: number; sent: number } {
  const db = getDatabase()

  const pending = db.prepare(`
    SELECT COUNT(*) as count FROM mentions
    WHERE mentioned_user_id = ? AND status = 'pending'
  `).get(userId) as { count: number }

  const acknowledged = db.prepare(`
    SELECT COUNT(*) as count FROM mentions
    WHERE mentioned_user_id = ? AND status = 'acknowledged'
  `).get(userId) as { count: number }

  const archived = db.prepare(`
    SELECT COUNT(*) as count FROM mentions
    WHERE mentioned_user_id = ? AND status = 'archived'
  `).get(userId) as { count: number }

  const sent = db.prepare(`
    SELECT COUNT(*) as count FROM mentions
    WHERE created_by = ?
  `).get(userId) as { count: number }

  return {
    pending: pending.count,
    acknowledged: acknowledged.count,
    archived: archived.count,
    sent: sent.count
  }
}
