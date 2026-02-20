/**
 * Signature Service
 *
 * Manages digital signatures and stamps for documents.
 * Supports multiple signature types and placement options.
 */

import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

export interface Signature {
  id: string
  user_id: string
  name: string
  type: 'signature' | 'stamp' | 'initials'
  image_data: string // Base64 encoded image
  width: number
  height: number
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface CreateSignatureInput {
  user_id: string
  name: string
  type: Signature['type']
  image_data: string
  width: number
  height: number
  is_default?: boolean
}

export interface SignaturePlacement {
  id: string
  document_type: string
  document_id: string
  signature_id: string
  page_number: number
  x_position: number
  y_position: number
  scale: number
  rotation: number
  placed_by: string
  placed_at: string
}

export interface PlaceSignatureInput {
  document_type: string
  document_id: string
  signature_id: string
  page_number: number
  x_position: number
  y_position: number
  scale?: number
  rotation?: number
  placed_by: string
}

/**
 * Generate unique signature ID
 */
function generateSignatureId(): string {
  return `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Generate unique placement ID
 */
function generatePlacementId(): string {
  return `plc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Get signatures directory
 */
function getSignaturesDir(): string {
  const userDataPath = app.getPath('userData')
  const sigDir = path.join(userDataPath, 'signatures')
  if (!fs.existsSync(sigDir)) {
    fs.mkdirSync(sigDir, { recursive: true })
  }
  return sigDir
}

/**
 * Create a new signature
 */
export function createSignature(input: CreateSignatureInput): Signature {
  const db = getDatabase()
  const id = generateSignatureId()
  const now = new Date().toISOString()

  // If this is set as default, unset other defaults for this user and type
  if (input.is_default) {
    db.prepare(`
      UPDATE signatures
      SET is_default = 0
      WHERE user_id = ? AND type = ?
    `).run(input.user_id, input.type)
  }

  // Save image to file system for better storage
  const sigDir = getSignaturesDir()
  const imagePath = path.join(sigDir, `${id}.png`)

  // Convert base64 to buffer and save
  const imageBuffer = Buffer.from(input.image_data.replace(/^data:image\/\w+;base64,/, ''), 'base64')
  fs.writeFileSync(imagePath, imageBuffer)

  db.prepare(`
    INSERT INTO signatures (
      id, user_id, name, type, image_path, width, height,
      is_default, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.user_id,
    input.name,
    input.type,
    imagePath,
    input.width,
    input.height,
    input.is_default ? 1 : 0,
    now,
    now
  )

  logAudit({
    action: 'SIGNATURE_CREATE',
    entityType: 'signature',
    entityId: id,
    userId: input.user_id,
    details: { name: input.name, type: input.type }
  })

  return {
    id,
    user_id: input.user_id,
    name: input.name,
    type: input.type,
    image_data: input.image_data,
    width: input.width,
    height: input.height,
    is_default: input.is_default || false,
    created_at: now,
    updated_at: now
  }
}

/**
 * Get signatures for a user
 */
export function getSignatures(userId: string, type?: Signature['type']): Signature[] {
  const db = getDatabase()

  let sql = 'SELECT * FROM signatures WHERE user_id = ?'
  const params: unknown[] = [userId]

  if (type) {
    sql += ' AND type = ?'
    params.push(type)
  }

  sql += ' ORDER BY is_default DESC, created_at DESC'

  const rows = db.prepare(sql).all(...params) as Array<{
    id: string
    user_id: string
    name: string
    type: Signature['type']
    image_path: string
    width: number
    height: number
    is_default: number
    created_at: string
    updated_at: string
  }>

  return rows.map(row => {
    // Load image data from file
    let imageData = ''
    try {
      if (fs.existsSync(row.image_path)) {
        const buffer = fs.readFileSync(row.image_path)
        imageData = `data:image/png;base64,${buffer.toString('base64')}`
      }
    } catch {
      // Image file not found
    }

    return {
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      type: row.type,
      image_data: imageData,
      width: row.width,
      height: row.height,
      is_default: Boolean(row.is_default),
      created_at: row.created_at,
      updated_at: row.updated_at
    }
  })
}

/**
 * Get a signature by ID
 */
export function getSignature(signatureId: string): Signature | null {
  const db = getDatabase()

  const row = db.prepare(`
    SELECT * FROM signatures WHERE id = ?
  `).get(signatureId) as {
    id: string
    user_id: string
    name: string
    type: Signature['type']
    image_path: string
    width: number
    height: number
    is_default: number
    created_at: string
    updated_at: string
  } | undefined

  if (!row) return null

  let imageData = ''
  try {
    if (fs.existsSync(row.image_path)) {
      const buffer = fs.readFileSync(row.image_path)
      imageData = `data:image/png;base64,${buffer.toString('base64')}`
    }
  } catch {
    // Image file not found
  }

  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    type: row.type,
    image_data: imageData,
    width: row.width,
    height: row.height,
    is_default: Boolean(row.is_default),
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

/**
 * Get default signature for a user
 */
export function getDefaultSignature(
  userId: string,
  type: Signature['type'] = 'signature'
): Signature | null {
  const db = getDatabase()

  const row = db.prepare(`
    SELECT * FROM signatures
    WHERE user_id = ? AND type = ? AND is_default = 1
  `).get(userId, type) as {
    id: string
    user_id: string
    name: string
    type: Signature['type']
    image_path: string
    width: number
    height: number
    is_default: number
    created_at: string
    updated_at: string
  } | undefined

  if (!row) return null

  let imageData = ''
  try {
    if (fs.existsSync(row.image_path)) {
      const buffer = fs.readFileSync(row.image_path)
      imageData = `data:image/png;base64,${buffer.toString('base64')}`
    }
  } catch {
    // Image file not found
  }

  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    type: row.type,
    image_data: imageData,
    width: row.width,
    height: row.height,
    is_default: true,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

/**
 * Update a signature
 */
export function updateSignature(
  signatureId: string,
  updates: Partial<Pick<Signature, 'name' | 'image_data' | 'is_default'>>,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = db.prepare('SELECT * FROM signatures WHERE id = ?').get(signatureId) as {
    user_id: string
    type: string
    image_path: string
  } | undefined

  if (!existing) {
    return { success: false, error: 'Signature not found' }
  }

  if (existing.user_id !== userId) {
    return { success: false, error: 'Permission denied' }
  }

  const setClauses: string[] = ['updated_at = datetime(\'now\')']
  const values: unknown[] = []

  if (updates.name !== undefined) {
    setClauses.push('name = ?')
    values.push(updates.name)
  }

  if (updates.image_data !== undefined) {
    // Save new image
    const imageBuffer = Buffer.from(updates.image_data.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    fs.writeFileSync(existing.image_path, imageBuffer)
  }

  if (updates.is_default !== undefined) {
    if (updates.is_default) {
      // Unset other defaults
      db.prepare(`
        UPDATE signatures SET is_default = 0
        WHERE user_id = ? AND type = ?
      `).run(userId, existing.type)
    }
    setClauses.push('is_default = ?')
    values.push(updates.is_default ? 1 : 0)
  }

  values.push(signatureId)

  db.prepare(`
    UPDATE signatures SET ${setClauses.join(', ')} WHERE id = ?
  `).run(...values)

  logAudit({
    action: 'SIGNATURE_UPDATE',
    entityType: 'signature',
    entityId: signatureId,
    userId,
    details: updates
  })

  return { success: true }
}

/**
 * Delete a signature
 */
export function deleteSignature(signatureId: string, userId: string): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = db.prepare('SELECT * FROM signatures WHERE id = ?').get(signatureId) as {
    user_id: string
    image_path: string
  } | undefined

  if (!existing) {
    return { success: false, error: 'Signature not found' }
  }

  if (existing.user_id !== userId) {
    return { success: false, error: 'Permission denied' }
  }

  // Delete image file
  try {
    if (fs.existsSync(existing.image_path)) {
      fs.unlinkSync(existing.image_path)
    }
  } catch {
    // Ignore file deletion errors
  }

  // Delete placements using this signature
  db.prepare('DELETE FROM signature_placements WHERE signature_id = ?').run(signatureId)

  // Delete signature
  db.prepare('DELETE FROM signatures WHERE id = ?').run(signatureId)

  logAudit({
    action: 'SIGNATURE_DELETE',
    entityType: 'signature',
    entityId: signatureId,
    userId,
    details: {}
  })

  return { success: true }
}

/**
 * Place a signature on a document
 */
export function placeSignature(input: PlaceSignatureInput): SignaturePlacement {
  const db = getDatabase()
  const id = generatePlacementId()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO signature_placements (
      id, document_type, document_id, signature_id,
      page_number, x_position, y_position, scale, rotation,
      placed_by, placed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.document_type,
    input.document_id,
    input.signature_id,
    input.page_number,
    input.x_position,
    input.y_position,
    input.scale || 1,
    input.rotation || 0,
    input.placed_by,
    now
  )

  logAudit({
    action: 'SIGNATURE_PLACE',
    entityType: input.document_type,
    entityId: input.document_id,
    userId: input.placed_by,
    details: { signatureId: input.signature_id, page: input.page_number }
  })

  return {
    id,
    document_type: input.document_type,
    document_id: input.document_id,
    signature_id: input.signature_id,
    page_number: input.page_number,
    x_position: input.x_position,
    y_position: input.y_position,
    scale: input.scale || 1,
    rotation: input.rotation || 0,
    placed_by: input.placed_by,
    placed_at: now
  }
}

/**
 * Get signature placements for a document
 */
export function getDocumentPlacements(
  documentType: string,
  documentId: string
): SignaturePlacement[] {
  const db = getDatabase()

  return db.prepare(`
    SELECT * FROM signature_placements
    WHERE document_type = ? AND document_id = ?
    ORDER BY page_number, placed_at
  `).all(documentType, documentId) as SignaturePlacement[]
}

/**
 * Remove a signature placement
 */
export function removePlacement(placementId: string, userId: string): { success: boolean; error?: string } {
  const db = getDatabase()

  const placement = db.prepare('SELECT * FROM signature_placements WHERE id = ?').get(placementId) as SignaturePlacement | undefined

  if (!placement) {
    return { success: false, error: 'Placement not found' }
  }

  db.prepare('DELETE FROM signature_placements WHERE id = ?').run(placementId)

  logAudit({
    action: 'SIGNATURE_REMOVE',
    entityType: placement.document_type,
    entityId: placement.document_id,
    userId,
    details: { placementId }
  })

  return { success: true }
}

/**
 * Get signatures with their placements for PDF export
 */
export function getSignaturesForExport(
  documentType: string,
  documentId: string
): Array<{
  placement: SignaturePlacement
  signature: Signature
}> {
  const placements = getDocumentPlacements(documentType, documentId)
  const result: Array<{ placement: SignaturePlacement; signature: Signature }> = []

  for (const placement of placements) {
    const signature = getSignature(placement.signature_id)
    if (signature) {
      result.push({ placement, signature })
    }
  }

  return result
}

export default {
  createSignature,
  getSignatures,
  getSignature,
  getDefaultSignature,
  updateSignature,
  deleteSignature,
  placeSignature,
  getDocumentPlacements,
  removePlacement,
  getSignaturesForExport
}
