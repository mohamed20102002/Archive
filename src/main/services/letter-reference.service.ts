import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'
import type { Letter } from './letter.service'

// Types
export type ReferenceType = 'reply_to' | 'related' | 'supersedes' | 'amends' | 'attachment_to'

export interface LetterReference {
  id: string
  source_letter_id: string
  target_letter_id: string
  reference_type: ReferenceType
  notes: string | null
  created_by: string
  created_at: string
  // Joined fields
  source_letter?: Letter
  target_letter?: Letter
  creator_name?: string
}

export interface CreateReferenceData {
  source_letter_id: string
  target_letter_id: string
  reference_type?: ReferenceType
  notes?: string
}

export interface LetterWithReferences extends Letter {
  references_to: LetterReference[]
  referenced_by: LetterReference[]
}

export interface LetterGraphNode {
  letter: Letter
  children: LetterGraphNode[]
  parents: LetterGraphNode[]
  depth: number
}

// Helper functions
function generateId(): string {
  return `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function getUsername(userId: string): string {
  const db = getDatabase()
  const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as { username: string } | undefined
  return user?.username || 'unknown'
}

// Check for circular reference
function hasCircularPath(
  currentId: string,
  targetId: string,
  visited: Set<string> = new Set()
): boolean {
  if (visited.has(currentId)) {
    return false
  }
  if (currentId === targetId) {
    return true
  }

  visited.add(currentId)

  const db = getDatabase()
  const references = db.prepare(`
    SELECT target_letter_id
    FROM letter_references
    WHERE source_letter_id = ?
  `).all(currentId) as { target_letter_id: string }[]

  for (const ref of references) {
    if (hasCircularPath(ref.target_letter_id, targetId, visited)) {
      return true
    }
  }

  return false
}

// Create reference
export function createReference(
  data: CreateReferenceData,
  userId: string
): { success: boolean; reference?: LetterReference; error?: string } {
  const db = getDatabase()

  // Validate required fields
  if (!data.source_letter_id || !data.target_letter_id) {
    return { success: false, error: 'Source and target letters are required' }
  }

  // Prevent self-reference
  if (data.source_letter_id === data.target_letter_id) {
    return { success: false, error: 'A letter cannot reference itself' }
  }

  // Validate source letter exists
  const sourceLetter = db.prepare(
    'SELECT id FROM letters WHERE id = ? AND deleted_at IS NULL'
  ).get(data.source_letter_id)
  if (!sourceLetter) {
    return { success: false, error: 'Source letter not found' }
  }

  // Validate target letter exists
  const targetLetter = db.prepare(
    'SELECT id FROM letters WHERE id = ? AND deleted_at IS NULL'
  ).get(data.target_letter_id)
  if (!targetLetter) {
    return { success: false, error: 'Target letter not found' }
  }

  // Check for duplicate reference
  const existing = db.prepare(`
    SELECT id FROM letter_references
    WHERE source_letter_id = ? AND target_letter_id = ?
  `).get(data.source_letter_id, data.target_letter_id)
  if (existing) {
    return { success: false, error: 'This reference already exists' }
  }

  // Check for circular reference (only for reply_to and supersedes)
  if (data.reference_type === 'reply_to' || data.reference_type === 'supersedes') {
    if (hasCircularPath(data.target_letter_id, data.source_letter_id)) {
      return { success: false, error: 'This reference would create a circular relationship' }
    }
  }

  const id = generateId()
  const now = new Date().toISOString()

  try {
    db.prepare(`
      INSERT INTO letter_references (
        id, source_letter_id, target_letter_id, reference_type, notes, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.source_letter_id,
      data.target_letter_id,
      data.reference_type || 'related',
      data.notes?.trim() || null,
      userId,
      now
    )

    // Update both letters' updated_at
    db.prepare('UPDATE letters SET updated_at = ? WHERE id IN (?, ?)').run(
      now,
      data.source_letter_id,
      data.target_letter_id
    )

    // Log audit
    logAudit('REFERENCE_CREATE', userId, getUsername(userId), 'letter_reference', id, {
      source_letter_id: data.source_letter_id,
      target_letter_id: data.target_letter_id,
      reference_type: data.reference_type || 'related'
    })

    const reference = getReferenceById(id)
    return { success: true, reference: reference || undefined }
  } catch (error: any) {
    console.error('Error creating reference:', error)
    return { success: false, error: error.message }
  }
}

