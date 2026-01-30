import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'
import { generateId } from '../utils/crypto'
import { getUsername } from './auth.service'

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

export function getAllTopics(): Topic[] {
  const db = getDatabase()

  const topics = db.prepare(`
    SELECT
      t.*,
      (SELECT COUNT(*) FROM records r WHERE r.topic_id = t.id AND r.deleted_at IS NULL) as record_count,
      (SELECT MAX(r.created_at) FROM records r WHERE r.topic_id = t.id AND r.deleted_at IS NULL) as last_activity
    FROM topics t
    WHERE t.deleted_at IS NULL
    ORDER BY t.updated_at DESC
  `).all() as Topic[]

  return topics
}

export function getTopicById(id: string): Topic | null {
  const db = getDatabase()

  const topic = db.prepare(`
    SELECT
      t.*,
      (SELECT COUNT(*) FROM records r WHERE r.topic_id = t.id AND r.deleted_at IS NULL) as record_count,
      (SELECT MAX(r.created_at) FROM records r WHERE r.topic_id = t.id AND r.deleted_at IS NULL) as last_activity
    FROM topics t
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
    // Soft delete the topic
    db.prepare('UPDATE topics SET deleted_at = ?, updated_at = ? WHERE id = ?')
      .run(now, now, id)

    // Soft delete all associated records
    db.prepare('UPDATE records SET deleted_at = ?, updated_at = ? WHERE topic_id = ? AND deleted_at IS NULL')
      .run(now, now, id)

    logAudit(
      'TOPIC_DELETE',
      userId,
      getUsername(userId),
      'topic',
      id,
      { topic_title: existing.title }
    )

    return { success: true }
  } catch (error) {
    console.error('Error deleting topic:', error)
    return { success: false, error: 'Failed to delete topic' }
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
      (SELECT COUNT(*) FROM records r WHERE r.topic_id = t.id AND r.deleted_at IS NULL) as record_count,
      (SELECT MAX(r.created_at) FROM records r WHERE r.topic_id = t.id AND r.deleted_at IS NULL) as last_activity
    FROM topics t
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
      (SELECT COUNT(*) FROM records r WHERE r.topic_id = t.id AND r.deleted_at IS NULL) as record_count,
      (SELECT MAX(r.created_at) FROM records r WHERE r.topic_id = t.id AND r.deleted_at IS NULL) as last_activity
    FROM topics t
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
