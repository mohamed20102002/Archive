import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'
import { getUsername } from './auth.service'
import * as crypto from 'crypto'

export interface Tag {
  id: string
  name: string
  color: string
  description: string | null
  created_by: string | null
  created_at: string
}

export interface CreateTagData {
  name: string
  color?: string
  description?: string
}

export interface UpdateTagData {
  name?: string
  color?: string
  description?: string
}

function generateId(): string {
  return crypto.randomUUID()
}

// ===== Tag CRUD =====

export function createTag(
  data: CreateTagData,
  userId: string
): { success: boolean; tag?: Tag; error?: string } {
  const db = getDatabase()

  if (!data.name?.trim()) {
    return { success: false, error: 'Tag name is required' }
  }

  const id = generateId()
  const now = new Date().toISOString()

  try {
    db.prepare(`
      INSERT INTO tags (id, name, color, description, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.name.trim(), data.color || '#6B7280', data.description || null, userId, now)

    logAudit('TAG_CREATE', userId, getUsername(userId), 'tag', id, {
      name: data.name,
      color: data.color
    })

    return {
      success: true,
      tag: {
        id,
        name: data.name.trim(),
        color: data.color || '#6B7280',
        description: data.description || null,
        created_by: userId,
        created_at: now
      }
    }
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { success: false, error: 'Tag with this name already exists' }
    }
    console.error('Error creating tag:', error)
    return { success: false, error: 'Failed to create tag' }
  }
}

export function getAllTags(): Tag[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM tags ORDER BY name').all() as Tag[]
}

export function getTagById(id: string): Tag | null {
  const db = getDatabase()
  return db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as Tag | null
}

export function updateTag(
  id: string,
  data: UpdateTagData,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = getTagById(id)
  if (!existing) {
    return { success: false, error: 'Tag not found' }
  }

  const updates: string[] = []
  const values: any[] = []

  if (data.name !== undefined) {
    updates.push('name = ?')
    values.push(data.name.trim())
  }
  if (data.color !== undefined) {
    updates.push('color = ?')
    values.push(data.color)
  }
  if (data.description !== undefined) {
    updates.push('description = ?')
    values.push(data.description)
  }

  if (updates.length === 0) {
    return { success: true }
  }

  values.push(id)

  try {
    db.prepare(`UPDATE tags SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    logAudit('TAG_UPDATE', userId, getUsername(userId), 'tag', id, data)

    return { success: true }
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { success: false, error: 'Tag with this name already exists' }
    }
    console.error('Error updating tag:', error)
    return { success: false, error: 'Failed to update tag' }
  }
}

export function deleteTag(id: string, userId: string): { success: boolean; error?: string } {
  const db = getDatabase()

  try {
    db.prepare('DELETE FROM tags WHERE id = ?').run(id)
    logAudit('TAG_DELETE', userId, getUsername(userId), 'tag', id, {})
    return { success: true }
  } catch (error) {
    console.error('Error deleting tag:', error)
    return { success: false, error: 'Failed to delete tag' }
  }
}

// ===== Entity Tagging =====

export function addTagToRecord(
  recordId: string,
  tagId: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()
  const now = new Date().toISOString()

  try {
    db.prepare(`
      INSERT OR IGNORE INTO record_tags (record_id, tag_id, created_by, created_at)
      VALUES (?, ?, ?, ?)
    `).run(recordId, tagId, userId, now)

    return { success: true }
  } catch (error) {
    console.error('Error adding tag to record:', error)
    return { success: false, error: 'Failed to add tag to record' }
  }
}

export function removeTagFromRecord(
  recordId: string,
  tagId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  try {
    db.prepare('DELETE FROM record_tags WHERE record_id = ? AND tag_id = ?').run(recordId, tagId)
    return { success: true }
  } catch (error) {
    console.error('Error removing tag from record:', error)
    return { success: false, error: 'Failed to remove tag from record' }
  }
}