// Get reference by ID
export function getReferenceById(id: string): LetterReference | null {
  const db = getDatabase()

  const reference = db.prepare(`
    SELECT r.*,
           u.display_name as creator_name
    FROM letter_references r
    LEFT JOIN users u ON r.created_by = u.id
    WHERE r.id = ?
  `).get(id) as LetterReference | undefined

  return reference || null
}

// Get references from a letter (letters this one references)
export function getReferencesFrom(letterId: string): LetterReference[] {
  const db = getDatabase()

  return db.prepare(`
    SELECT r.*,
           u.display_name as creator_name,
           tl.subject as target_subject,
           tl.reference_number as target_reference_number,
           tl.letter_type as target_letter_type,
           tl.status as target_status
    FROM letter_references r
    LEFT JOIN users u ON r.created_by = u.id
    LEFT JOIN letters tl ON r.target_letter_id = tl.id
    WHERE r.source_letter_id = ? AND tl.deleted_at IS NULL
    ORDER BY r.created_at DESC
  `).all(letterId) as LetterReference[]
}

// Get references to a letter (letters that reference this one)
export function getReferencesTo(letterId: string): LetterReference[] {
  const db = getDatabase()

  return db.prepare(`
    SELECT r.*,
           u.display_name as creator_name,
           sl.subject as source_subject,
           sl.reference_number as source_reference_number,
           sl.letter_type as source_letter_type,
           sl.status as source_status
    FROM letter_references r
    LEFT JOIN users u ON r.created_by = u.id
    LEFT JOIN letters sl ON r.source_letter_id = sl.id
    WHERE r.target_letter_id = ? AND sl.deleted_at IS NULL
    ORDER BY r.created_at DESC
  `).all(letterId) as LetterReference[]
}

// Get letter with all references
export function getLetterWithReferences(letterId: string): LetterWithReferences | null {
  const db = getDatabase()

  const letter = db.prepare(`
    SELECT l.*,
           a.name as authority_name,
           a.short_name as authority_short_name,
           t.title as topic_title,
           s.title as subcategory_title,
           u.display_name as creator_name,
           (SELECT COUNT(*) FROM letter_attachments WHERE letter_id = l.id AND deleted_at IS NULL) as attachment_count,
           (SELECT COUNT(*) FROM letter_drafts WHERE letter_id = l.id AND deleted_at IS NULL) as draft_count
    FROM letters l
    LEFT JOIN authorities a ON l.authority_id = a.id
    LEFT JOIN topics t ON l.topic_id = t.id
    LEFT JOIN subcategories s ON l.subcategory_id = s.id
    LEFT JOIN users u ON l.created_by = u.id
    WHERE l.id = ? AND l.deleted_at IS NULL
  `).get(letterId) as Letter | undefined

  if (!letter) return null

  return {
    ...letter,
    references_to: getReferencesFrom(letterId),
    referenced_by: getReferencesTo(letterId)
  }
}

// Get all references for a letter (both directions)
export function getAllReferences(letterId: string): {
  from: LetterReference[]
  to: LetterReference[]
} {
  return {
    from: getReferencesFrom(letterId),
    to: getReferencesTo(letterId)
  }
}

// Get references by type
export function getReferencesByType(
  letterId: string,
  type: ReferenceType,
  direction: 'from' | 'to' | 'both' = 'both'
): LetterReference[] {
  const db = getDatabase()
  const references: LetterReference[] = []

  if (direction === 'from' || direction === 'both') {
    const from = db.prepare(`
      SELECT r.*,
             u.display_name as creator_name
      FROM letter_references r
      LEFT JOIN users u ON r.created_by = u.id
      LEFT JOIN letters tl ON r.target_letter_id = tl.id
      WHERE r.source_letter_id = ? AND r.reference_type = ? AND tl.deleted_at IS NULL
      ORDER BY r.created_at DESC
    `).all(letterId, type) as LetterReference[]
    references.push(...from)
  }

  if (direction === 'to' || direction === 'both') {
    const to = db.prepare(`
      SELECT r.*,
             u.display_name as creator_name
      FROM letter_references r
      LEFT JOIN users u ON r.created_by = u.id
      LEFT JOIN letters sl ON r.source_letter_id = sl.id
      WHERE r.target_letter_id = ? AND r.reference_type = ? AND sl.deleted_at IS NULL
      ORDER BY r.created_at DESC
    `).all(letterId, type) as LetterReference[]
    references.push(...to)
  }

  return references
}

