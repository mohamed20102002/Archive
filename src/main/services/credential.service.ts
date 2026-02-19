import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'
import { generateId } from '../utils/crypto'
import { getUsername } from './auth.service'
import { encryptPassword, decryptPassword } from './secure-resources-crypto'

// Types

export type ResourceColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | null

export interface CredentialView {
  id: string
  system_name: string
  username: string
  category: string
  description: string | null
  notes: string | null
  admin_only: boolean
  color: ResourceColor
  created_by: string
  created_at: string
  updated_at: string
  creator_name?: string
}

export interface CreateCredentialData {
  system_name: string
  username: string
  password: string
  category?: string
  description?: string
  notes?: string
  admin_only?: boolean
  color?: ResourceColor
}

export interface UpdateCredentialData {
  system_name?: string
  username?: string
  password?: string
  category?: string
  description?: string
  notes?: string
  admin_only?: boolean
  color?: ResourceColor
}

export interface CredentialFilters {
  query?: string
  category?: string
  isAdmin?: boolean
}

// Create credential
export function createCredential(
  data: CreateCredentialData,
  userId: string
): { success: boolean; credential?: CredentialView; error?: string } {
  const db = getDatabase()

  if (!data.system_name?.trim()) {
    return { success: false, error: 'System name is required' }
  }
  if (!data.username?.trim()) {
    return { success: false, error: 'Username is required' }
  }
  if (!data.password) {
    return { success: false, error: 'Password is required' }
  }

  const id = generateId()
  const now = new Date().toISOString()
  const category = data.category || 'Other'
  const adminOnly = data.admin_only ? 1 : 0
  const color = data.color || null

  try {
    const { encrypted, iv, tag } = encryptPassword(data.password)

    db.prepare(`
      INSERT INTO credentials (
        id, system_name, username, encrypted_password, password_iv, password_tag,
        category, description, notes, admin_only, color, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.system_name.trim(),
      data.username.trim(),
      encrypted,
      iv,
      tag,
      category,
      data.description?.trim() || null,
      data.notes?.trim() || null,
      adminOnly,
      color,
      userId,
      now,
      now
    )

    logAudit(
      'CREDENTIAL_CREATE' as any,
      userId,
      getUsername(userId),
      'credential',
      id,
      { system_name: data.system_name.trim(), category }
    )

    const credential = getCredentialById(id)
    return { success: true, credential: credential || undefined }
  } catch (error) {
    console.error('Error creating credential:', error)
    return { success: false, error: 'Failed to create credential' }
  }
}

// Get all credentials (no password fields)
export function getAllCredentials(filters?: CredentialFilters): CredentialView[] {
  const db = getDatabase()

  const conditions: string[] = ['c.deleted_at IS NULL']
  const values: unknown[] = []

  // Filter out admin_only resources for non-admin users
  if (!filters?.isAdmin) {
    conditions.push('c.admin_only = 0')
  }

  if (filters?.query?.trim()) {
    // Limit query length to prevent DoS attacks
    const trimmedQuery = filters.query.trim().substring(0, 200)
    conditions.push('(c.system_name LIKE ? OR c.username LIKE ? OR c.description LIKE ?)')
    const q = `%${trimmedQuery}%`
    values.push(q, q, q)
  }

  if (filters?.category) {
    conditions.push('c.category = ?')
    values.push(filters.category)
  }

  const whereClause = conditions.join(' AND ')

  const rows = db.prepare(`
    SELECT
      c.id, c.system_name, c.username, c.category,
      c.description, c.notes, c.admin_only, c.color,
      c.created_by, c.created_at, c.updated_at,
      u.display_name as creator_name
    FROM credentials c
    LEFT JOIN users u ON c.created_by = u.id
    WHERE ${whereClause}
    ORDER BY c.system_name ASC
  `).all(...values) as (CredentialView & { admin_only: number })[]

  // Convert admin_only from integer to boolean
  return rows.map(row => ({
    ...row,
    admin_only: row.admin_only === 1
  }))
}

// Get single credential by ID (no password fields)
export function getCredentialById(id: string, isAdmin: boolean = true): CredentialView | null {
  const db = getDatabase()

  const conditions = ['c.id = ?', 'c.deleted_at IS NULL']
  if (!isAdmin) {
    conditions.push('c.admin_only = 0')
  }

  const row = db.prepare(`
    SELECT
      c.id, c.system_name, c.username, c.category,
      c.description, c.notes, c.admin_only, c.color,
      c.created_by, c.created_at, c.updated_at,
      u.display_name as creator_name
    FROM credentials c
    LEFT JOIN users u ON c.created_by = u.id
    WHERE ${conditions.join(' AND ')}
  `).get(id) as (CredentialView & { admin_only: number }) | undefined

  if (!row) return null

  return {
    ...row,
    admin_only: row.admin_only === 1
  }
}

// Get credential password (decrypt + audit)
export function getCredentialPassword(
  id: string,
  userId: string
): { success: boolean; password?: string; error?: string } {
  const db = getDatabase()

  const row = db.prepare(`
    SELECT encrypted_password, password_iv, password_tag, system_name
    FROM credentials
    WHERE id = ? AND deleted_at IS NULL
  `).get(id) as { encrypted_password: string; password_iv: string; password_tag: string; system_name: string } | undefined

  if (!row) {
    return { success: false, error: 'Credential not found' }
  }

  try {
    const password = decryptPassword(row.encrypted_password, row.password_iv, row.password_tag)

    logAudit(
      'CREDENTIAL_VIEW_PASSWORD' as any,
      userId,
      getUsername(userId),
      'credential',
      id,
      { system_name: row.system_name }
    )

    return { success: true, password }
  } catch (error: any) {
    console.error('Error decrypting password:', error)
    // Check if this is an invalid IV error (likely seeded with placeholder data)
    if (error.message?.includes('Invalid IV') || error.message?.includes('Invalid initialization vector')) {
      return { success: false, error: 'This credential was created with invalid encryption. Please delete it and create a new one.' }
    }
    return { success: false, error: 'Failed to decrypt password. The encryption key may have changed.' }
  }
}

// Update credential
export function updateCredential(
  id: string,
  data: UpdateCredentialData,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = db.prepare(
    'SELECT * FROM credentials WHERE id = ? AND deleted_at IS NULL'
  ).get(id) as any

  if (!existing) {
    return { success: false, error: 'Credential not found' }
  }

  const fields: string[] = []
  const values: unknown[] = []

  if (data.system_name !== undefined) {
    if (!data.system_name.trim()) {
      return { success: false, error: 'System name cannot be empty' }
    }
    fields.push('system_name = ?')
    values.push(data.system_name.trim())
  }

  if (data.username !== undefined) {
    if (!data.username.trim()) {
      return { success: false, error: 'Username cannot be empty' }
    }
    fields.push('username = ?')
    values.push(data.username.trim())
  }

  if (data.password !== undefined && data.password) {
    const { encrypted, iv, tag } = encryptPassword(data.password)
    fields.push('encrypted_password = ?')
    values.push(encrypted)
    fields.push('password_iv = ?')
    values.push(iv)
    fields.push('password_tag = ?')
    values.push(tag)
  }

  if (data.category !== undefined) {
    fields.push('category = ?')
    values.push(data.category)
  }

  if (data.description !== undefined) {
    fields.push('description = ?')
    values.push(data.description?.trim() || null)
  }

  if (data.notes !== undefined) {
    fields.push('notes = ?')
    values.push(data.notes?.trim() || null)
  }

  if (data.admin_only !== undefined) {
    fields.push('admin_only = ?')
    values.push(data.admin_only ? 1 : 0)
  }

  if (data.color !== undefined) {
    fields.push('color = ?')
    values.push(data.color)
  }

  if (fields.length === 0) {
    return { success: true }
  }

  fields.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id)

  try {
    db.prepare(`UPDATE credentials SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    logAudit(
      'CREDENTIAL_UPDATE' as any,
      userId,
      getUsername(userId),
      'credential',
      id,
      { system_name: existing.system_name }
    )

    return { success: true }
  } catch (error) {
    console.error('Error updating credential:', error)
    return { success: false, error: 'Failed to update credential' }
  }
}

// Soft delete credential
export function deleteCredential(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = db.prepare(
    'SELECT system_name FROM credentials WHERE id = ? AND deleted_at IS NULL'
  ).get(id) as { system_name: string } | undefined

  if (!existing) {
    return { success: false, error: 'Credential not found' }
  }

  try {
    db.prepare(
      'UPDATE credentials SET deleted_at = ? WHERE id = ?'
    ).run(new Date().toISOString(), id)

    logAudit(
      'CREDENTIAL_DELETE' as any,
      userId,
      getUsername(userId),
      'credential',
      id,
      { system_name: existing.system_name }
    )

    return { success: true }
  } catch (error) {
    console.error('Error deleting credential:', error)
    return { success: false, error: 'Failed to delete credential' }
  }
}

// Toggle admin_only status
export function toggleCredentialAdminOnly(
  id: string,
  adminOnly: boolean,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const existing = db.prepare(
    'SELECT system_name FROM credentials WHERE id = ? AND deleted_at IS NULL'
  ).get(id) as { system_name: string } | undefined

  if (!existing) {
    return { success: false, error: 'Credential not found' }
  }

  try {
    db.prepare(
      'UPDATE credentials SET admin_only = ?, updated_at = ? WHERE id = ?'
    ).run(adminOnly ? 1 : 0, new Date().toISOString(), id)

    logAudit(
      'CREDENTIAL_TOGGLE_ADMIN_ONLY' as any,
      userId,
      getUsername(userId),
      'credential',
      id,
      { system_name: existing.system_name, admin_only: adminOnly }
    )

    return { success: true }
  } catch (error) {
    console.error('Error toggling credential admin_only:', error)
    return { success: false, error: 'Failed to update credential' }
  }
}

// Get stats for both credentials and references
// isAdmin: if false, excludes admin_only resources from counts
export function getSecureResourceStats(isAdmin: boolean = true): {
  totalCredentials: number
  totalReferences: number
  credentialsByCategory: Record<string, number>
  referencesByCategory: Record<string, number>
} {
  const db = getDatabase()

  // Filter condition for non-admin users
  const adminFilter = isAdmin ? '' : ' AND admin_only = 0'

  const totalCredentials = (db.prepare(
    `SELECT COUNT(*) as count FROM credentials WHERE deleted_at IS NULL${adminFilter}`
  ).get() as { count: number }).count

  const totalReferences = (db.prepare(
    `SELECT COUNT(*) as count FROM secure_references WHERE deleted_at IS NULL${adminFilter}`
  ).get() as { count: number }).count

  const credCats = db.prepare(
    `SELECT category, COUNT(*) as count FROM credentials WHERE deleted_at IS NULL${adminFilter} GROUP BY category`
  ).all() as { category: string; count: number }[]

  const refCats = db.prepare(
    `SELECT category, COUNT(*) as count FROM secure_references WHERE deleted_at IS NULL${adminFilter} GROUP BY category`
  ).all() as { category: string; count: number }[]

  return {
    totalCredentials,
    totalReferences,
    credentialsByCategory: Object.fromEntries(credCats.map(c => [c.category, c.count])),
    referencesByCategory: Object.fromEntries(refCats.map(c => [c.category, c.count]))
  }
}
