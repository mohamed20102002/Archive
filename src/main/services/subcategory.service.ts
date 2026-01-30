import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'
import { generateId } from '../utils/crypto'
import { getUsername } from './auth.service'

export interface Subcategory {
  id: string
  topic_id: string
  title: string
  description: string | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  record_count?: number
  creator_name?: string
}

export interface CreateSubcategoryData {
  topic_id: string
  title: string
  description?: string
}

export interface UpdateSubcategoryData {
  title?: string
  description?: string
}

export function createSubcategory(
  data: CreateSubcategoryData,
  userId: string
): { success: boolean; subcategory?: Subcategory; error?: string } {
  const db = getDatabase()

  if (!data.topic_id) {
    return { success: false, error: 'Topic ID is required' }
  }

  if (!data.title?.trim()) {
    return { success: false, error: 'Title is required' }
  }

  // Verify topic exists
  const topic = db.prepare('SELECT id, title FROM topics WHERE id = ? AND deleted_at IS NULL').get(data.topic_id) as { id: string; title: string } | undefined
  if (!topic) {
    return { success: false, error: 'Topic not found' }
  }

  const id = generateId()
  const now = new Date().toISOString()

  try {
    db.prepare(`
      INSERT INTO subcategories (id, topic_id, title, description, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.topic_id,
      data.title.trim(),
      data.description?.trim() || null,
      userId,
      now,
      now
    )

    const subcategory: Subcategory = {
      id,
      topic_id: data.topic_id,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      created_by: userId,
      created_at: now,
      updated_at: now,
      deleted_at: null
    }

    logAudit(
      'SUBCATEGORY_CREATE' as any,
      userId,
      getUsername(userId),
      'subcategory',
      id,
      { title: subcategory.title, topic_id: data.topic_id, topic_title: topic.title }
    )

    return { success: true, subcategory }
  } catch (error) {
    console.error('Error creating subcategory:', error)
    return { success: false, error: 'Failed to create subcategory' }
  }
}

export function getSubcategoriesByTopic(topicId: string): Subcategory[] {
  const db = getDatabase()

  const subcategories = db.prepare(`
    SELECT
      s.*,
      u.display_name as creator_name,
      (SELECT COUNT(*) FROM records r WHERE r.subcategory_id = s.id AND r.deleted_at IS NULL) as record_count
    FROM subcategories s
    LEFT JOIN users u ON s.created_by = u.id
    WHERE s.topic_id = ? AND s.deleted_at IS NULL
    ORDER BY s.title ASC
  `).all(topicId) as Subcategory[]

  return subcategories
}

export function getSubcategoryById(id: string): Subcategory | null {
  const db = getDatabase()

  const subcategory = db.prepare(`
    SELECT
      s.*,
      u.display_name as creator_name,
      (SELECT COUNT(*) FROM records r WHERE r.subcategory_id = s.id AND r.deleted_at IS NULL) as record_count
    FROM subcategories s
    LEFT JOIN users u ON s.created_by = u.id
    WHERE s.id = ? AND s.deleted_at IS NULL
  `).get(id) as Subcategory | undefined

  return subcategory || null
}

export function updateSubcategory(
  id: string,
  data: UpdateSubcategoryData,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = getSubcategoryById(id)
  if (!existing) {
    return { success: false, error: 'Subcategory not found' }
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

  if (fields.length === 0) {
    return { success: false, error: 'No updates provided' }
  }

  fields.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id)

  try {
    db.prepare(`UPDATE subcategories SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    logAudit(
      'SUBCATEGORY_UPDATE' as any,
      userId,
      getUsername(userId),
      'subcategory',
      id,
      { changes, subcategory_title: existing.title }
    )

    return { success: true }
  } catch (error) {
    console.error('Error updating subcategory:', error)
    return { success: false, error: 'Failed to update subcategory' }
  }
}

export function deleteSubcategory(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = getSubcategoryById(id)
  if (!existing) {
    return { success: false, error: 'Subcategory not found' }
  }

  const now = new Date().toISOString()

  try {
    // Soft delete the subcategory
    db.prepare('UPDATE subcategories SET deleted_at = ?, updated_at = ? WHERE id = ?')
      .run(now, now, id)

    // Move records to general (set subcategory_id to null)
    db.prepare('UPDATE records SET subcategory_id = NULL, updated_at = ? WHERE subcategory_id = ? AND deleted_at IS NULL')
      .run(now, id)

    logAudit(
      'SUBCATEGORY_DELETE' as any,
      userId,
      getUsername(userId),
      'subcategory',
      id,
      { subcategory_title: existing.title, topic_id: existing.topic_id }
    )

    return { success: true }
  } catch (error) {
    console.error('Error deleting subcategory:', error)
    return { success: false, error: 'Failed to delete subcategory' }
  }
}