// Update reference
export function updateReference(
  id: string,
  data: { reference_type?: ReferenceType; notes?: string },
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = getReferenceById(id)
  if (!existing) {
    return { success: false, error: 'Reference not found' }
  }

  const updates: string[] = []
  const values: any[] = []

  if (data.reference_type !== undefined) {
    updates.push('reference_type = ?')
    values.push(data.reference_type)
  }
  if (data.notes !== undefined) {
    updates.push('notes = ?')
    values.push(data.notes?.trim() || null)
  }

  if (updates.length === 0) {
    return { success: true }
  }

  values.push(id)

  try {
    db.prepare(`
      UPDATE letter_references SET ${updates.join(', ')} WHERE id = ?
    `).run(...values)

    // Update both letters' updated_at
    const now = new Date().toISOString()
    db.prepare('UPDATE letters SET updated_at = ? WHERE id IN (?, ?)').run(
      now,
      existing.source_letter_id,
      existing.target_letter_id
    )

    // Log audit
    logAudit('REFERENCE_UPDATE', userId, getUsername(userId), 'letter_reference', id, {
      updated_fields: Object.keys(data)
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error updating reference:', error)
    return { success: false, error: error.message }
  }
}

// Delete reference
export function deleteReference(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = getReferenceById(id)
  if (!existing) {
    return { success: false, error: 'Reference not found' }
  }

  try {
    db.prepare('DELETE FROM letter_references WHERE id = ?').run(id)

    // Update both letters' updated_at
    const now = new Date().toISOString()
    db.prepare('UPDATE letters SET updated_at = ? WHERE id IN (?, ?)').run(
      now,
      existing.source_letter_id,
      existing.target_letter_id
    )

    // Log audit
    logAudit('REFERENCE_DELETE', userId, getUsername(userId), 'letter_reference', id, {
      source_letter_id: existing.source_letter_id,
      target_letter_id: existing.target_letter_id,
      reference_type: existing.reference_type
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting reference:', error)
    return { success: false, error: error.message }
  }
}

// Build reference graph for visualization
export function buildReferenceGraph(
  letterId: string,
  maxDepth: number = 3
): LetterGraphNode | null {
  const db = getDatabase()
  const visited = new Set<string>()

  function buildNode(id: string, depth: number): LetterGraphNode | null {
    if (depth > maxDepth || visited.has(id)) {
      return null
    }
    visited.add(id)

    const letter = db.prepare(`
      SELECT l.*,
             a.name as authority_name,
             a.short_name as authority_short_name,
             t.title as topic_title
      FROM letters l
      LEFT JOIN authorities a ON l.authority_id = a.id
      LEFT JOIN topics t ON l.topic_id = t.id
      WHERE l.id = ? AND l.deleted_at IS NULL
    `).get(id) as Letter | undefined

    if (!letter) return null

    // Get children (letters this one references)
    const childRefs = db.prepare(`
      SELECT target_letter_id FROM letter_references WHERE source_letter_id = ?
    `).all(id) as { target_letter_id: string }[]

    // Get parents (letters that reference this one)
    const parentRefs = db.prepare(`
      SELECT source_letter_id FROM letter_references WHERE target_letter_id = ?
    `).all(id) as { source_letter_id: string }[]

    const children = childRefs
      .map(ref => buildNode(ref.target_letter_id, depth + 1))
      .filter((n): n is LetterGraphNode => n !== null)

    const parents = parentRefs
      .map(ref => buildNode(ref.source_letter_id, depth + 1))
      .filter((n): n is LetterGraphNode => n !== null)

    return {
      letter,
      children,
      parents,
      depth
    }
  }

  return buildNode(letterId, 0)
}

// Get letter chain (for reply_to relationships)
export function getLetterChain(letterId: string): Letter[] {
  const db = getDatabase()
  const chain: Letter[] = []
  const visited = new Set<string>()

  // Go up the chain (find original letter)
  let currentId: string | null = letterId
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)

    const letter = db.prepare(`
      SELECT l.*,
             a.name as authority_name,
             t.title as topic_title
      FROM letters l
      LEFT JOIN authorities a ON l.authority_id = a.id
      LEFT JOIN topics t ON l.topic_id = t.id
      WHERE l.id = ? AND l.deleted_at IS NULL
    `).get(currentId) as Letter | undefined

    if (letter) {
      chain.unshift(letter)

      // Find parent via reply_to reference
      const parentRef = db.prepare(`
        SELECT target_letter_id FROM letter_references
        WHERE source_letter_id = ? AND reference_type = 'reply_to'
        LIMIT 1
      `).get(currentId) as { target_letter_id: string } | undefined

      currentId = parentRef?.target_letter_id || null
    } else {
      break
    }
  }

  // Go down the chain (find replies)
  visited.clear()
  visited.add(letterId)

  const queue: string[] = [letterId]
  while (queue.length > 0) {
    const id = queue.shift()!

    const childRefs = db.prepare(`
      SELECT source_letter_id FROM letter_references
      WHERE target_letter_id = ? AND reference_type = 'reply_to'
    `).all(id) as { source_letter_id: string }[]

    for (const ref of childRefs) {
      if (!visited.has(ref.source_letter_id)) {
        visited.add(ref.source_letter_id)

        const letter = db.prepare(`
          SELECT l.*,
                 a.name as authority_name,
                 t.title as topic_title
          FROM letters l
          LEFT JOIN authorities a ON l.authority_id = a.id
          LEFT JOIN topics t ON l.topic_id = t.id
          WHERE l.id = ? AND l.deleted_at IS NULL
        `).get(ref.source_letter_id) as Letter | undefined

        if (letter) {
          chain.push(letter)
          queue.push(ref.source_letter_id)
        }
      }
    }
  }

  return chain
}

// Find letters by reference number pattern
export function findLettersByReferencePattern(pattern: string): Letter[] {
  const db = getDatabase()

  // Convert wildcard pattern to SQL LIKE pattern
  const sqlPattern = pattern.replace(/\*/g, '%')

  return db.prepare(`
    SELECT l.*,
           a.name as authority_name,
           t.title as topic_title
    FROM letters l
    LEFT JOIN authorities a ON l.authority_id = a.id
    LEFT JOIN topics t ON l.topic_id = t.id
    WHERE l.deleted_at IS NULL
      AND (l.reference_number LIKE ? OR l.incoming_number LIKE ? OR l.outgoing_number LIKE ?)
    ORDER BY l.received_date DESC
  `).all(sqlPattern, sqlPattern, sqlPattern) as Letter[]
}

// Find letter by exact reference number (any type of reference number) or letter_id
export function findLetterByReferenceNumber(refNumber: string): Letter | null {
  const db = getDatabase()

  // Search by letter_id, reference_number, incoming_number, or outgoing_number
  const letter = db.prepare(`
    SELECT l.*,
           a.name as authority_name,
           a.short_name as authority_short_name,
           t.title as topic_title,
           s.title as subcategory_title
    FROM letters l
    LEFT JOIN authorities a ON l.authority_id = a.id
    LEFT JOIN topics t ON l.topic_id = t.id
    LEFT JOIN subcategories s ON l.subcategory_id = s.id
    WHERE l.deleted_at IS NULL
      AND (l.letter_id = ? OR l.reference_number = ? OR l.incoming_number = ? OR l.outgoing_number = ?)
    LIMIT 1
  `).get(refNumber, refNumber, refNumber, refNumber) as Letter | undefined

  return letter || null
}

// Create reference by reference number
export function createReferenceByRefNumber(
  sourceId: string,
  targetRefNumber: string,
  referenceType: ReferenceType = 'related',
  notes: string | null,
  userId: string
): { success: boolean; reference?: LetterReference; error?: string } {
  // Find target letter by reference number
  const targetLetter = findLetterByReferenceNumber(targetRefNumber)
  if (!targetLetter) {
    return { success: false, error: `No letter found with reference number: ${targetRefNumber}` }
  }

  // Create the reference using the found letter ID
  return createReference({
    source_letter_id: sourceId,
    target_letter_id: targetLetter.id,
    reference_type: referenceType,
    notes: notes || undefined
  }, userId)
}

// Get process flow data for visualization
export interface ProcessFlowNode {
  id: string
  type: 'letter' | 'draft'
  letter_type?: string
  status: string
  subject: string
  reference_number: string | null
  date: string | null
  is_final?: boolean
  version?: number
}

export interface ProcessFlowEdge {
  source: string
  target: string
  type: ReferenceType | 'has_draft'
}

export interface ProcessFlowData {
  nodes: ProcessFlowNode[]
  edges: ProcessFlowEdge[]
  rootId: string
}

export function getProcessFlowData(letterId: string): ProcessFlowData | null {
  const db = getDatabase()

  // Get the main letter
  const mainLetter = db.prepare(`
    SELECT l.*,
           a.name as authority_name
    FROM letters l
    LEFT JOIN authorities a ON l.authority_id = a.id
    WHERE l.id = ? AND l.deleted_at IS NULL
  `).get(letterId) as Letter | undefined

  if (!mainLetter) return null

  const nodes: ProcessFlowNode[] = []
  const edges: ProcessFlowEdge[] = []
  const visited = new Set<string>()

  // Add main letter node
  nodes.push({
    id: mainLetter.id,
    type: 'letter',
    letter_type: mainLetter.letter_type,
    status: mainLetter.status,
    subject: mainLetter.subject,
    reference_number: mainLetter.reference_number || mainLetter.incoming_number || mainLetter.outgoing_number,
    date: mainLetter.letter_date || mainLetter.received_date
  })
  visited.add(mainLetter.id)

  // Get drafts for this letter
  const drafts = db.prepare(`
    SELECT id, version, title, status, is_final, created_at
    FROM letter_drafts
    WHERE letter_id = ? AND deleted_at IS NULL
    ORDER BY version ASC
  `).all(letterId) as { id: string; version: number; title: string; status: string; is_final: boolean; created_at: string }[]

  for (const draft of drafts) {
    nodes.push({
      id: draft.id,
      type: 'draft',
      status: draft.status,
      subject: draft.title,
      reference_number: null,
      date: draft.created_at,
      is_final: draft.is_final,
      version: draft.version
    })
    edges.push({
      source: letterId,
      target: draft.id,
      type: 'has_draft'
    })
  }

  // Get related letters (references from and to)
  const refsFrom = db.prepare(`
    SELECT r.*, tl.subject, tl.letter_type, tl.status,
           COALESCE(tl.reference_number, tl.incoming_number, tl.outgoing_number) as ref_num,
           COALESCE(tl.letter_date, tl.received_date) as letter_date
    FROM letter_references r
    JOIN letters tl ON r.target_letter_id = tl.id AND tl.deleted_at IS NULL
    WHERE r.source_letter_id = ?
  `).all(letterId) as any[]

  for (const ref of refsFrom) {
    if (!visited.has(ref.target_letter_id)) {
      visited.add(ref.target_letter_id)
      nodes.push({
        id: ref.target_letter_id,
        type: 'letter',
        letter_type: ref.letter_type,
        status: ref.status,
        subject: ref.subject,
        reference_number: ref.ref_num,
        date: ref.letter_date
      })
    }
    edges.push({
      source: letterId,
      target: ref.target_letter_id,
      type: ref.reference_type
    })
  }

  const refsTo = db.prepare(`
    SELECT r.*, sl.subject, sl.letter_type, sl.status,
           COALESCE(sl.reference_number, sl.incoming_number, sl.outgoing_number) as ref_num,
           COALESCE(sl.letter_date, sl.received_date) as letter_date
    FROM letter_references r
    JOIN letters sl ON r.source_letter_id = sl.id AND sl.deleted_at IS NULL
    WHERE r.target_letter_id = ?
  `).all(letterId) as any[]

  for (const ref of refsTo) {
    if (!visited.has(ref.source_letter_id)) {
      visited.add(ref.source_letter_id)
      nodes.push({
        id: ref.source_letter_id,
        type: 'letter',
        letter_type: ref.letter_type,
        status: ref.status,
        subject: ref.subject,
        reference_number: ref.ref_num,
        date: ref.letter_date
      })
    }
    edges.push({
      source: ref.source_letter_id,
      target: letterId,
      type: ref.reference_type
    })
  }

  return {
    nodes,
    edges,
    rootId: letterId
  }
}
