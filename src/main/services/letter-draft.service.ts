import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'
import { getLettersBasePath } from './letter.service'

// Types
export type DraftStatus = 'draft' | 'review' | 'approved' | 'sent' | 'superseded'

export interface LetterDraft {
  id: string
  letter_id: string
  version: number
  title: string
  content: string | null
  notes: string | null
  storage_path: string | null
  original_filename: string | null
  file_type: string | null
  file_size: number | null
  checksum: string | null
  status: DraftStatus
  is_final: boolean
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  creator_name?: string
}

export interface CreateDraftData {
  letter_id: string
  title: string
  content?: string
  notes?: string
}

export interface UpdateDraftData {
  title?: string
  content?: string
  notes?: string
  status?: DraftStatus
}

// Helper functions
function generateId(): string {
  return `drf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function getUsername(userId: string): string {
  const db = getDatabase()
  const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as { username: string } | undefined
  return user?.username || 'unknown'
}

function calculateChecksum(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(fileBuffer).digest('hex')
}

// Get next version number for a letter
function getNextDraftVersion(letterId: string): number {
  const db = getDatabase()
  const result = db.prepare(`
    SELECT COALESCE(MAX(version), 0) + 1 as next_version
    FROM letter_drafts
    WHERE letter_id = ?
  `).get(letterId) as { next_version: number }
  return result.next_version
}

// Create draft
export function createDraft(
  data: CreateDraftData,
  userId: string
): { success: boolean; draft?: LetterDraft; error?: string } {
  const db = getDatabase()

  // Validate required fields
  if (!data.letter_id) {
    return { success: false, error: 'Letter ID is required' }
  }
  if (!data.title?.trim()) {
    return { success: false, error: 'Draft title is required' }
  }

  // Validate letter exists
  const letter = db.prepare(`
    SELECT id, storage_path FROM letters WHERE id = ? AND deleted_at IS NULL
  `).get(data.letter_id) as { id: string; storage_path: string } | undefined

  if (!letter) {
    return { success: false, error: 'Letter not found' }
  }

  const id = generateId()
  const version = getNextDraftVersion(data.letter_id)
  const now = new Date().toISOString()
  const storagePath = `${letter.storage_path}/drafts/v${version}`

  try {
    // Create draft folder
    const fullPath = path.join(getLettersBasePath(), storagePath)
    fs.mkdirSync(fullPath, { recursive: true })

    db.prepare(`
      INSERT INTO letter_drafts (
        id, letter_id, version, title, content, notes,
        storage_path, status, is_final,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.letter_id,
      version,
      data.title.trim(),
      data.content?.trim() || null,
      data.notes?.trim() || null,
      storagePath,
      'draft',
      0,
      userId,
      now,
      now
    )

    // Update letter's updated_at
    db.prepare('UPDATE letters SET updated_at = ? WHERE id = ?').run(now, data.letter_id)

    // Log audit
    logAudit('DRAFT_CREATE', userId, getUsername(userId), 'letter_draft', id, {
      letter_id: data.letter_id,
      version,
      title: data.title
    })

    const draft = getDraftById(id)
    return { success: true, draft: draft || undefined }
  } catch (error: any) {
    console.error('Error creating draft:', error)
    return { success: false, error: error.message }
  }
}

// Get draft by ID
export function getDraftById(id: string): LetterDraft | null {
  const db = getDatabase()

  const draft = db.prepare(`
    SELECT d.*,
           u.display_name as creator_name
    FROM letter_drafts d
    LEFT JOIN users u ON d.created_by = u.id
    WHERE d.id = ? AND d.deleted_at IS NULL
  `).get(id) as (LetterDraft & { is_final: number }) | undefined

  if (!draft) return null

  return {
    ...draft,
    is_final: draft.is_final === 1
  }
}

// Get all drafts for a letter
export function getDraftsByLetter(letterId: string): LetterDraft[] {
  const db = getDatabase()

  const drafts = db.prepare(`
    SELECT d.*,
           u.display_name as creator_name
    FROM letter_drafts d
    LEFT JOIN users u ON d.created_by = u.id
    WHERE d.letter_id = ? AND d.deleted_at IS NULL
    ORDER BY d.version DESC
  `).all(letterId) as (LetterDraft & { is_final: number })[]

  return drafts.map(d => ({ ...d, is_final: d.is_final === 1 }))
}

