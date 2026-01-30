import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'
import { generateId } from '../utils/crypto'
import { getUsername } from './auth.service'
import { encryptPassword, decryptPassword } from './secure-resources-crypto'

// Types

export interface CredentialView {
  id: string
  system_name: string
  username: string
  category: string
  description: string | null
  notes: string | null
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
}

export interface UpdateCredentialData {
  system_name?: string
  username?: string
  password?: string
  category?: string
  description?: string
  notes?: string
}

export interface CredentialFilters {
  query?: string
  category?: string
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

  try {
    const { encrypted, iv, tag } = encryptPassword(data.password)

    db.prepare(`
      INSERT INTO credentials (
        id, system_name, username, encrypted_password, password_iv, password_tag,
        category, description, notes, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

  if (filters?.query?.trim()) {
    conditions.push('(c.system_name LIKE ? OR c.username LIKE ? OR c.description LIKE ?)')
    const q = `%${filters.query.trim()}%`
    values.push(q, q, q)
  }

  if (filters?.category) {
    conditions.push('c.category = ?')
    values.push(filters.category)
  }

  const whereClause = conditions.join(' AND ')

  return db.prepare(`
    SELECT
      c.id, c.system_name, c.username, c.category,
      c.description, c.notes, c.created_by, c.created_at, c.updated_at,
      u.display_name as creator_name
    FROM credentials c
    LEFT JOIN users u ON c.created_by = u.id
    WHERE ${whereClause}
    ORDER BY c.system_name ASC
  `).all(...values) as CredentialView[]
}

// Get single credential by ID (no password fields)
export function getCredentialById(id: string): CredentialView | null {
  const db = getDatabase()

  const credential = db.prepare(`
    SELECT
      c.id, c.system_name, c.username, c.category,
      c.description, c.notes, c.created_by, c.created_at, c.updated_at,
      u.display_name as creator_name
    FROM credentials c
    LEFT JOIN users u ON c.created_by = u.id
    WHERE c.id = ? AND c.deleted_at IS NULL
  `).get(id) as CredentialView | undefined

  return credential || null
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
  } catch (error) {
    console.error('Error decrypting password:', error)
    return { success: false, error: 'Failed to decrypt password' }
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

// Get stats for both credentials and references
export function getSecureResourceStats(): {
  totalCredentials: number
  totalReferences: number
  credentialsByCategory: Record<string, number>
  referencesByCategory: Record<string, number>
} {
  const db = getDatabase()

  const totalCredentials = (db.prepare(
    'SELECT COUNT(*) as count FROM credentials WHERE deleted_at IS NULL'
  ).get() as { count: number }).count

  const totalReferences = (db.prepare(
    'SELECT COUNT(*) as count FROM secure_references WHERE deleted_at IS NULL'
  ).get() as { count: number }).count

  const credCats = db.prepare(
    'SELECT category, COUNT(*) as count FROM credentials WHERE deleted_at IS NULL GROUP BY category'
  ).all() as { category: string; count: number }[]

  const refCats = db.prepare(
    'SELECT category, COUNT(*) as count FROM secure_references WHERE deleted_at IS NULL GROUP BY category'
  ).all() as { category: string; count: number }[]

  return {
    totalCredentials,
    totalReferences,
    credentialsByCategory: Object.fromEntries(credCats.map(c => [c.category, c.count])),
    referencesByCategory: Object.fromEntries(refCats.map(c => [c.category, c.count]))
  }
}
