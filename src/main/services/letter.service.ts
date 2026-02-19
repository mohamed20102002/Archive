import * as fs from 'fs'
import * as path from 'path'
import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'
import { getBasePath } from '../utils/fileSystem'
import * as crypto from 'crypto'

// Types
export type LetterType = 'incoming' | 'outgoing' | 'internal' | 'draft_only'
export type ResponseType = 'requires_reply' | 'informational' | 'internal_memo' | 'external_correspondence'
export type LetterStatus = 'pending' | 'in_progress' | 'replied' | 'closed' | 'archived'
export type Priority = 'low' | 'normal' | 'high' | 'urgent'

export interface Letter {
  id: string
  letter_id: string | null
  letter_type: LetterType
  response_type: ResponseType | null
  status: LetterStatus
  priority: Priority
  incoming_number: string | null
  outgoing_number: string | null
  reference_number: string | null
  subject: string
  summary: string | null
  content: string | null
  authority_id: string | null
  contact_id: string | null
  topic_id: string
  subcategory_id: string | null
  parent_letter_id: string | null
  storage_path: string | null
  original_filename: string | null
  file_type: string | null
  file_size: number | null
  checksum: string | null
  outlook_entry_id: string | null
  outlook_store_id: string | null
  email_id: string | null
  is_notification: boolean
  letter_date: string | null
  received_date: string | null
  due_date: string | null
  responded_date: string | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  // Joined fields
  authority_name?: string
  authority_short_name?: string
  authority_is_internal?: boolean
  contact_name?: string
  contact_title?: string
  topic_title?: string
  subcategory_title?: string
  parent_letter_subject?: string
  creator_name?: string
  attachment_count?: number
  draft_count?: number
  is_overdue?: boolean
}

export interface CreateLetterData {
  letter_id?: string
  letter_type: LetterType
  response_type?: ResponseType
  status?: LetterStatus
  priority?: Priority
  incoming_number?: string
  outgoing_number?: string
  reference_number?: string
  subject: string
  summary?: string
  content?: string
  authority_id?: string
  contact_id?: string
  topic_id: string
  subcategory_id?: string
  parent_letter_id?: string
  is_notification?: boolean
  letter_date?: string
  received_date?: string
  due_date?: string
}

export interface UpdateLetterData {
  letter_id?: string
  letter_type?: LetterType
  response_type?: ResponseType
  status?: LetterStatus
  priority?: Priority
  incoming_number?: string
  outgoing_number?: string
  reference_number?: string
  subject?: string
  summary?: string
  content?: string
  authority_id?: string
  contact_id?: string
  topic_id?: string
  subcategory_id?: string
  parent_letter_id?: string
  is_notification?: boolean
  letter_date?: string
  received_date?: string
  due_date?: string
  responded_date?: string
}