// Get latest draft for a letter
export function getLatestDraft(letterId: string): LetterDraft | null {
  const db = getDatabase()

  const draft = db.prepare(`
    SELECT d.*,
           u.display_name as creator_name
    FROM letter_drafts d
    LEFT JOIN users u ON d.created_by = u.id
    WHERE d.letter_id = ? AND d.deleted_at IS NULL
    ORDER BY d.version DESC
    LIMIT 1
  `).get(letterId) as (LetterDraft & { is_final: number }) | undefined

  if (!draft) return null

  return {
    ...draft,
    is_final: draft.is_final === 1
  }
}

// Get final draft for a letter
export function getFinalDraft(letterId: string): LetterDraft | null {
  const db = getDatabase()

  const draft = db.prepare(`
    SELECT d.*,
           u.display_name as creator_name
    FROM letter_drafts d
    LEFT JOIN users u ON d.created_by = u.id
    WHERE d.letter_id = ? AND d.is_final = 1 AND d.deleted_at IS NULL
    LIMIT 1
  `).get(letterId) as (LetterDraft & { is_final: number }) | undefined

  if (!draft) return null

  return {
    ...draft,
    is_final: true
  }
}

// Update draft
export function updateDraft(
  id: string,
  data: UpdateDraftData,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  // Check if draft exists
  const existing = getDraftById(id)
  if (!existing) {
    return { success: false, error: 'Draft not found' }
  }

  // Cannot update sent or superseded drafts
  if (existing.status === 'sent' || existing.status === 'superseded') {
    return { success: false, error: `Cannot update a draft with status: ${existing.status}` }
  }

  const updates: string[] = []
  const values: any[] = []

  if (data.title !== undefined) {
    updates.push('title = ?')
    values.push(data.title.trim())
  }
  if (data.content !== undefined) {
    updates.push('content = ?')
    values.push(data.content?.trim() || null)
  }
  if (data.notes !== undefined) {
    updates.push('notes = ?')
    values.push(data.notes?.trim() || null)
  }
  if (data.status !== undefined) {
    updates.push('status = ?')
    values.push(data.status)
  }

  if (updates.length === 0) {
    return { success: true }
  }

  updates.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id)

  try {
    db.prepare(`
      UPDATE letter_drafts SET ${updates.join(', ')} WHERE id = ?
    `).run(...values)

    // Update letter's updated_at
    db.prepare('UPDATE letters SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), existing.letter_id)

    // Log audit
    logAudit('DRAFT_UPDATE', userId, getUsername(userId), 'letter_draft', id, {
      letter_id: existing.letter_id,
      version: existing.version,
      updated_fields: Object.keys(data)
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error updating draft:', error)
    return { success: false, error: error.message }
  }
}

// Update draft status
export function updateDraftStatus(
  id: string,
  status: DraftStatus,
  userId: string
): { success: boolean; error?: string } {
  return updateDraft(id, { status }, userId)
}

// Approve draft
export function approveDraft(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const draft = getDraftById(id)
  if (!draft) {
    return { success: false, error: 'Draft not found' }
  }

  if (draft.status !== 'review' && draft.status !== 'draft') {
    return { success: false, error: `Cannot approve a draft with status: ${draft.status}` }
  }

  const now = new Date().toISOString()

  try {
    // Mark current draft as approved
    db.prepare(`
      UPDATE letter_drafts SET status = 'approved', updated_at = ? WHERE id = ?
    `).run(now, id)

    // Mark all other drafts as superseded
    db.prepare(`
      UPDATE letter_drafts SET status = 'superseded', updated_at = ?
      WHERE letter_id = ? AND id != ? AND status NOT IN ('sent', 'superseded') AND deleted_at IS NULL
    `).run(now, draft.letter_id, id)

    // Update letter's updated_at
    db.prepare('UPDATE letters SET updated_at = ? WHERE id = ?').run(now, draft.letter_id)

    // Log audit
    logAudit('DRAFT_APPROVE', userId, getUsername(userId), 'letter_draft', id, {
      letter_id: draft.letter_id,
      version: draft.version
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error approving draft:', error)
    return { success: false, error: error.message }
  }
}

// Mark draft as sent (final)
export function markDraftAsSent(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const draft = getDraftById(id)
  if (!draft) {
    return { success: false, error: 'Draft not found' }
  }

  if (draft.status !== 'approved') {
    return { success: false, error: 'Only approved drafts can be marked as sent' }
  }

  const now = new Date().toISOString()

  try {
    // Mark draft as sent and final
    db.prepare(`
      UPDATE letter_drafts SET status = 'sent', is_final = 1, updated_at = ? WHERE id = ?
    `).run(now, id)

    // Update letter status to replied
    db.prepare(`
      UPDATE letters SET status = 'replied', responded_date = ?, updated_at = ? WHERE id = ?
    `).run(now, now, draft.letter_id)

    // Log audit
    logAudit('DRAFT_SENT', userId, getUsername(userId), 'letter_draft', id, {
      letter_id: draft.letter_id,
      version: draft.version
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error marking draft as sent:', error)
    return { success: false, error: error.message }
  }
}

// Delete draft (soft delete)
export function deleteDraft(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const draft = getDraftById(id)
  if (!draft) {
    return { success: false, error: 'Draft not found' }
  }

  // Cannot delete sent or final drafts
  if (draft.status === 'sent' || draft.is_final) {
    return { success: false, error: 'Cannot delete a sent or final draft' }
  }

  const now = new Date().toISOString()

  try {
    db.prepare(`
      UPDATE letter_drafts SET deleted_at = ?, updated_at = ? WHERE id = ?
    `).run(now, now, id)

    // Update letter's updated_at
    db.prepare('UPDATE letters SET updated_at = ? WHERE id = ?').run(now, draft.letter_id)

    // Log audit
    logAudit('DRAFT_DELETE', userId, getUsername(userId), 'letter_draft', id, {
      letter_id: draft.letter_id,
      version: draft.version,
      title: draft.title
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting draft:', error)
    return { success: false, error: error.message }
  }
}

// Save draft file
export async function saveDraftFile(
  draftId: string,
  fileBuffer: Buffer,
  filename: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const db = getDatabase()

  const draft = db.prepare('SELECT storage_path, letter_id FROM letter_drafts WHERE id = ?').get(draftId) as { storage_path: string; letter_id: string } | undefined
  if (!draft?.storage_path) {
    return { success: false, error: 'Draft not found or has no storage path' }
  }

  const fullPath = path.join(getLettersBasePath(), draft.storage_path, filename)

  try {
    fs.writeFileSync(fullPath, fileBuffer)

    const checksum = calculateChecksum(fullPath)
    const fileType = path.extname(filename).toLowerCase().replace('.', '')

    db.prepare(`
      UPDATE letter_drafts SET
        original_filename = ?,
        file_type = ?,
        file_size = ?,
        checksum = ?,
        updated_at = ?
      WHERE id = ?
    `).run(filename, fileType, fileBuffer.length, checksum, new Date().toISOString(), draftId)

    // Update letter's updated_at
    db.prepare('UPDATE letters SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), draft.letter_id)

    logAudit('DRAFT_FILE_UPLOAD', userId, getUsername(userId), 'letter_draft', draftId, {
      filename,
      file_size: fileBuffer.length
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error saving draft file:', error)
    return { success: false, error: error.message }
  }
}

// Get draft file path
export function getDraftFilePath(draftId: string): string | null {
  const db = getDatabase()

  const draft = db.prepare('SELECT storage_path, original_filename FROM letter_drafts WHERE id = ?').get(draftId) as { storage_path: string; original_filename: string } | undefined

  if (!draft?.storage_path || !draft.original_filename) {
    return null
  }

  return path.join(getLettersBasePath(), draft.storage_path, draft.original_filename)
}