export function getRecordTags(recordId: string): Tag[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT t.* FROM tags t
    JOIN record_tags rt ON rt.tag_id = t.id
    WHERE rt.record_id = ?
    ORDER BY t.name
  `).all(recordId) as Tag[]
}

export function setRecordTags(
  recordId: string,
  tagIds: string[],
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()
  const now = new Date().toISOString()

  try {
    db.transaction(() => {
      // Remove existing tags
      db.prepare('DELETE FROM record_tags WHERE record_id = ?').run(recordId)

      // Add new tags
      const insert = db.prepare(`
        INSERT INTO record_tags (record_id, tag_id, created_by, created_at)
        VALUES (?, ?, ?, ?)
      `)
      for (const tagId of tagIds) {
        insert.run(recordId, tagId, userId, now)
      }
    })()

    return { success: true }
  } catch (error) {
    console.error('Error setting record tags:', error)
    return { success: false, error: 'Failed to set record tags' }
  }
}

// Issue Tags
export function addTagToIssue(
  issueId: string,
  tagId: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()
  const now = new Date().toISOString()

  try {
    db.prepare(`
      INSERT OR IGNORE INTO issue_tags (issue_id, tag_id, created_by, created_at)
      VALUES (?, ?, ?, ?)
    `).run(issueId, tagId, userId, now)

    return { success: true }
  } catch (error) {
    console.error('Error adding tag to issue:', error)
    return { success: false, error: 'Failed to add tag to issue' }
  }
}

export function removeTagFromIssue(
  issueId: string,
  tagId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  try {
    db.prepare('DELETE FROM issue_tags WHERE issue_id = ? AND tag_id = ?').run(issueId, tagId)
    return { success: true }
  } catch (error) {
    console.error('Error removing tag from issue:', error)
    return { success: false, error: 'Failed to remove tag from issue' }
  }
}

export function getIssueTags(issueId: string): Tag[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT t.* FROM tags t
    JOIN issue_tags it ON it.tag_id = t.id
    WHERE it.issue_id = ?
    ORDER BY t.name
  `).all(issueId) as Tag[]
}

export function setIssueTags(
  issueId: string,
  tagIds: string[],
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()
  const now = new Date().toISOString()

  try {
    db.transaction(() => {
      db.prepare('DELETE FROM issue_tags WHERE issue_id = ?').run(issueId)

      const insert = db.prepare(`
        INSERT INTO issue_tags (issue_id, tag_id, created_by, created_at)
        VALUES (?, ?, ?, ?)
      `)
      for (const tagId of tagIds) {
        insert.run(issueId, tagId, userId, now)
      }
    })()

    return { success: true }
  } catch (error) {
    console.error('Error setting issue tags:', error)
    return { success: false, error: 'Failed to set issue tags' }
  }
}

// Letter Tags
export function addTagToLetter(
  letterId: string,
  tagId: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()
  const now = new Date().toISOString()

  try {
    db.prepare(`
      INSERT OR IGNORE INTO letter_tags (letter_id, tag_id, created_by, created_at)
      VALUES (?, ?, ?, ?)
    `).run(letterId, tagId, userId, now)

    return { success: true }
  } catch (error) {
    console.error('Error adding tag to letter:', error)
    return { success: false, error: 'Failed to add tag to letter' }
  }
}

export function removeTagFromLetter(
  letterId: string,
  tagId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  try {
    db.prepare('DELETE FROM letter_tags WHERE letter_id = ? AND tag_id = ?').run(letterId, tagId)
    return { success: true }
  } catch (error) {
    console.error('Error removing tag from letter:', error)
    return { success: false, error: 'Failed to remove tag from letter' }
  }
}

