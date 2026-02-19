import * as fs from 'fs'
import * as path from 'path'
import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'
import { generateId } from '../utils/crypto'
import { getBasePath, ensureDirectory } from '../utils/fileSystem'
import { getUsername } from './auth.service'
import * as crypto from 'crypto'

// ===== Types =====

export interface MomLocation {
  id: string
  name: string
  description: string | null
  sort_order: number
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Mom {
  id: string
  mom_id: string
  title: string
  subject: string | null
  meeting_date: string | null
  location_id: string | null
  status: string
  storage_path: string | null
  original_filename: string | null
  file_type: string | null
  file_size: number | null
  checksum: string | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  location_name?: string
  creator_name?: string
  topic_count?: number
  record_count?: number
  action_total?: number
  action_resolved?: number
  action_overdue?: number
}

export interface MomAction {
  id: string
  mom_internal_id: string
  description: string
  responsible_party: string | null
  deadline: string | null
  reminder_date: string | null
  reminder_notified: number
  status: string
  resolution_note: string | null
  resolution_file_path: string | null
  resolution_filename: string | null
  resolution_file_size: number | null
  resolved_by: string | null
  resolved_at: string | null
  created_by: string
  created_at: string
  updated_at: string
  creator_name?: string
  resolver_name?: string
}

export interface MomDraft {
  id: string
  mom_internal_id: string
  version: number
  title: string
  description: string | null
  storage_path: string | null
  original_filename: string | null
  file_type: string | null
  file_size: number | null
  checksum: string | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  creator_name?: string
}

export interface MomHistory {
  id: string
  mom_internal_id: string
  action: string
  field_name: string | null
  old_value: string | null
  new_value: string | null
  details: string | null
  created_by: string
  created_at: string
  creator_name?: string
}

export interface CreateMomData {
  mom_id?: string
  title: string
  subject?: string
  meeting_date?: string
  location_id?: string
  topic_ids?: string[]
  record_ids?: string[]
}

export interface UpdateMomData {
  title?: string
  subject?: string
  meeting_date?: string
  location_id?: string
}

export interface CreateMomLocationData {
  name: string
  description?: string
  sort_order?: number
}

export interface UpdateMomLocationData {
  name?: string
  description?: string
  sort_order?: number
}

export interface CreateMomActionData {
  mom_internal_id: string
  description: string
  responsible_party?: string
  deadline?: string
  reminder_date?: string
}

export interface UpdateMomActionData {
  description?: string
  responsible_party?: string
  deadline?: string
  reminder_date?: string
}

export interface ResolveMomActionData {
  resolution_note: string
}

export interface CreateMomDraftData {
  mom_internal_id: string
  title: string
  description?: string
}

export interface MomFilters {
  query?: string
  status?: string
  location_id?: string
  topic_id?: string
  date_from?: string
  date_to?: string
  limit?: number
  offset?: number
}

export interface PaginatedMoms {
  data: Mom[]
  total: number
  hasMore: boolean
}

// ===== Helpers =====

function getMomBasePath(): string {
  return path.join(getBasePath(), 'data', 'mom')
}

function calculateChecksum(filePath: string): string {
  const buffer = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function addHistory(
  momInternalId: string,
  action: string,
  userId: string,
  fieldName?: string | null,
  oldValue?: string | null,
  newValue?: string | null,
  details?: string | null
): string {
  const db = getDatabase()
  const id = generateId()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO mom_history (id, mom_internal_id, action, field_name, old_value, new_value, details, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, momInternalId, action, fieldName || null, oldValue || null, newValue || null, details || null, userId, now)

  return id
}

function ensureMomFolder(storagePath: string): void {
  const fullPath = path.join(getMomBasePath(), storagePath)
  ensureDirectory(path.join(fullPath, 'mom'))
  ensureDirectory(path.join(fullPath, 'drafts'))
  ensureDirectory(path.join(fullPath, 'actions'))
}

// Clean up empty parent directories after deleting a MOM folder
// Goes up the tree (day -> month -> year) and removes empty folders
function cleanupEmptyParentFolders(storagePath: string): void {
  const momBasePath = getMomBasePath()
  // storagePath is like "2026/02/08/MOM_ID_Title"
  // We want to check and delete empty: 2026/02/08, then 2026/02, then 2026
  const parts = storagePath.split('/')

  // Remove the MOM folder name, leaving just date parts
  parts.pop()

  // Walk up the tree: day folder, month folder, year folder
  while (parts.length > 0) {
    const checkPath = path.join(momBasePath, ...parts)
    try {
      if (fs.existsSync(checkPath)) {
        const contents = fs.readdirSync(checkPath)
        if (contents.length === 0) {
          // Folder is empty, safe to delete
          fs.rmdirSync(checkPath)
        } else {
          // Folder has other contents, stop here
          break
        }
      }
    } catch (err) {
      console.error('Error cleaning up parent folder:', checkPath, err)
      break
    }
    parts.pop()
  }
}

function writeMetadata(momInternalId: string): void {
  const db = getDatabase()
  const mom = db.prepare(`
    SELECT m.*, ml.name as location_name, u.display_name as creator_name
    FROM moms m
    LEFT JOIN mom_locations ml ON m.location_id = ml.id
    LEFT JOIN users u ON m.created_by = u.id
    WHERE m.id = ?
  `).get(momInternalId) as Mom | undefined

  if (!mom?.storage_path) return

  const topics = db.prepare(`
    SELECT t.title FROM mom_topic_links mtl
    JOIN topics t ON mtl.topic_id = t.id
    WHERE mtl.mom_internal_id = ?
  `).all(momInternalId) as { title: string }[]

  const actions = db.prepare(`
    SELECT * FROM mom_actions WHERE mom_internal_id = ?
  `).all(momInternalId) as MomAction[]

  const metadata = {
    mom_id: mom.mom_id,
    title: mom.title,
    subject: mom.subject,
    meeting_date: mom.meeting_date,
    location: mom.location_name,
    status: mom.status,
    creator: mom.creator_name,
    created_at: mom.created_at,
    topics: topics.map(t => t.title),
    actions: actions.map(a => ({
      description: a.description,
      responsible_party: a.responsible_party,
      deadline: a.deadline,
      status: a.status
    })),
    exported_at: new Date().toISOString()
  }

  const metadataPath = path.join(getMomBasePath(), mom.storage_path, 'metadata.json')
  try {
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
  } catch (err) {
    console.error('Error writing MOM metadata:', err)
  }
}

function checkAutoClose(momInternalId: string): void {
  const db = getDatabase()
  const openActions = (db.prepare(
    "SELECT COUNT(*) as count FROM mom_actions WHERE mom_internal_id = ? AND status = 'open'"
  ).get(momInternalId) as { count: number }).count

  if (openActions === 0) {
    const mom = db.prepare("SELECT status FROM moms WHERE id = ?").get(momInternalId) as { status: string } | undefined
    if (mom?.status === 'open') {
      const totalActions = (db.prepare(
        "SELECT COUNT(*) as count FROM mom_actions WHERE mom_internal_id = ?"
      ).get(momInternalId) as { count: number }).count

      if (totalActions > 0) {
        db.prepare("UPDATE moms SET status = 'closed', updated_at = ? WHERE id = ?").run(new Date().toISOString(), momInternalId)
        addHistory(momInternalId, 'status_change', 'system', 'status', 'open', 'closed', 'Auto-closed: all actions resolved')
      }
    }
  }
}

function checkAutoReopen(momInternalId: string): void {
  const db = getDatabase()
  const mom = db.prepare("SELECT status FROM moms WHERE id = ?").get(momInternalId) as { status: string } | undefined
  if (mom?.status === 'closed') {
    db.prepare("UPDATE moms SET status = 'open', updated_at = ? WHERE id = ?").run(new Date().toISOString(), momInternalId)
    addHistory(momInternalId, 'status_change', 'system', 'status', 'closed', 'open', 'Auto-reopened: action reopened')
  }
}

// ===== Location Management =====

export function createLocation(
  data: CreateMomLocationData,
  userId: string
): { success: boolean; location?: MomLocation; error?: string } {
  const db = getDatabase()

  if (!data.name?.trim()) {
    return { success: false, error: 'Name is required' }
  }

  const id = generateId()
  const now = new Date().toISOString()

  try {
    db.prepare(`
      INSERT INTO mom_locations (id, name, description, sort_order, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.name.trim(), data.description?.trim() || null, data.sort_order ?? 0, userId, now, now)

    logAudit('MOM_LOCATION_CREATE', userId, getUsername(userId), 'mom_location', id, { name: data.name.trim() })

    const location = db.prepare('SELECT * FROM mom_locations WHERE id = ?').get(id) as MomLocation
    return { success: true, location }
  } catch (error) {
    console.error('Error creating location:', error)
    return { success: false, error: 'Failed to create location' }
  }
}

export function updateLocation(
  id: string,
  data: UpdateMomLocationData,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = db.prepare('SELECT * FROM mom_locations WHERE id = ? AND deleted_at IS NULL').get(id) as MomLocation | undefined
  if (!existing) {
    return { success: false, error: 'Location not found' }
  }

  const fields: string[] = []
  const values: unknown[] = []

  if (data.name !== undefined) {
    if (!data.name.trim()) return { success: false, error: 'Name cannot be empty' }
    fields.push('name = ?')
    values.push(data.name.trim())
  }
  if (data.description !== undefined) {
    fields.push('description = ?')
    values.push(data.description?.trim() || null)
  }
  if (data.sort_order !== undefined) {
    fields.push('sort_order = ?')
    values.push(data.sort_order)
  }

  if (fields.length === 0) return { success: true }

  fields.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id)

  try {
    db.prepare(`UPDATE mom_locations SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    logAudit('MOM_LOCATION_UPDATE', userId, getUsername(userId), 'mom_location', id, { name: existing.name })
    return { success: true }
  } catch (error) {
    console.error('Error updating location:', error)
    return { success: false, error: 'Failed to update location' }
  }
}

export function deleteLocation(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = db.prepare('SELECT * FROM mom_locations WHERE id = ? AND deleted_at IS NULL').get(id) as MomLocation | undefined
  if (!existing) {
    return { success: false, error: 'Location not found' }
  }

  // Check if used by any MOM
  const used = (db.prepare(
    'SELECT COUNT(*) as count FROM moms WHERE location_id = ? AND deleted_at IS NULL'
  ).get(id) as { count: number }).count

  if (used > 0) {
    return { success: false, error: `Location is used by ${used} MOM(s). Remove references first.` }
  }

  try {
    db.prepare('UPDATE mom_locations SET deleted_at = ? WHERE id = ?').run(new Date().toISOString(), id)
    logAudit('MOM_LOCATION_DELETE', userId, getUsername(userId), 'mom_location', id, { name: existing.name })
    return { success: true }
  } catch (error) {
    console.error('Error deleting location:', error)
    return { success: false, error: 'Failed to delete location' }
  }
}

export function getAllLocations(): MomLocation[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM mom_locations WHERE deleted_at IS NULL ORDER BY sort_order, name').all() as MomLocation[]
}

// ===== MOM CRUD =====

export function createMom(
  data: CreateMomData,
  userId: string
): { success: boolean; mom?: Mom; error?: string } {
  const db = getDatabase()

  if (!data.title?.trim()) return { success: false, error: 'Title is required' }

  // Check uniqueness of mom_id when provided
  if (data.mom_id?.trim()) {
    const existing = db.prepare('SELECT id FROM moms WHERE mom_id = ?').get(data.mom_id.trim())
    if (existing) {
      return { success: false, error: `MOM ID "${data.mom_id.trim()}" already exists` }
    }
  }

  const id = generateId()
  const now = new Date().toISOString()
  const meetingDate = data.meeting_date || now.split('T')[0]

  // Storage path: YYYY/MM/DD/mom_id_title or internal id
  const d = new Date(meetingDate)
  const year = d.getFullYear().toString()
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  // Sanitize MOM ID and title for filesystem - replace slashes and invalid chars with underscores
  const sanitize = (str: string) => str.replace(/[/\\:*?"<>|]/g, '_').replace(/\s+/g, '_')
  const momIdPart = data.mom_id?.trim() ? sanitize(data.mom_id.trim()) : ''
  const titlePart = sanitize(data.title.trim()).substring(0, 50) // Limit title length
  const storageName = momIdPart ? `${momIdPart}_${titlePart}` : `${id}_${titlePart}`
  const storagePath = path.join(year, month, day, storageName).replace(/\\/g, '/')

  try {
    db.transaction(() => {
      // Create MOM
      db.prepare(`
        INSERT INTO moms (id, mom_id, title, subject, meeting_date, location_id, status, storage_path, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)
      `).run(
        id,
        data.mom_id?.trim() || null,
        data.title.trim(),
        data.subject?.trim() || null,
        meetingDate,
        data.location_id || null,
        storagePath,
        userId,
        now,
        now
      )

      // Link topics
      if (data.topic_ids?.length) {
        const linkTopicStmt = db.prepare(
          'INSERT INTO mom_topic_links (id, mom_internal_id, topic_id, created_by, created_at) VALUES (?, ?, ?, ?, ?)'
        )
        for (const topicId of data.topic_ids) {
          linkTopicStmt.run(generateId(), id, topicId, userId, now)
        }
      }

      // Link records
      if (data.record_ids?.length) {
        const linkRecordStmt = db.prepare(
          'INSERT INTO mom_record_links (id, mom_internal_id, record_id, created_by, created_at) VALUES (?, ?, ?, ?, ?)'
        )
        for (const recordId of data.record_ids) {
          linkRecordStmt.run(generateId(), id, recordId, userId, now)
        }
      }

      // Add history
      addHistory(id, 'created', userId)
    })()

    // Create folder structure
    ensureMomFolder(storagePath)
    writeMetadata(id)

    logAudit('MOM_CREATE', userId, getUsername(userId), 'mom', id, { mom_id: data.mom_id?.trim() || null, title: data.title.trim() })

    const mom = getMomById(id)
    return { success: true, mom: mom || undefined }
  } catch (error) {
    console.error('Error creating MOM:', error)
    return { success: false, error: 'Failed to create MOM' }
  }
}

export function getMomById(id: string): Mom | null {
  const db = getDatabase()

  const mom = db.prepare(`
    SELECT
      m.*,
      ml.name as location_name,
      u.display_name as creator_name,
      (SELECT COUNT(*) FROM mom_topic_links WHERE mom_internal_id = m.id) as topic_count,
      (SELECT COUNT(*) FROM mom_record_links WHERE mom_internal_id = m.id) as record_count,
      (SELECT COUNT(*) FROM mom_actions WHERE mom_internal_id = m.id) as action_total,
      (SELECT COUNT(*) FROM mom_actions WHERE mom_internal_id = m.id AND status = 'resolved') as action_resolved,
      (SELECT COUNT(*) FROM mom_actions WHERE mom_internal_id = m.id AND status = 'open' AND deadline IS NOT NULL AND datetime(deadline) < datetime('now')) as action_overdue
    FROM moms m
    LEFT JOIN mom_locations ml ON m.location_id = ml.id
    LEFT JOIN users u ON m.created_by = u.id
    WHERE m.id = ? AND m.deleted_at IS NULL
  `).get(id) as Mom | undefined

  return mom || null
}

export function getMomByMomId(momId: string): Mom | null {
  const db = getDatabase()

  const mom = db.prepare(`
    SELECT
      m.*,
      ml.name as location_name,
      u.display_name as creator_name,
      (SELECT COUNT(*) FROM mom_topic_links WHERE mom_internal_id = m.id) as topic_count,
      (SELECT COUNT(*) FROM mom_record_links WHERE mom_internal_id = m.id) as record_count,
      (SELECT COUNT(*) FROM mom_actions WHERE mom_internal_id = m.id) as action_total,
      (SELECT COUNT(*) FROM mom_actions WHERE mom_internal_id = m.id AND status = 'resolved') as action_resolved,
      (SELECT COUNT(*) FROM mom_actions WHERE mom_internal_id = m.id AND status = 'open' AND deadline IS NOT NULL AND datetime(deadline) < datetime('now')) as action_overdue
    FROM moms m
    LEFT JOIN mom_locations ml ON m.location_id = ml.id
    LEFT JOIN users u ON m.created_by = u.id
    WHERE m.mom_id = ? AND m.deleted_at IS NULL
  `).get(momId) as Mom | undefined

  return mom || null
}

export function getAllMoms(filters?: MomFilters): PaginatedMoms {
  const db = getDatabase()

  const conditions: string[] = ['m.deleted_at IS NULL']
  const values: unknown[] = []

  if (filters?.status) {
    conditions.push('m.status = ?')
    values.push(filters.status)
  }

  if (filters?.location_id) {
    conditions.push('m.location_id = ?')
    values.push(filters.location_id)
  }

  if (filters?.topic_id) {
    conditions.push('EXISTS (SELECT 1 FROM mom_topic_links mtl WHERE mtl.mom_internal_id = m.id AND mtl.topic_id = ?)')
    values.push(filters.topic_id)
  }

  if (filters?.date_from) {
    conditions.push('m.meeting_date >= ?')
    values.push(filters.date_from)
  }

  if (filters?.date_to) {
    conditions.push('m.meeting_date <= ?')
    values.push(filters.date_to)
  }

  if (filters?.query?.trim()) {
    // Use FTS if available, fallback to LIKE
    conditions.push("(m.mom_id LIKE ? OR m.title LIKE ? OR m.subject LIKE ?)")
    const q = `%${filters.query.trim()}%`
    values.push(q, q, q)
  }

  const whereClause = conditions.join(' AND ')

  // Get total count first
  const countResult = db.prepare(`
    SELECT COUNT(*) as count FROM moms m WHERE ${whereClause}
  `).get(...values) as { count: number }
  const total = countResult.count

  // Build main query with pagination
  let query = `
    SELECT
      m.*,
      ml.name as location_name,
      u.display_name as creator_name,
      (SELECT COUNT(*) FROM mom_topic_links WHERE mom_internal_id = m.id) as topic_count,
      (SELECT COUNT(*) FROM mom_record_links WHERE mom_internal_id = m.id) as record_count,
      (SELECT COUNT(*) FROM mom_actions WHERE mom_internal_id = m.id) as action_total,
      (SELECT COUNT(*) FROM mom_actions WHERE mom_internal_id = m.id AND status = 'resolved') as action_resolved,
      (SELECT COUNT(*) FROM mom_actions WHERE mom_internal_id = m.id AND status = 'open' AND deadline IS NOT NULL AND datetime(deadline) < datetime('now')) as action_overdue
    FROM moms m
    LEFT JOIN mom_locations ml ON m.location_id = ml.id
    LEFT JOIN users u ON m.created_by = u.id
    WHERE ${whereClause}
    ORDER BY m.meeting_date DESC, m.created_at DESC
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

  const moms = db.prepare(query).all(...queryValues) as Mom[]

  const hasMore = filters?.limit ? (filters.offset || 0) + moms.length < total : false

  return { data: moms, total, hasMore }
}

export function updateMom(
  id: string,
  data: UpdateMomData,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = getMomById(id)
  if (!existing) return { success: false, error: 'MOM not found' }

  const fields: string[] = []
  const values: unknown[] = []

  if (data.title !== undefined) {
    if (!data.title.trim()) return { success: false, error: 'Title cannot be empty' }
    if (data.title.trim() !== existing.title) {
      fields.push('title = ?')
      values.push(data.title.trim())
      addHistory(id, 'field_edit', userId, 'title', existing.title, data.title.trim())
    }
  }

  if (data.subject !== undefined) {
    const newSubject = data.subject?.trim() || null
    if (newSubject !== existing.subject) {
      fields.push('subject = ?')
      values.push(newSubject)
      addHistory(id, 'field_edit', userId, 'subject', existing.subject, newSubject)
    }
  }

  if (data.meeting_date !== undefined) {
    if (data.meeting_date !== existing.meeting_date) {
      fields.push('meeting_date = ?')
      values.push(data.meeting_date || null)
      addHistory(id, 'field_edit', userId, 'meeting_date', existing.meeting_date, data.meeting_date)
    }
  }

  if (data.location_id !== undefined) {
    if (data.location_id !== existing.location_id) {
      fields.push('location_id = ?')
      values.push(data.location_id || null)
      addHistory(id, 'field_edit', userId, 'location_id', existing.location_id, data.location_id)
    }
  }

  if (fields.length === 0) return { success: true }

  fields.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id)

  try {
    db.prepare(`UPDATE moms SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    logAudit('MOM_UPDATE', userId, getUsername(userId), 'mom', id, { mom_id: existing.mom_id })
    writeMetadata(id)
    return { success: true }
  } catch (error) {
    console.error('Error updating MOM:', error)
    return { success: false, error: 'Failed to update MOM' }
  }
}

export function deleteMom(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = getMomById(id)
  if (!existing) return { success: false, error: 'MOM not found' }

  try {
    // Delete physical folder if it exists
    if (existing.storage_path) {
      const folderPath = path.join(getMomBasePath(), existing.storage_path)
      try {
        if (fs.existsSync(folderPath)) {
          fs.rmSync(folderPath, { recursive: true, force: true })
        }
        // Clean up empty parent date folders (day/month/year)
        cleanupEmptyParentFolders(existing.storage_path)
      } catch (folderError) {
        console.error('Error deleting MOM folder:', folderError)
        // Continue with DB deletion even if folder deletion fails
      }
    }

    db.prepare('UPDATE moms SET deleted_at = ?, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), new Date().toISOString(), id)
    logAudit('MOM_DELETE', userId, getUsername(userId), 'mom', id, { mom_id: existing.mom_id })
    return { success: true }
  } catch (error) {
    console.error('Error deleting MOM:', error)
    return { success: false, error: 'Failed to delete MOM' }
  }
}

export function closeMom(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = getMomById(id)
  if (!existing) return { success: false, error: 'MOM not found' }
  if (existing.status === 'closed') return { success: false, error: 'MOM is already closed' }

  try {
    db.prepare("UPDATE moms SET status = 'closed', updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), id)
    addHistory(id, 'status_change', userId, 'status', 'open', 'closed')
    logAudit('MOM_CLOSE', userId, getUsername(userId), 'mom', id, { mom_id: existing.mom_id })
    writeMetadata(id)
    return { success: true }
  } catch (error) {
    console.error('Error closing MOM:', error)
    return { success: false, error: 'Failed to close MOM' }
  }
}

export function reopenMom(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = getMomById(id)
  if (!existing) return { success: false, error: 'MOM not found' }
  if (existing.status === 'open') return { success: false, error: 'MOM is already open' }

  try {
    db.prepare("UPDATE moms SET status = 'open', updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), id)
    addHistory(id, 'status_change', userId, 'status', 'closed', 'open')
    logAudit('MOM_REOPEN', userId, getUsername(userId), 'mom', id, { mom_id: existing.mom_id })
    writeMetadata(id)
    return { success: true }
  } catch (error) {
    console.error('Error reopening MOM:', error)
    return { success: false, error: 'Failed to reopen MOM' }
  }
}

export function saveMomFile(
  momId: string,
  fileBuffer: Buffer,
  filename: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const mom = db.prepare('SELECT id, storage_path, mom_id FROM moms WHERE id = ? AND deleted_at IS NULL').get(momId) as { id: string; storage_path: string; mom_id: string } | undefined
  if (!mom?.storage_path) return { success: false, error: 'MOM not found' }

  const fullPath = path.join(getMomBasePath(), mom.storage_path, 'mom', filename)

  try {
    ensureDirectory(path.dirname(fullPath))
    fs.writeFileSync(fullPath, fileBuffer)

    const checksum = calculateChecksum(fullPath)
    const ext = path.extname(filename).toLowerCase()

    db.prepare(`
      UPDATE moms SET original_filename = ?, file_type = ?, file_size = ?, checksum = ?, updated_at = ?
      WHERE id = ?
    `).run(filename, ext, fileBuffer.length, checksum, new Date().toISOString(), momId)

    addHistory(momId, 'file_uploaded', userId, 'file', null, filename)
    logAudit('MOM_FILE_UPLOAD', userId, getUsername(userId), 'mom', momId, { filename, mom_id: mom.mom_id })

    return { success: true }
  } catch (error) {
    console.error('Error saving MOM file:', error)
    return { success: false, error: 'Failed to save file' }
  }
}

export function getMomFilePath(momId: string): string | null {
  const db = getDatabase()

  const mom = db.prepare('SELECT storage_path, original_filename FROM moms WHERE id = ?').get(momId) as { storage_path: string; original_filename: string } | undefined
  if (!mom?.storage_path || !mom.original_filename) return null

  return path.join(getMomBasePath(), mom.storage_path, 'mom', mom.original_filename)
}

// Clean up all MOMs - deletes all MOM data and folders
export function deleteAllMoms(userId: string): { success: boolean; deleted: number; error?: string } {
  const db = getDatabase()

  try {
    // Get all MOMs to delete their folders
    const moms = db.prepare('SELECT id, storage_path FROM moms').all() as { id: string; storage_path: string | null }[]

    // Delete all physical folders
    const momBasePath = getMomBasePath()
    try {
      if (fs.existsSync(momBasePath)) {
        // Delete the entire mom data folder and recreate it empty
        fs.rmSync(momBasePath, { recursive: true, force: true })
        ensureDirectory(momBasePath)
      }
    } catch (folderError) {
      console.error('Error deleting MOM folders:', folderError)
    }

    // Delete all MOM-related records from database
    db.transaction(() => {
      db.prepare('DELETE FROM mom_letter_links').run()
      db.prepare('DELETE FROM mom_record_links').run()
      db.prepare('DELETE FROM mom_topic_links').run()
      db.prepare('DELETE FROM mom_history').run()
      db.prepare('DELETE FROM mom_drafts').run()
      db.prepare('DELETE FROM mom_actions').run()
      db.prepare('DELETE FROM moms').run()
    })()

    logAudit('MOM_DELETE_ALL', userId, getUsername(userId), 'system', null, { count: moms.length })

    return { success: true, deleted: moms.length }
  } catch (error) {
    console.error('Error deleting all MOMs:', error)
    return { success: false, deleted: 0, error: 'Failed to delete all MOMs' }
  }
}

export function getMomStats(): {
  total: number
  open: number
  closed: number
  overdueActions: number
} {
  const db = getDatabase()

  const total = (db.prepare("SELECT COUNT(*) as count FROM moms WHERE deleted_at IS NULL").get() as { count: number }).count
  const open = (db.prepare("SELECT COUNT(*) as count FROM moms WHERE status = 'open' AND deleted_at IS NULL").get() as { count: number }).count
  const closed = (db.prepare("SELECT COUNT(*) as count FROM moms WHERE status = 'closed' AND deleted_at IS NULL").get() as { count: number }).count
  const overdueActions = (db.prepare(
    "SELECT COUNT(*) as count FROM mom_actions ma JOIN moms m ON ma.mom_internal_id = m.id WHERE ma.status = 'open' AND ma.deadline IS NOT NULL AND datetime(ma.deadline) < datetime('now') AND m.deleted_at IS NULL"
  ).get() as { count: number }).count

  return { total, open, closed, overdueActions }
}

// ===== Topic/Record Linking =====

export function linkTopic(
  momInternalId: string,
  topicId: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const mom = getMomById(momInternalId)
  if (!mom) return { success: false, error: 'MOM not found' }

  try {
    db.prepare(
      'INSERT INTO mom_topic_links (id, mom_internal_id, topic_id, created_by, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(generateId(), momInternalId, topicId, userId, new Date().toISOString())

    addHistory(momInternalId, 'topic_linked', userId, 'topic_id', null, topicId)
    logAudit('MOM_TOPIC_LINK', userId, getUsername(userId), 'mom', momInternalId, { topic_id: topicId })
    return { success: true }
  } catch (error: any) {
    if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { success: false, error: 'Topic is already linked' }
    }
    console.error('Error linking topic:', error)
    return { success: false, error: 'Failed to link topic' }
  }
}

export function unlinkTopic(
  momInternalId: string,
  topicId: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  // Validate at least 1 topic remains
  const count = (db.prepare(
    'SELECT COUNT(*) as count FROM mom_topic_links WHERE mom_internal_id = ?'
  ).get(momInternalId) as { count: number }).count

  if (count <= 1) {
    return { success: false, error: 'At least one topic must remain linked' }
  }

  try {
    db.prepare('DELETE FROM mom_topic_links WHERE mom_internal_id = ? AND topic_id = ?')
      .run(momInternalId, topicId)
    addHistory(momInternalId, 'topic_unlinked', userId, 'topic_id', topicId, null)
    logAudit('MOM_TOPIC_UNLINK', userId, getUsername(userId), 'mom', momInternalId, { topic_id: topicId })
    return { success: true }
  } catch (error) {
    console.error('Error unlinking topic:', error)
    return { success: false, error: 'Failed to unlink topic' }
  }
}

export function getLinkedTopics(momInternalId: string): { id: string; topic_id: string; topic_title: string | null; created_at: string; deleted_reason?: string | null }[] {
  const db = getDatabase()

  return db.prepare(`
    SELECT
      mtl.id,
      mtl.topic_id,
      t.title as topic_title,
      mtl.created_at,
      CASE
        WHEN t.id IS NULL THEN 'topic_deleted'
        WHEN t.deleted_at IS NOT NULL THEN 'topic_deleted'
        ELSE NULL
      END as deleted_reason
    FROM mom_topic_links mtl
    LEFT JOIN topics t ON mtl.topic_id = t.id
    WHERE mtl.mom_internal_id = ?
    ORDER BY COALESCE(t.title, '')
  `).all(momInternalId) as { id: string; topic_id: string; topic_title: string | null; created_at: string; deleted_reason?: string | null }[]
}

export function linkRecord(
  momInternalId: string,
  recordId: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  try {
    db.prepare(
      'INSERT INTO mom_record_links (id, mom_internal_id, record_id, created_by, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(generateId(), momInternalId, recordId, userId, new Date().toISOString())

    addHistory(momInternalId, 'record_linked', userId, 'record_id', null, recordId)
    logAudit('MOM_RECORD_LINK', userId, getUsername(userId), 'mom', momInternalId, { record_id: recordId })
    return { success: true }
  } catch (error: any) {
    if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { success: false, error: 'Record is already linked' }
    }
    console.error('Error linking record:', error)
    return { success: false, error: 'Failed to link record' }
  }
}

export function unlinkRecord(
  momInternalId: string,
  recordId: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  try {
    db.prepare('DELETE FROM mom_record_links WHERE mom_internal_id = ? AND record_id = ?')
      .run(momInternalId, recordId)
    addHistory(momInternalId, 'record_unlinked', userId, 'record_id', recordId, null)
    logAudit('MOM_RECORD_UNLINK', userId, getUsername(userId), 'mom', momInternalId, { record_id: recordId })
    return { success: true }
  } catch (error) {
    console.error('Error unlinking record:', error)
    return { success: false, error: 'Failed to unlink record' }
  }
}

export function getLinkedRecords(momInternalId: string): { id: string; record_id: string; record_title: string | null; topic_title: string | null; topic_id: string | null; created_at: string; deleted_reason?: string | null }[] {
  const db = getDatabase()

  return db.prepare(`
    SELECT
      mrl.id,
      mrl.record_id,
      r.title as record_title,
      t.title as topic_title,
      r.topic_id,
      mrl.created_at,
      CASE
        WHEN r.id IS NULL THEN 'record_deleted'
        WHEN r.deleted_at IS NOT NULL AND t.deleted_at IS NOT NULL THEN 'topic_deleted'
        WHEN r.deleted_at IS NOT NULL THEN 'record_deleted'
        WHEN t.deleted_at IS NOT NULL THEN 'topic_deleted'
        ELSE NULL
      END as deleted_reason
    FROM mom_record_links mrl
    LEFT JOIN records r ON mrl.record_id = r.id
    LEFT JOIN topics t ON r.topic_id = t.id
    WHERE mrl.mom_internal_id = ?
    ORDER BY COALESCE(r.title, '')
  `).all(momInternalId) as { id: string; record_id: string; record_title: string | null; topic_title: string | null; topic_id: string | null; created_at: string; deleted_reason?: string | null }[]
}

export function getMomsByTopic(topicId: string): Mom[] {
  const db = getDatabase()

  return db.prepare(`
    SELECT
      m.*,
      ml.name as location_name,
      u.display_name as creator_name,
      (SELECT COUNT(*) FROM mom_topic_links WHERE mom_internal_id = m.id) as topic_count,
      (SELECT COUNT(*) FROM mom_record_links WHERE mom_internal_id = m.id) as record_count,
      (SELECT COUNT(*) FROM mom_actions WHERE mom_internal_id = m.id) as action_total,
      (SELECT COUNT(*) FROM mom_actions WHERE mom_internal_id = m.id AND status = 'resolved') as action_resolved,
      (SELECT COUNT(*) FROM mom_actions WHERE mom_internal_id = m.id AND status = 'open' AND deadline IS NOT NULL AND datetime(deadline) < datetime('now')) as action_overdue
    FROM moms m
    JOIN mom_topic_links mtl ON mtl.mom_internal_id = m.id AND mtl.topic_id = ?
    LEFT JOIN mom_locations ml ON m.location_id = ml.id
    LEFT JOIN users u ON m.created_by = u.id
    WHERE m.deleted_at IS NULL
    ORDER BY m.meeting_date DESC
  `).all(topicId) as Mom[]
}

export function getMomsByRecord(recordId: string): Mom[] {
  const db = getDatabase()

  return db.prepare(`
    SELECT
      m.*,
      ml.name as location_name,
      u.display_name as creator_name,
      (SELECT COUNT(*) FROM mom_topic_links WHERE mom_internal_id = m.id) as topic_count,
      (SELECT COUNT(*) FROM mom_record_links WHERE mom_internal_id = m.id) as record_count,
      (SELECT COUNT(*) FROM mom_actions WHERE mom_internal_id = m.id) as action_total,
      (SELECT COUNT(*) FROM mom_actions WHERE mom_internal_id = m.id AND status = 'resolved') as action_resolved,
      (SELECT COUNT(*) FROM mom_actions WHERE mom_internal_id = m.id AND status = 'open' AND deadline IS NOT NULL AND datetime(deadline) < datetime('now')) as action_overdue
    FROM moms m
    JOIN mom_record_links mrl ON mrl.mom_internal_id = m.id AND mrl.record_id = ?
    LEFT JOIN mom_locations ml ON m.location_id = ml.id
    LEFT JOIN users u ON m.created_by = u.id
    WHERE m.deleted_at IS NULL
    ORDER BY m.meeting_date DESC
  `).all(recordId) as Mom[]
}

// ===== Actions Management =====

export function createAction(
  data: CreateMomActionData,
  userId: string
): { success: boolean; action?: MomAction; error?: string } {
  const db = getDatabase()

  if (!data.description?.trim()) return { success: false, error: 'Description is required' }

  const mom = getMomById(data.mom_internal_id)
  if (!mom) return { success: false, error: 'MOM not found' }

  const id = generateId()
  const now = new Date().toISOString()

  try {
    db.prepare(`
      INSERT INTO mom_actions (id, mom_internal_id, description, responsible_party, deadline, reminder_date, status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
    `).run(
      id,
      data.mom_internal_id,
      data.description.trim(),
      data.responsible_party?.trim() || null,
      data.deadline || null,
      data.reminder_date || null,
      userId,
      now,
      now
    )

    addHistory(data.mom_internal_id, 'action_created', userId, null, null, null, data.description.trim())
    logAudit('MOM_ACTION_CREATE', userId, getUsername(userId), 'mom_action', id, { mom_id: mom.mom_id })
    writeMetadata(data.mom_internal_id)

    const action = getActionById(id)
    return { success: true, action: action || undefined }
  } catch (error) {
    console.error('Error creating action:', error)
    return { success: false, error: 'Failed to create action' }
  }
}

export function getActionById(id: string): MomAction | null {
  const db = getDatabase()

  const action = db.prepare(`
    SELECT ma.*, u.display_name as creator_name, u2.display_name as resolver_name
    FROM mom_actions ma
    LEFT JOIN users u ON ma.created_by = u.id
    LEFT JOIN users u2 ON ma.resolved_by = u2.id
    WHERE ma.id = ?
  `).get(id) as MomAction | undefined

  return action || null
}

export function getActionsByMom(momInternalId: string): MomAction[] {
  const db = getDatabase()

  return db.prepare(`
    SELECT ma.*, u.display_name as creator_name, u2.display_name as resolver_name
    FROM mom_actions ma
    LEFT JOIN users u ON ma.created_by = u.id
    LEFT JOIN users u2 ON ma.resolved_by = u2.id
    WHERE ma.mom_internal_id = ?
    ORDER BY
      CASE ma.status WHEN 'open' THEN 0 ELSE 1 END,
      ma.deadline ASC NULLS LAST,
      ma.created_at ASC
  `).all(momInternalId) as MomAction[]
}

export function updateAction(
  id: string,
  data: UpdateMomActionData,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = getActionById(id)
  if (!existing) return { success: false, error: 'Action not found' }

  const fields: string[] = []
  const values: unknown[] = []

  if (data.description !== undefined) {
    if (!data.description.trim()) return { success: false, error: 'Description cannot be empty' }
    if (data.description.trim() !== existing.description) {
      fields.push('description = ?')
      values.push(data.description.trim())
      addHistory(existing.mom_internal_id, 'action_updated', userId, 'description', existing.description, data.description.trim())
    }
  }

  if (data.responsible_party !== undefined) {
    const newVal = data.responsible_party?.trim() || null
    if (newVal !== existing.responsible_party) {
      fields.push('responsible_party = ?')
      values.push(newVal)
      addHistory(existing.mom_internal_id, 'action_updated', userId, 'responsible_party', existing.responsible_party, newVal)
    }
  }

  if (data.deadline !== undefined) {
    if (data.deadline !== existing.deadline) {
      fields.push('deadline = ?')
      values.push(data.deadline || null)
      addHistory(existing.mom_internal_id, 'action_updated', userId, 'deadline', existing.deadline, data.deadline)
    }
  }

  if (data.reminder_date !== undefined) {
    if (data.reminder_date !== existing.reminder_date) {
      fields.push('reminder_date = ?')
      values.push(data.reminder_date || null)
      fields.push('reminder_notified = 0')
      addHistory(existing.mom_internal_id, 'action_reminder_change', userId, 'reminder_date', existing.reminder_date, data.reminder_date)
    }
  }

  if (fields.length === 0) return { success: true }

  fields.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id)

  try {
    db.prepare(`UPDATE mom_actions SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    logAudit('MOM_ACTION_UPDATE', userId, getUsername(userId), 'mom_action', id, {})
    writeMetadata(existing.mom_internal_id)
    return { success: true }
  } catch (error) {
    console.error('Error updating action:', error)
    return { success: false, error: 'Failed to update action' }
  }
}

export function resolveAction(
  id: string,
  data: ResolveMomActionData,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = getActionById(id)
  if (!existing) return { success: false, error: 'Action not found' }
  if (existing.status === 'resolved') return { success: false, error: 'Action is already resolved' }
  if (!data.resolution_note?.trim()) return { success: false, error: 'Resolution note is required' }

  const now = new Date().toISOString()

  // Core database update - this is the critical operation
  try {
    db.prepare(`
      UPDATE mom_actions SET status = 'resolved', resolution_note = ?, resolved_by = ?, resolved_at = ?, updated_at = ?
      WHERE id = ?
    `).run(data.resolution_note.trim(), userId, now, now, id)
  } catch (error) {
    console.error('Error resolving action:', error)
    return { success: false, error: 'Failed to resolve action' }
  }

  // Auxiliary operations - failures here shouldn't affect the main result
  try {
    addHistory(existing.mom_internal_id, 'action_resolved', userId, null, null, null, data.resolution_note.trim())
    logAudit('MOM_ACTION_RESOLVE', userId, getUsername(userId), 'mom_action', id, {})
  } catch (error) {
    console.error('Error logging action resolution:', error)
  }

  try {
    checkAutoClose(existing.mom_internal_id)
  } catch (error) {
    console.error('Error checking auto-close:', error)
  }

  try {
    writeMetadata(existing.mom_internal_id)
  } catch (error) {
    console.error('Error writing metadata:', error)
  }

  return { success: true }
}

export function reopenAction(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = getActionById(id)
  if (!existing) return { success: false, error: 'Action not found' }
  if (existing.status === 'open') return { success: false, error: 'Action is already open' }

  // Core database update
  try {
    db.prepare(`
      UPDATE mom_actions SET status = 'open', resolution_note = NULL, resolved_by = NULL, resolved_at = NULL, updated_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), id)
  } catch (error) {
    console.error('Error reopening action:', error)
    return { success: false, error: 'Failed to reopen action' }
  }

  // Auxiliary operations
  try {
    addHistory(existing.mom_internal_id, 'action_reopened', userId, 'status', 'resolved', 'open')
    logAudit('MOM_ACTION_REOPEN', userId, getUsername(userId), 'mom_action', id, {})
  } catch (error) {
    console.error('Error logging action reopen:', error)
  }

  try {
    checkAutoReopen(existing.mom_internal_id)
  } catch (error) {
    console.error('Error checking auto-reopen:', error)
  }

  try {
    writeMetadata(existing.mom_internal_id)
  } catch (error) {
    console.error('Error writing metadata:', error)
  }

  return { success: true }
}

export function saveActionResolutionFile(
  actionId: string,
  fileBuffer: Buffer,
  filename: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const action = getActionById(actionId)
  if (!action) return { success: false, error: 'Action not found' }

  const mom = db.prepare('SELECT storage_path FROM moms WHERE id = ?').get(action.mom_internal_id) as { storage_path: string } | undefined
  if (!mom?.storage_path) return { success: false, error: 'MOM not found' }

  const fullPath = path.join(getMomBasePath(), mom.storage_path, 'actions', `${actionId}_${filename}`)

  try {
    ensureDirectory(path.dirname(fullPath))
    fs.writeFileSync(fullPath, fileBuffer)

    db.prepare(`
      UPDATE mom_actions SET resolution_file_path = ?, resolution_filename = ?, resolution_file_size = ?, updated_at = ?
      WHERE id = ?
    `).run(fullPath, filename, fileBuffer.length, new Date().toISOString(), actionId)

    return { success: true }
  } catch (error) {
    console.error('Error saving action resolution file:', error)
    return { success: false, error: 'Failed to save file' }
  }
}

export function getActionResolutionFilePath(actionId: string): string | null {
  const action = getActionById(actionId)
  return action?.resolution_file_path || null
}

// ===== Drafts =====

export function createDraft(
  data: CreateMomDraftData,
  userId: string
): { success: boolean; draft?: MomDraft; error?: string } {
  const db = getDatabase()

  if (!data.title?.trim()) return { success: false, error: 'Title is required' }

  const mom = getMomById(data.mom_internal_id)
  if (!mom) return { success: false, error: 'MOM not found' }

  // Auto-increment version
  const maxVersion = (db.prepare(
    'SELECT MAX(version) as max_ver FROM mom_drafts WHERE mom_internal_id = ?'
  ).get(data.mom_internal_id) as { max_ver: number | null }).max_ver || 0

  const id = generateId()
  const now = new Date().toISOString()
  const version = maxVersion + 1

  try {
    db.prepare(`
      INSERT INTO mom_drafts (id, mom_internal_id, version, title, description, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.mom_internal_id, version, data.title.trim(), data.description?.trim() || null, userId, now, now)

    addHistory(data.mom_internal_id, 'draft_added', userId, 'version', null, version.toString(), data.title.trim())
    logAudit('MOM_DRAFT_CREATE', userId, getUsername(userId), 'mom_draft', id, { mom_id: mom.mom_id, version })

    const draft = getDraftById(id)
    return { success: true, draft: draft || undefined }
  } catch (error) {
    console.error('Error creating draft:', error)
    return { success: false, error: 'Failed to create draft' }
  }
}

export function getDraftById(id: string): MomDraft | null {
  const db = getDatabase()

  const draft = db.prepare(`
    SELECT md.*, u.display_name as creator_name
    FROM mom_drafts md
    LEFT JOIN users u ON md.created_by = u.id
    WHERE md.id = ? AND md.deleted_at IS NULL
  `).get(id) as MomDraft | undefined

  return draft || null
}

export function getDraftsByMom(momInternalId: string): MomDraft[] {
  const db = getDatabase()

  return db.prepare(`
    SELECT md.*, u.display_name as creator_name
    FROM mom_drafts md
    LEFT JOIN users u ON md.created_by = u.id
    WHERE md.mom_internal_id = ? AND md.deleted_at IS NULL
    ORDER BY md.version DESC
  `).all(momInternalId) as MomDraft[]
}

export function getLatestDraft(momInternalId: string): MomDraft | null {
  const db = getDatabase()

  const draft = db.prepare(`
    SELECT md.*, u.display_name as creator_name
    FROM mom_drafts md
    LEFT JOIN users u ON md.created_by = u.id
    WHERE md.mom_internal_id = ? AND md.deleted_at IS NULL
    ORDER BY md.version DESC
    LIMIT 1
  `).get(momInternalId) as MomDraft | undefined

  return draft || null
}

export function saveDraftFile(
  draftId: string,
  fileBuffer: Buffer,
  filename: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const draft = getDraftById(draftId)
  if (!draft) return { success: false, error: 'Draft not found' }

  const mom = db.prepare('SELECT storage_path, mom_id FROM moms WHERE id = ?').get(draft.mom_internal_id) as { storage_path: string; mom_id: string } | undefined
  if (!mom?.storage_path) return { success: false, error: 'MOM not found' }

  const fullPath = path.join(getMomBasePath(), mom.storage_path, 'drafts', `v${draft.version}_${filename}`)

  try {
    ensureDirectory(path.dirname(fullPath))
    fs.writeFileSync(fullPath, fileBuffer)

    const checksum = calculateChecksum(fullPath)
    const ext = path.extname(filename).toLowerCase()

    db.prepare(`
      UPDATE mom_drafts SET storage_path = ?, original_filename = ?, file_type = ?, file_size = ?, checksum = ?, updated_at = ?
      WHERE id = ?
    `).run(fullPath, filename, ext, fileBuffer.length, checksum, new Date().toISOString(), draftId)

    logAudit('MOM_DRAFT_FILE_UPLOAD', userId, getUsername(userId), 'mom_draft', draftId, { filename, mom_id: mom.mom_id })

    return { success: true }
  } catch (error) {
    console.error('Error saving draft file:', error)
    return { success: false, error: 'Failed to save file' }
  }
}

export function getDraftFilePath(draftId: string): string | null {
  const draft = getDraftById(draftId)
  return draft?.storage_path || null
}

export function deleteDraft(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const draft = getDraftById(id)
  if (!draft) return { success: false, error: 'Draft not found' }

  try {
    db.prepare('UPDATE mom_drafts SET deleted_at = ? WHERE id = ?').run(new Date().toISOString(), id)
    logAudit('MOM_DRAFT_DELETE', userId, getUsername(userId), 'mom_draft', id, {})
    return { success: true }
  } catch (error) {
    console.error('Error deleting draft:', error)
    return { success: false, error: 'Failed to delete draft' }
  }
}

// ===== Reminders =====

export function getActionsWithDueReminders(): MomAction[] {
  const db = getDatabase()

  return db.prepare(`
    SELECT ma.*, u.display_name as creator_name
    FROM mom_actions ma
    JOIN moms m ON ma.mom_internal_id = m.id
    LEFT JOIN users u ON ma.created_by = u.id
    WHERE ma.status = 'open'
      AND ma.reminder_date IS NOT NULL
      AND datetime(ma.reminder_date) <= datetime('now')
      AND ma.reminder_notified = 0
      AND m.deleted_at IS NULL
    ORDER BY ma.reminder_date ASC
  `).all() as MomAction[]
}

export function markActionReminderNotified(id: string): { success: boolean; error?: string } {
  const db = getDatabase()

  try {
    db.prepare('UPDATE mom_actions SET reminder_notified = 1 WHERE id = ?').run(id)
    return { success: true }
  } catch (error) {
    console.error('Error marking reminder notified:', error)
    return { success: false, error: 'Failed to mark reminder' }
  }
}

export function getActionsWithReminders(): MomAction[] {
  const db = getDatabase()

  return db.prepare(`
    SELECT ma.*, u.display_name as creator_name, m.mom_id
    FROM mom_actions ma
    JOIN moms m ON ma.mom_internal_id = m.id
    LEFT JOIN users u ON ma.created_by = u.id
    WHERE ma.status = 'open'
      AND ma.reminder_date IS NOT NULL
      AND m.deleted_at IS NULL
    ORDER BY ma.reminder_date ASC
  `).all() as MomAction[]
}

export function getActionsWithDeadlines(): (MomAction & { mom_display_id: string | null; mom_title: string })[] {
  const db = getDatabase()

  return db.prepare(`
    SELECT ma.*, m.mom_id as mom_display_id, m.title as mom_title, u.display_name as creator_name
    FROM mom_actions ma
    JOIN moms m ON ma.mom_internal_id = m.id
    LEFT JOIN users u ON ma.created_by = u.id
    WHERE ma.status = 'open'
      AND ma.deadline IS NOT NULL
      AND m.deleted_at IS NULL
    ORDER BY ma.deadline ASC
  `).all() as (MomAction & { mom_display_id: string | null; mom_title: string })[]
}

// ===== History =====

export function getMomHistory(momInternalId: string): MomHistory[] {
  const db = getDatabase()

  return db.prepare(`
    SELECT mh.*, u.display_name as creator_name
    FROM mom_history mh
    LEFT JOIN users u ON mh.created_by = u.id
    WHERE mh.mom_internal_id = ?
    ORDER BY mh.created_at ASC
  `).all(momInternalId) as MomHistory[]
}

// ===== Letter Linking =====

export function linkLetter(
  momInternalId: string,
  letterInternalId: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  // Validate MOM exists
  const mom = db.prepare('SELECT id, mom_id FROM moms WHERE id = ? AND deleted_at IS NULL').get(momInternalId) as { id: string; mom_id: string | null } | undefined
  if (!mom) return { success: false, error: 'MOM not found' }

  // Validate letter exists
  const letter = db.prepare('SELECT id, letter_id, subject FROM letters WHERE id = ? AND deleted_at IS NULL').get(letterInternalId) as { id: string; letter_id: string | null; subject: string } | undefined
  if (!letter) return { success: false, error: 'Letter not found' }

  // Check if already linked
  const existing = db.prepare('SELECT id FROM mom_letter_links WHERE mom_internal_id = ? AND letter_id = ?').get(momInternalId, letterInternalId)
  if (existing) return { success: false, error: 'Letter is already linked to this MOM' }

  const id = generateId()
  const now = new Date().toISOString()

  try {
    db.prepare(`
      INSERT INTO mom_letter_links (id, mom_internal_id, letter_id, created_by, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, momInternalId, letterInternalId, userId, now)

    addHistory(momInternalId, 'letter_linked', userId, null, null, letter.letter_id || letter.subject, `Linked letter: ${letter.letter_id || letter.subject}`)

    db.prepare('UPDATE moms SET updated_at = ? WHERE id = ?').run(now, momInternalId)
    writeMetadata(momInternalId)

    return { success: true }
  } catch (error) {
    console.error('Error linking letter:', error)
    return { success: false, error: 'Failed to link letter' }
  }
}

export function unlinkLetter(
  momInternalId: string,
  letterInternalId: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const link = db.prepare('SELECT id FROM mom_letter_links WHERE mom_internal_id = ? AND letter_id = ?').get(momInternalId, letterInternalId) as { id: string } | undefined
  if (!link) return { success: false, error: 'Link not found' }

  const letter = db.prepare('SELECT letter_id, subject FROM letters WHERE id = ?').get(letterInternalId) as { letter_id: string | null; subject: string } | undefined

  try {
    db.prepare('DELETE FROM mom_letter_links WHERE id = ?').run(link.id)

    addHistory(momInternalId, 'letter_unlinked', userId, null, letter?.letter_id || letter?.subject || null, null, `Unlinked letter: ${letter?.letter_id || letter?.subject || 'unknown'}`)

    db.prepare('UPDATE moms SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), momInternalId)
    writeMetadata(momInternalId)

    return { success: true }
  } catch (error) {
    console.error('Error unlinking letter:', error)
    return { success: false, error: 'Failed to unlink letter' }
  }
}

export function getLinkedLetters(momInternalId: string): {
  id: string
  mom_internal_id: string
  letter_id: string
  letter_display_id: string | null
  letter_subject: string | null
  letter_type: string | null
  letter_reference_number: string | null
  created_at: string
  deleted_reason?: string | null
}[] {
  const db = getDatabase()

  return db.prepare(`
    SELECT mll.id, mll.mom_internal_id, mll.letter_id,
           l.letter_id as letter_display_id, l.subject as letter_subject,
           l.letter_type, l.reference_number as letter_reference_number,
           mll.created_at,
           CASE
             WHEN l.id IS NULL THEN 'letter_deleted'
             WHEN l.deleted_at IS NOT NULL THEN 'letter_deleted'
             ELSE NULL
           END as deleted_reason
    FROM mom_letter_links mll
    LEFT JOIN letters l ON mll.letter_id = l.id
    WHERE mll.mom_internal_id = ?
    ORDER BY mll.created_at DESC
  `).all(momInternalId) as {
    id: string
    mom_internal_id: string
    letter_id: string
    letter_display_id: string | null
    letter_subject: string | null
    letter_type: string | null
    letter_reference_number: string | null
    created_at: string
    deleted_reason?: string | null
  }[]
}