export interface LetterSearchParams {
  query?: string
  topic_id?: string
  subcategory_id?: string
  authority_id?: string
  letter_type?: LetterType | LetterType[]
  response_type?: ResponseType | ResponseType[]
  status?: LetterStatus | LetterStatus[]
  priority?: Priority | Priority[]
  letter_date_from?: string
  letter_date_to?: string
  received_date_from?: string
  received_date_to?: string
  due_date_from?: string
  due_date_to?: string
  has_attachments?: boolean
  has_drafts?: boolean
  is_overdue?: boolean
  sort_by?: 'received_date' | 'letter_date' | 'due_date' | 'subject' | 'reference_number' | 'created_at'
  sort_order?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

// Helper functions
function generateId(): string {
  return `ltr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function getUsername(userId: string): string {
  const db = getDatabase()
  const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as { username: string } | undefined
  return user?.username || 'unknown'
}

export function getLettersBasePath(): string {
  return path.join(getBasePath(), 'data', 'letters')
}

export function getLetterStoragePath(letterId: string): string {
  const db = getDatabase()
  const letter = db.prepare('SELECT storage_path FROM letters WHERE id = ?').get(letterId) as { storage_path: string } | undefined
  if (!letter?.storage_path) return ''
  return path.join(getLettersBasePath(), letter.storage_path)
}

function ensureLetterFolder(storagePath: string): void {
  const fullPath = path.join(getLettersBasePath(), storagePath)

  // Create folder structure
  fs.mkdirSync(path.join(fullPath, 'original'), { recursive: true })
  fs.mkdirSync(path.join(fullPath, 'attachments'), { recursive: true })
  fs.mkdirSync(path.join(fullPath, 'drafts'), { recursive: true })
}

function calculateChecksum(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(fileBuffer).digest('hex')
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}/${month}/${day}`
}

// Create letter
export function createLetter(
  data: CreateLetterData,
  userId: string
): { success: boolean; letter?: Letter; error?: string } {
  const db = getDatabase()

  // Validate required fields
  if (!data.subject?.trim()) {
    return { success: false, error: 'Subject is required' }
  }
  if (!data.topic_id) {
    return { success: false, error: 'Topic is required' }
  }

  // Validate topic exists
  const topic = db.prepare('SELECT id FROM topics WHERE id = ? AND deleted_at IS NULL').get(data.topic_id)
  if (!topic) {
    return { success: false, error: 'Invalid topic' }
  }

  // Validate authority if provided
  if (data.authority_id) {
    const authority = db.prepare('SELECT id FROM authorities WHERE id = ? AND deleted_at IS NULL').get(data.authority_id)
    if (!authority) {
      return { success: false, error: 'Invalid authority' }
    }
  }

  // Validate contact if provided
  if (data.contact_id) {
    const contact = db.prepare('SELECT id FROM contacts WHERE id = ? AND deleted_at IS NULL').get(data.contact_id)
    if (!contact) {
      return { success: false, error: 'Invalid contact' }
    }
  }

  // Validate parent letter if provided
  if (data.parent_letter_id) {
    const parent = db.prepare('SELECT id FROM letters WHERE id = ? AND deleted_at IS NULL').get(data.parent_letter_id)
    if (!parent) {
      return { success: false, error: 'Invalid parent letter' }
    }
  }

  // Validate letter_id uniqueness if provided
  if (data.letter_id?.trim()) {
    const existingLetterId = db.prepare('SELECT id FROM letters WHERE letter_id = ?').get(data.letter_id.trim())
    if (existingLetterId) {
      return { success: false, error: `Letter ID "${data.letter_id.trim()}" already exists` }
    }
  }

  const id = generateId()
  const now = new Date()
  const storagePath = `${formatDate(now)}/${id}`

  try {
    // Create folder structure
    ensureLetterFolder(storagePath)

    db.prepare(`
      INSERT INTO letters (
        id, letter_id, letter_type, response_type, status, priority,
        incoming_number, outgoing_number, reference_number,
        subject, summary, content,
        authority_id, contact_id, topic_id, subcategory_id, parent_letter_id,
        storage_path, is_notification, letter_date, received_date, due_date,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.letter_id?.trim() || null,
      data.letter_type,
      data.response_type || null,
      data.status || 'pending',
      data.priority || 'normal',
      data.incoming_number?.trim() || null,
      data.outgoing_number?.trim() || null,
      data.reference_number?.trim() || null,
      data.subject.trim(),
      data.summary?.trim() || null,
      data.content?.trim() || null,
      data.authority_id || null,
      data.contact_id || null,
      data.topic_id,
      data.subcategory_id || null,
      data.parent_letter_id || null,
      storagePath,
      data.is_notification ? 1 : 0,
      data.letter_date || null,
      data.received_date || null,
      data.due_date || null,
      userId,
      now.toISOString(),
      now.toISOString()
    )

    // Update topic's updated_at
    db.prepare('UPDATE topics SET updated_at = ? WHERE id = ?').run(now.toISOString(), data.topic_id)

    // Log audit
    logAudit('LETTER_CREATE', userId, getUsername(userId), 'letter', id, {
      subject: data.subject,
      letter_type: data.letter_type,
      topic_id: data.topic_id,
      authority_id: data.authority_id
    })

    const letter = getLetterById(id)
    return { success: true, letter: letter || undefined }
  } catch (error: any) {
    console.error('Error creating letter:', error)
    return { success: false, error: error.message }
  }
}

// Get letter by ID
export function getLetterById(id: string): Letter | null {
  const db = getDatabase()

  const letter = db.prepare(`
    SELECT l.*,
           a.name as authority_name,
           a.short_name as authority_short_name,
           a.is_internal as authority_is_internal,
           c.name as contact_name,
           c.title as contact_title,
           t.title as topic_title,
           s.title as subcategory_title,
           pl.subject as parent_letter_subject,
           u.display_name as creator_name,
           (SELECT COUNT(*) FROM letter_attachments WHERE letter_id = l.id AND deleted_at IS NULL) as attachment_count,
           (SELECT COUNT(*) FROM letter_drafts WHERE letter_id = l.id AND deleted_at IS NULL) as draft_count,
           CASE WHEN l.due_date IS NOT NULL AND l.due_date < date('now') AND l.status NOT IN ('replied', 'closed', 'archived') THEN 1 ELSE 0 END as is_overdue
    FROM letters l
    LEFT JOIN authorities a ON l.authority_id = a.id
    LEFT JOIN contacts c ON l.contact_id = c.id
    LEFT JOIN topics t ON l.topic_id = t.id
    LEFT JOIN subcategories s ON l.subcategory_id = s.id
    LEFT JOIN letters pl ON l.parent_letter_id = pl.id
    LEFT JOIN users u ON l.created_by = u.id
    WHERE l.id = ? AND l.deleted_at IS NULL
  `).get(id) as (Letter & { is_overdue: number; authority_is_internal: number }) | undefined

  if (!letter) return null

  return {
    ...letter,
    is_overdue: letter.is_overdue === 1,
    authority_is_internal: letter.authority_is_internal === 1
  }
}

export interface LetterFilters {
  limit?: number
  offset?: number
}

export interface PaginatedLetters {
  data: Letter[]
  total: number
  hasMore: boolean
}

// Get all letters
export function getAllLetters(filters?: LetterFilters): PaginatedLetters {
  const db = getDatabase()

  // Get total count first
  const countResult = db.prepare(`
    SELECT COUNT(*) as count FROM letters WHERE deleted_at IS NULL
  `).get() as { count: number }
  const total = countResult.count

  let query = `
    SELECT l.*,
           a.name as authority_name,
           a.short_name as authority_short_name,
           a.is_internal as authority_is_internal,
           c.name as contact_name,
           c.title as contact_title,
           t.title as topic_title,
           s.title as subcategory_title,
           u.display_name as creator_name,
           (SELECT COUNT(*) FROM letter_attachments WHERE letter_id = l.id AND deleted_at IS NULL) as attachment_count,
           (SELECT COUNT(*) FROM letter_drafts WHERE letter_id = l.id AND deleted_at IS NULL) as draft_count,
           CASE WHEN l.due_date IS NOT NULL AND l.due_date < date('now') AND l.status NOT IN ('replied', 'closed', 'archived') THEN 1 ELSE 0 END as is_overdue
    FROM letters l
    LEFT JOIN authorities a ON l.authority_id = a.id
    LEFT JOIN contacts c ON l.contact_id = c.id
    LEFT JOIN topics t ON l.topic_id = t.id
    LEFT JOIN subcategories s ON l.subcategory_id = s.id
    LEFT JOIN users u ON l.created_by = u.id
    WHERE l.deleted_at IS NULL
    ORDER BY l.created_at DESC
  `

  const queryValues: unknown[] = []

  if (filters?.limit) {
    query += ' LIMIT ?'
    queryValues.push(filters.limit)
    if (filters?.offset) {
      query += ' OFFSET ?'
      queryValues.push(filters.offset)
    }
  }

  const letters = db.prepare(query).all(...queryValues) as (Letter & { is_overdue: number; authority_is_internal: number })[]

  const data = letters.map(l => ({ ...l, is_overdue: l.is_overdue === 1, authority_is_internal: l.authority_is_internal === 1 }))
  const hasMore = filters?.limit ? (filters.offset || 0) + data.length < total : false

  return { data, total, hasMore }
}

// Get letters by topic
export function getLettersByTopic(topicId: string, subcategoryId?: string | null): Letter[] {
  const db = getDatabase()

  let query = `
    SELECT l.*,
           a.name as authority_name,
           a.short_name as authority_short_name,
           a.is_internal as authority_is_internal,
           c.name as contact_name,
           c.title as contact_title,
           t.title as topic_title,
           s.title as subcategory_title,
           u.display_name as creator_name,
           (SELECT COUNT(*) FROM letter_attachments WHERE letter_id = l.id AND deleted_at IS NULL) as attachment_count,
           (SELECT COUNT(*) FROM letter_drafts WHERE letter_id = l.id AND deleted_at IS NULL) as draft_count,
           CASE WHEN l.due_date IS NOT NULL AND l.due_date < date('now') AND l.status NOT IN ('replied', 'closed', 'archived') THEN 1 ELSE 0 END as is_overdue
    FROM letters l
    LEFT JOIN authorities a ON l.authority_id = a.id
    LEFT JOIN contacts c ON l.contact_id = c.id
    LEFT JOIN topics t ON l.topic_id = t.id
    LEFT JOIN subcategories s ON l.subcategory_id = s.id
    LEFT JOIN users u ON l.created_by = u.id
    WHERE l.topic_id = ? AND l.deleted_at IS NULL
  `

  const params: any[] = [topicId]

  if (subcategoryId === null) {
    query += ' AND l.subcategory_id IS NULL'
  } else if (subcategoryId !== undefined) {
    query += ' AND l.subcategory_id = ?'
    params.push(subcategoryId)
  }

  query += ' ORDER BY l.created_at DESC'

  const letters = db.prepare(query).all(...params) as (Letter & { is_overdue: number; authority_is_internal: number })[]

  return letters.map(l => ({ ...l, is_overdue: l.is_overdue === 1, authority_is_internal: l.authority_is_internal === 1 }))
}

// Get letters by authority
export function getLettersByAuthority(authorityId: string): Letter[] {
  const db = getDatabase()

  const letters = db.prepare(`
    SELECT l.*,
           a.name as authority_name,
           a.short_name as authority_short_name,
           a.is_internal as authority_is_internal,
           c.name as contact_name,
           c.title as contact_title,
           t.title as topic_title,
           s.title as subcategory_title,
           u.display_name as creator_name,
           (SELECT COUNT(*) FROM letter_attachments WHERE letter_id = l.id AND deleted_at IS NULL) as attachment_count,
           (SELECT COUNT(*) FROM letter_drafts WHERE letter_id = l.id AND deleted_at IS NULL) as draft_count,
           CASE WHEN l.due_date IS NOT NULL AND l.due_date < date('now') AND l.status NOT IN ('replied', 'closed', 'archived') THEN 1 ELSE 0 END as is_overdue
    FROM letters l
    LEFT JOIN authorities a ON l.authority_id = a.id
    LEFT JOIN contacts c ON l.contact_id = c.id
    LEFT JOIN topics t ON l.topic_id = t.id
    LEFT JOIN subcategories s ON l.subcategory_id = s.id
    LEFT JOIN users u ON l.created_by = u.id
    WHERE l.authority_id = ? AND l.deleted_at IS NULL
    ORDER BY l.created_at DESC
  `).all(authorityId) as (Letter & { is_overdue: number; authority_is_internal: number })[]

  return letters.map(l => ({ ...l, is_overdue: l.is_overdue === 1, authority_is_internal: l.authority_is_internal === 1 }))
}

// Search letters
export function searchLetters(params: LetterSearchParams): { letters: Letter[]; total: number } {
  const db = getDatabase()
  const conditions: string[] = ['l.deleted_at IS NULL']
  const values: any[] = []

  // Search across multiple fields using LIKE
  if (params.query?.trim()) {
    const searchTerm = `%${params.query.trim()}%`
    conditions.push(`(
      l.subject LIKE ? OR
      l.summary LIKE ? OR
      l.incoming_number LIKE ? OR
      l.outgoing_number LIKE ? OR
      l.reference_number LIKE ? OR
      l.letter_date LIKE ? OR
      l.received_date LIKE ? OR
      a.name LIKE ? OR
      a.short_name LIKE ? OR
      t.title LIKE ? OR
      c.name LIKE ?
    )`)
    // Add the search term for each LIKE condition
    values.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm)
  }

  // Topic filter
  if (params.topic_id) {
    conditions.push('l.topic_id = ?')
    values.push(params.topic_id)
  }

  // Subcategory filter
  if (params.subcategory_id) {
    conditions.push('l.subcategory_id = ?')
    values.push(params.subcategory_id)
  }

  // Authority filter
  if (params.authority_id) {
    conditions.push('l.authority_id = ?')
    values.push(params.authority_id)
  }

  // Letter type filter
  if (params.letter_type) {
    const types = Array.isArray(params.letter_type) ? params.letter_type : [params.letter_type]
    conditions.push(`l.letter_type IN (${types.map(() => '?').join(', ')})`)
    values.push(...types)
  }

  // Response type filter
  if (params.response_type) {
    const types = Array.isArray(params.response_type) ? params.response_type : [params.response_type]
    conditions.push(`l.response_type IN (${types.map(() => '?').join(', ')})`)
    values.push(...types)
  }

  // Status filter
  if (params.status) {
    const statuses = Array.isArray(params.status) ? params.status : [params.status]
    conditions.push(`l.status IN (${statuses.map(() => '?').join(', ')})`)
    values.push(...statuses)
  }

  // Priority filter
  if (params.priority) {
    const priorities = Array.isArray(params.priority) ? params.priority : [params.priority]
    conditions.push(`l.priority IN (${priorities.map(() => '?').join(', ')})`)
    values.push(...priorities)
  }

  // Date range filters
  if (params.letter_date_from) {
    conditions.push('l.letter_date >= ?')
    values.push(params.letter_date_from)
  }
  if (params.letter_date_to) {
    conditions.push('l.letter_date <= ?')
    values.push(params.letter_date_to)
  }
  if (params.received_date_from) {
    conditions.push('l.received_date >= ?')
    values.push(params.received_date_from)
  }
  if (params.received_date_to) {
    conditions.push('l.received_date <= ?')
    values.push(params.received_date_to)
  }
  if (params.due_date_from) {
    conditions.push('l.due_date >= ?')
    values.push(params.due_date_from)
  }
  if (params.due_date_to) {
    conditions.push('l.due_date <= ?')
    values.push(params.due_date_to)
  }

  // Overdue filter
  if (params.is_overdue) {
    conditions.push(`l.due_date IS NOT NULL AND l.due_date < date('now') AND l.status NOT IN ('replied', 'closed', 'archived')`)
  }

  // Has attachments filter
  if (params.has_attachments !== undefined) {
    if (params.has_attachments) {
      conditions.push('(SELECT COUNT(*) FROM letter_attachments WHERE letter_id = l.id AND deleted_at IS NULL) > 0')
    } else {
      conditions.push('(SELECT COUNT(*) FROM letter_attachments WHERE letter_id = l.id AND deleted_at IS NULL) = 0')
    }
  }

  // Has drafts filter
  if (params.has_drafts !== undefined) {
    if (params.has_drafts) {
      conditions.push('(SELECT COUNT(*) FROM letter_drafts WHERE letter_id = l.id AND deleted_at IS NULL) > 0')
    } else {
      conditions.push('(SELECT COUNT(*) FROM letter_drafts WHERE letter_id = l.id AND deleted_at IS NULL) = 0')
    }
  }

  const whereClause = conditions.join(' AND ')

  // Get total count (with JOINs needed for search conditions)
  const countResult = db.prepare(`
    SELECT COUNT(*) as total
    FROM letters l
    LEFT JOIN authorities a ON l.authority_id = a.id
    LEFT JOIN contacts c ON l.contact_id = c.id
    LEFT JOIN topics t ON l.topic_id = t.id
    WHERE ${whereClause}
  `).get(...values) as { total: number }

  // Sorting
  const sortColumn = params.sort_by || 'created_at'
  const sortOrder = params.sort_order || 'desc'
  const validSortColumns = ['received_date', 'letter_date', 'due_date', 'subject', 'reference_number', 'created_at']
  const actualSortColumn = validSortColumns.includes(sortColumn) ? sortColumn : 'created_at'

  // Build query with sorting and pagination
  let query = `
    SELECT l.*,
           a.name as authority_name,
           a.short_name as authority_short_name,
           a.is_internal as authority_is_internal,
           c.name as contact_name,
           c.title as contact_title,
           t.title as topic_title,
           s.title as subcategory_title,
           u.display_name as creator_name,
           (SELECT COUNT(*) FROM letter_attachments WHERE letter_id = l.id AND deleted_at IS NULL) as attachment_count,
           (SELECT COUNT(*) FROM letter_drafts WHERE letter_id = l.id AND deleted_at IS NULL) as draft_count,
           CASE WHEN l.due_date IS NOT NULL AND l.due_date < date('now') AND l.status NOT IN ('replied', 'closed', 'archived') THEN 1 ELSE 0 END as is_overdue
    FROM letters l
    LEFT JOIN authorities a ON l.authority_id = a.id
    LEFT JOIN contacts c ON l.contact_id = c.id
    LEFT JOIN topics t ON l.topic_id = t.id
    LEFT JOIN subcategories s ON l.subcategory_id = s.id
    LEFT JOIN users u ON l.created_by = u.id
    WHERE ${whereClause}
    ORDER BY l.${actualSortColumn} ${sortOrder.toUpperCase()}
  `

  const queryValues = [...values]

  if (params.limit) {
    query += ' LIMIT ?'
    queryValues.push(params.limit)
  }
  if (params.offset) {
    query += ' OFFSET ?'
    queryValues.push(params.offset)
  }

  const letters = db.prepare(query).all(...queryValues) as (Letter & { is_overdue: number; authority_is_internal: number })[]

  return {
    letters: letters.map(l => ({ ...l, is_overdue: l.is_overdue === 1, authority_is_internal: l.authority_is_internal === 1 })),
    total: countResult.total
  }
}

// Update letter
export function updateLetter(
  id: string,
  data: UpdateLetterData,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  // Check if letter exists
  const existing = getLetterById(id)
  if (!existing) {
    return { success: false, error: 'Letter not found' }
  }

  // Validate topic if being changed
  if (data.topic_id && data.topic_id !== existing.topic_id) {
    const topic = db.prepare('SELECT id FROM topics WHERE id = ? AND deleted_at IS NULL').get(data.topic_id)
    if (!topic) {
      return { success: false, error: 'Invalid topic' }
    }
  }

  // Validate authority if being changed
  if (data.authority_id && data.authority_id !== existing.authority_id) {
    const authority = db.prepare('SELECT id FROM authorities WHERE id = ? AND deleted_at IS NULL').get(data.authority_id)
    if (!authority) {
      return { success: false, error: 'Invalid authority' }
    }
  }

  // Validate contact if being changed
  if (data.contact_id && data.contact_id !== existing.contact_id) {
    const contact = db.prepare('SELECT id FROM contacts WHERE id = ? AND deleted_at IS NULL').get(data.contact_id)
    if (!contact) {
      return { success: false, error: 'Invalid contact' }
    }
  }

  // Validate letter_id uniqueness if being changed
  if (data.letter_id !== undefined && data.letter_id?.trim()) {
    const existingLetterId = db.prepare('SELECT id FROM letters WHERE letter_id = ? AND id != ?').get(data.letter_id.trim(), id)
    if (existingLetterId) {
      return { success: false, error: `Letter ID "${data.letter_id.trim()}" already exists` }
    }
  }

  const updates: string[] = []
  const values: any[] = []

  const fields: (keyof UpdateLetterData)[] = [
    'letter_id', 'letter_type', 'response_type', 'status', 'priority',
    'incoming_number', 'outgoing_number', 'reference_number',
    'subject', 'summary', 'content',
    'authority_id', 'contact_id', 'topic_id', 'subcategory_id', 'parent_letter_id',
    'is_notification', 'letter_date', 'received_date', 'due_date', 'responded_date'
  ]

  for (const field of fields) {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`)
      const value = data[field]
      // Handle boolean to integer conversion for is_notification
      if (field === 'is_notification') {
        values.push(value ? 1 : 0)
      } else {
        values.push(typeof value === 'string' ? value.trim() || null : value)
      }
    }
  }