export function getLetterTags(letterId: string): Tag[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT t.* FROM tags t
    JOIN letter_tags lt ON lt.tag_id = t.id
    WHERE lt.letter_id = ?
    ORDER BY t.name
  `).all(letterId) as Tag[]
}

export function setLetterTags(
  letterId: string,
  tagIds: string[],
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()
  const now = new Date().toISOString()

  try {
    db.transaction(() => {
      db.prepare('DELETE FROM letter_tags WHERE letter_id = ?').run(letterId)

      const insert = db.prepare(`
        INSERT INTO letter_tags (letter_id, tag_id, created_by, created_at)
        VALUES (?, ?, ?, ?)
      `)
      for (const tagId of tagIds) {
        insert.run(letterId, tagId, userId, now)
      }
    })()

    return { success: true }
  } catch (error) {
    console.error('Error setting letter tags:', error)
    return { success: false, error: 'Failed to set letter tags' }
  }
}

// Search by tags
export function getRecordsByTag(tagId: string): { id: string; title: string; topic_id: string }[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT r.id, r.title, r.topic_id FROM records r
    JOIN record_tags rt ON rt.record_id = r.id
    WHERE rt.tag_id = ? AND r.deleted_at IS NULL
    ORDER BY r.created_at DESC
  `).all(tagId) as { id: string; title: string; topic_id: string }[]
}

export function getIssuesByTag(tagId: string): { id: string; title: string; status: string }[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT i.id, i.title, i.status FROM issues i
    JOIN issue_tags it ON it.issue_id = i.id
    WHERE it.tag_id = ?
    ORDER BY i.created_at DESC
  `).all(tagId) as { id: string; title: string; status: string }[]
}

export function getLettersByTag(tagId: string): { id: string; subject: string; status: string }[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT l.id, l.subject, l.status FROM letters l
    JOIN letter_tags lt ON lt.letter_id = l.id
    WHERE lt.tag_id = ? AND l.deleted_at IS NULL
    ORDER BY l.created_at DESC
  `).all(tagId) as { id: string; subject: string; status: string }[]
}

// MOM Tags
export function addTagToMom(
  momId: string,
  tagId: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()
  const now = new Date().toISOString()

  try {
    db.prepare(`
      INSERT OR IGNORE INTO mom_tags (mom_id, tag_id, created_by, created_at)
      VALUES (?, ?, ?, ?)
    `).run(momId, tagId, userId, now)

    return { success: true }
  } catch (error) {
    console.error('Error adding tag to MOM:', error)
    return { success: false, error: 'Failed to add tag to MOM' }
  }
}

export function removeTagFromMom(
  momId: string,
  tagId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  try {
    db.prepare('DELETE FROM mom_tags WHERE mom_id = ? AND tag_id = ?').run(momId, tagId)
    return { success: true }
  } catch (error) {
    console.error('Error removing tag from MOM:', error)
    return { success: false, error: 'Failed to remove tag from MOM' }
  }
}

export function getMomTags(momId: string): Tag[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT t.* FROM tags t
    JOIN mom_tags mt ON mt.tag_id = t.id
    WHERE mt.mom_id = ?
    ORDER BY t.name
  `).all(momId) as Tag[]
}

export function setMomTags(
  momId: string,
  tagIds: string[],
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()
  const now = new Date().toISOString()

  try {
    db.transaction(() => {
      db.prepare('DELETE FROM mom_tags WHERE mom_id = ?').run(momId)

      const insert = db.prepare(`
        INSERT INTO mom_tags (mom_id, tag_id, created_by, created_at)
        VALUES (?, ?, ?, ?)
      `)
      for (const tagId of tagIds) {
        insert.run(momId, tagId, userId, now)
      }
    })()

    return { success: true }
  } catch (error) {
    console.error('Error setting MOM tags:', error)
    return { success: false, error: 'Failed to set MOM tags' }
  }
}

export function getMomsByTag(tagId: string): { id: string; title: string; meeting_date: string }[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT m.id, m.title, m.meeting_date FROM moms m
    JOIN mom_tags mt ON mt.mom_id = m.id
    WHERE mt.tag_id = ? AND m.deleted_at IS NULL
    ORDER BY m.meeting_date DESC
  `).all(tagId) as { id: string; title: string; meeting_date: string }[]
}