  if (updates.length === 0) {
    return { success: true }
  }

  updates.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id)

  try {
    db.prepare(`
      UPDATE letters SET ${updates.join(', ')} WHERE id = ?
    `).run(...values)

    // Update topic's updated_at
    const topicId = data.topic_id || existing.topic_id
    db.prepare('UPDATE topics SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), topicId)

    // Log audit
    logAudit('LETTER_UPDATE', userId, getUsername(userId), 'letter', id, {
      updated_fields: Object.keys(data),
      subject: data.subject || existing.subject
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error updating letter:', error)
    return { success: false, error: error.message }
  }
}

// Update letter status
export function updateLetterStatus(
  id: string,
  status: LetterStatus,
  userId: string
): { success: boolean; error?: string } {
  return updateLetter(id, { status }, userId)
}

// Delete letter (soft delete)
export function deleteLetter(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  // Check if letter exists
  const existing = getLetterById(id)
  if (!existing) {
    return { success: false, error: 'Letter not found' }
  }

  // Check for child letters (replies)
  const childCount = db.prepare(
    'SELECT COUNT(*) as count FROM letters WHERE parent_letter_id = ? AND deleted_at IS NULL'
  ).get(id) as { count: number }

  if (childCount.count > 0) {
    return {
      success: false,
      error: `Cannot delete letter with ${childCount.count} reply letter(s). Please delete replies first.`
    }
  }

  const now = new Date().toISOString()

  try {
    // Soft delete letter
    db.prepare(`
      UPDATE letters SET deleted_at = ?, updated_at = ? WHERE id = ?
    `).run(now, now, id)

    // Soft delete attachments
    db.prepare(`
      UPDATE letter_attachments SET deleted_at = ? WHERE letter_id = ?
    `).run(now, id)

    // Soft delete drafts
    db.prepare(`
      UPDATE letter_drafts SET deleted_at = ?, updated_at = ? WHERE letter_id = ?
    `).run(now, now, id)

    // Delete references (hard delete since they're just links)
    db.prepare('DELETE FROM letter_references WHERE source_letter_id = ? OR target_letter_id = ?').run(id, id)

    // Update topic's updated_at
    db.prepare('UPDATE topics SET updated_at = ? WHERE id = ?').run(now, existing.topic_id)

    // Log audit
    logAudit('LETTER_DELETE', userId, getUsername(userId), 'letter', id, {
      subject: existing.subject,
      letter_type: existing.letter_type
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting letter:', error)
    return { success: false, error: error.message }
  }
}

// Get letter statistics
export function getLetterStats(): {
  total: number
  byStatus: Record<string, number>
  byType: Record<string, number>
  overdue: number
  thisWeek: number
} {
  const db = getDatabase()

  const total = db.prepare(
    'SELECT COUNT(*) as count FROM letters WHERE deleted_at IS NULL'
  ).get() as { count: number }

  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM letters
    WHERE deleted_at IS NULL
    GROUP BY status
  `).all() as { status: string; count: number }[]

  const byType = db.prepare(`
    SELECT letter_type, COUNT(*) as count
    FROM letters
    WHERE deleted_at IS NULL
    GROUP BY letter_type
  `).all() as { letter_type: string; count: number }[]

  const overdue = db.prepare(`
    SELECT COUNT(*) as count
    FROM letters
    WHERE deleted_at IS NULL
      AND due_date IS NOT NULL
      AND due_date < date('now')
      AND status NOT IN ('replied', 'closed', 'archived')
  `).get() as { count: number }

  const thisWeek = db.prepare(`
    SELECT COUNT(*) as count
    FROM letters
    WHERE deleted_at IS NULL
      AND received_date >= date('now', '-7 days')
  `).get() as { count: number }

  return {
    total: total.count,
    byStatus: byStatus.reduce((acc, item) => {
      acc[item.status] = item.count
      return acc
    }, {} as Record<string, number>),
    byType: byType.reduce((acc, item) => {
      acc[item.letter_type] = item.count
      return acc
    }, {} as Record<string, number>),
    overdue: overdue.count,
    thisWeek: thisWeek.count
  }
}

// Save letter file
export async function saveLetterFile(
  letterId: string,
  fileBuffer: Buffer,
  filename: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const db = getDatabase()

  const letter = db.prepare('SELECT storage_path FROM letters WHERE id = ?').get(letterId) as { storage_path: string } | undefined
  if (!letter?.storage_path) {
    return { success: false, error: 'Letter not found or has no storage path' }
  }

  const fullPath = path.join(getLettersBasePath(), letter.storage_path, 'original', filename)

  try {
    fs.writeFileSync(fullPath, fileBuffer)

    const checksum = calculateChecksum(fullPath)
    const fileType = path.extname(filename).toLowerCase().replace('.', '')

    db.prepare(`
      UPDATE letters SET
        original_filename = ?,
        file_type = ?,
        file_size = ?,
        checksum = ?,
        updated_at = ?
      WHERE id = ?
    `).run(filename, fileType, fileBuffer.length, checksum, new Date().toISOString(), letterId)

    logAudit('LETTER_FILE_UPLOAD', userId, getUsername(userId), 'letter', letterId, {
      filename,
      file_size: fileBuffer.length
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error saving letter file:', error)
    return { success: false, error: error.message }
  }
}

// Get letter file path
export function getLetterFilePath(letterId: string): string | null {
  const db = getDatabase()

  const letter = db.prepare('SELECT storage_path, original_filename FROM letters WHERE id = ?').get(letterId) as { storage_path: string; original_filename: string } | undefined

  if (!letter?.storage_path || !letter.original_filename) {
    return null
  }

  return path.join(getLettersBasePath(), letter.storage_path, 'original', letter.original_filename)
}

// Get pending letters (status = pending)
export function getPendingLetters(): Letter[] {
  const db = getDatabase()

  const letters = db.prepare(`
    SELECT l.*,
           a.name as authority_name,
           a.short_name as authority_short_name,
           a.is_internal as authority_is_internal,
           c.name as contact_name,
           c.title as contact_title,
           t.title as topic_title,
           s.title as subcategory_title,
           u.display_name as creator_name,
           (SELECT COUNT(*) FROM letter_attachments WHERE letter_id = l.id AND deleted_at IS NULL) as attachment_count,
           (SELECT COUNT(*) FROM letter_drafts WHERE letter_id = l.id AND deleted_at IS NULL) as draft_count,
           0 as is_overdue
    FROM letters l
    LEFT JOIN authorities a ON l.authority_id = a.id
    LEFT JOIN contacts c ON l.contact_id = c.id
    LEFT JOIN topics t ON l.topic_id = t.id
    LEFT JOIN subcategories s ON l.subcategory_id = s.id
    LEFT JOIN users u ON l.created_by = u.id
    WHERE l.deleted_at IS NULL
      AND l.status = 'pending'
    ORDER BY l.created_at DESC
  `).all() as (Letter & { is_overdue: number; authority_is_internal: number })[]

  return letters.map(l => ({ ...l, is_overdue: false, authority_is_internal: l.authority_is_internal === 1 }))
}

// Get overdue letters
export function getOverdueLetters(): Letter[] {
  const db = getDatabase()

  const letters = db.prepare(`
    SELECT l.*,
           a.name as authority_name,
           a.short_name as authority_short_name,
           a.is_internal as authority_is_internal,
           c.name as contact_name,
           c.title as contact_title,
           t.title as topic_title,
           s.title as subcategory_title,
           u.display_name as creator_name,
           (SELECT COUNT(*) FROM letter_attachments WHERE letter_id = l.id AND deleted_at IS NULL) as attachment_count,
           (SELECT COUNT(*) FROM letter_drafts WHERE letter_id = l.id AND deleted_at IS NULL) as draft_count,
           1 as is_overdue
    FROM letters l
    LEFT JOIN authorities a ON l.authority_id = a.id
    LEFT JOIN contacts c ON l.contact_id = c.id
    LEFT JOIN topics t ON l.topic_id = t.id
    LEFT JOIN subcategories s ON l.subcategory_id = s.id
    LEFT JOIN users u ON l.created_by = u.id
    WHERE l.deleted_at IS NULL
      AND l.due_date IS NOT NULL
      AND l.due_date < date('now')
      AND l.status NOT IN ('replied', 'closed', 'archived')
    ORDER BY l.due_date ASC
  `).all() as (Letter & { is_overdue: number; authority_is_internal: number })[]

  return letters.map(l => ({ ...l, is_overdue: true, authority_is_internal: l.authority_is_internal === 1 }))
}

// Get letter by display letter_id
export function getLetterByLetterId(letterId: string): Letter | null {
  const db = getDatabase()

  const letter = db.prepare(`
    SELECT l.*,
           a.name as authority_name,
           a.short_name as authority_short_name,
           a.is_internal as authority_is_internal,
           c.name as contact_name,
           c.title as contact_title,
           t.title as topic_title,
           s.title as subcategory_title,
           pl.subject as parent_letter_subject,
           u.display_name as creator_name,
           (SELECT COUNT(*) FROM letter_attachments WHERE letter_id = l.id AND deleted_at IS NULL) as attachment_count,
           (SELECT COUNT(*) FROM letter_drafts WHERE letter_id = l.id AND deleted_at IS NULL) as draft_count,
           CASE WHEN l.due_date IS NOT NULL AND l.due_date < date('now') AND l.status NOT IN ('replied', 'closed', 'archived') THEN 1 ELSE 0 END as is_overdue
    FROM letters l
    LEFT JOIN authorities a ON l.authority_id = a.id
    LEFT JOIN contacts c ON l.contact_id = c.id
    LEFT JOIN topics t ON l.topic_id = t.id
    LEFT JOIN subcategories s ON l.subcategory_id = s.id
    LEFT JOIN letters pl ON l.parent_letter_id = pl.id
    LEFT JOIN users u ON l.created_by = u.id
    WHERE l.letter_id = ? AND l.deleted_at IS NULL
  `).get(letterId) as (Letter & { is_overdue: number; authority_is_internal: number }) | undefined

  if (!letter) return null

  return {
    ...letter,
    is_overdue: letter.is_overdue === 1,
    authority_is_internal: letter.authority_is_internal === 1
  }
}

// Get MOMs linked to a letter
export function getLinkedMoms(letterInternalId: string): {
  id: string
  letter_id: string
  mom_internal_id: string
  mom_display_id: string | null
  mom_title: string
  mom_status: string
  created_at: string
}[] {
  const db = getDatabase()

  return db.prepare(`
    SELECT mll.id, mll.letter_id, mll.mom_internal_id,
           m.mom_id as mom_display_id, m.title as mom_title, m.status as mom_status,
           mll.created_at
    FROM mom_letter_links mll
    JOIN moms m ON mll.mom_internal_id = m.id
    WHERE mll.letter_id = ? AND m.deleted_at IS NULL
    ORDER BY mll.created_at DESC
  `).all(letterInternalId) as {
    id: string
    letter_id: string
    mom_internal_id: string
    mom_display_id: string | null
    mom_title: string
    mom_status: string
    created_at: string
  }[]
}
