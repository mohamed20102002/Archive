import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'

// Types
export interface Authority {
  id: string
  name: string
  short_name: string | null
  type: 'internal' | 'external' | 'government' | 'private'
  is_internal: boolean
  address: string | null
  contact_email: string | null
  contact_phone: string | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  creator_name?: string
  letter_count?: number
}

export interface CreateAuthorityData {
  name: string
  short_name?: string
  type?: 'internal' | 'external' | 'government' | 'private'
  is_internal?: boolean
  address?: string
  contact_email?: string
  contact_phone?: string
  notes?: string
}

export interface UpdateAuthorityData {
  name?: string
  short_name?: string
  type?: 'internal' | 'external' | 'government' | 'private'
  is_internal?: boolean
  address?: string
  contact_email?: string
  contact_phone?: string
  notes?: string
}

// Helper function to generate ID
function generateId(): string {
  return `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Helper to get username
function getUsername(userId: string): string {
  const db = getDatabase()
  const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as { username: string } | undefined
  return user?.username || 'unknown'
}

// Create authority
export function createAuthority(
  data: CreateAuthorityData,
  userId: string
): { success: boolean; authority?: Authority; error?: string } {
  const db = getDatabase()

  // Validate required fields
  if (!data.name?.trim()) {
    return { success: false, error: 'Authority name is required' }
  }

  // Check for duplicate name
  const existing = db.prepare(
    'SELECT id FROM authorities WHERE name = ? AND deleted_at IS NULL'
  ).get(data.name.trim()) as { id: string } | undefined

  if (existing) {
    return { success: false, error: 'An authority with this name already exists' }
  }

  const id = generateId()
  const now = new Date().toISOString()

  try {
    db.prepare(`
      INSERT INTO authorities (
        id, name, short_name, type, is_internal, address, contact_email, contact_phone, notes,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name.trim(),
      data.short_name?.trim() || null,
      data.type || 'external',
      data.is_internal ? 1 : 0,
      data.address?.trim() || null,
      data.contact_email?.trim() || null,
      data.contact_phone?.trim() || null,
      data.notes?.trim() || null,
      userId,
      now,
      now
    )

    // Log audit
    logAudit('AUTHORITY_CREATE', userId, getUsername(userId), 'authority', id, {
      name: data.name,
      type: data.type || 'external',
      is_internal: data.is_internal || false
    })

    const authority = getAuthorityById(id)
    return { success: true, authority: authority || undefined }
  } catch (error: any) {
    console.error('Error creating authority:', error)
    return { success: false, error: error.message }
  }
}

// Get authority by ID
export function getAuthorityById(id: string): Authority | null {
  const db = getDatabase()

  const authority = db.prepare(`
    SELECT a.*,
           u.display_name as creator_name,
           (SELECT COUNT(*) FROM letters WHERE authority_id = a.id AND deleted_at IS NULL) as letter_count
    FROM authorities a
    LEFT JOIN users u ON a.created_by = u.id
    WHERE a.id = ? AND a.deleted_at IS NULL
  `).get(id) as (Omit<Authority, 'is_internal'> & { is_internal: number }) | undefined

  if (!authority) return null

  return {
    ...authority,
    is_internal: authority.is_internal === 1 || (authority.is_internal === null && authority.type === 'internal')
  }
}

// Get all authorities
export function getAllAuthorities(): Authority[] {
  const db = getDatabase()

  const results = db.prepare(`
    SELECT a.*,
           u.display_name as creator_name,
           (SELECT COUNT(*) FROM letters WHERE authority_id = a.id AND deleted_at IS NULL) as letter_count
    FROM authorities a
    LEFT JOIN users u ON a.created_by = u.id
    WHERE a.deleted_at IS NULL
    ORDER BY a.name ASC
  `).all() as (Omit<Authority, 'is_internal'> & { is_internal: number })[]

  return results.map(auth => ({
    ...auth,
    is_internal: auth.is_internal === 1 || (auth.is_internal === null && auth.type === 'internal')
  }))
}

// Get authorities by type
export function getAuthoritiesByType(type: string): Authority[] {
  const db = getDatabase()

  const results = db.prepare(`
    SELECT a.*,
           u.display_name as creator_name,
           (SELECT COUNT(*) FROM letters WHERE authority_id = a.id AND deleted_at IS NULL) as letter_count
    FROM authorities a
    LEFT JOIN users u ON a.created_by = u.id
    WHERE a.type = ? AND a.deleted_at IS NULL
    ORDER BY a.name ASC
  `).all(type) as (Omit<Authority, 'is_internal'> & { is_internal: number })[]

  return results.map(auth => ({
    ...auth,
    is_internal: auth.is_internal === 1 || (auth.is_internal === null && auth.type === 'internal')
  }))
}

// Get internal authorities (for internal letters)
export function getInternalAuthorities(): Authority[] {
  const db = getDatabase()

  const results = db.prepare(`
    SELECT a.*,
           u.display_name as creator_name,
           (SELECT COUNT(*) FROM letters WHERE authority_id = a.id AND deleted_at IS NULL) as letter_count
    FROM authorities a
    LEFT JOIN users u ON a.created_by = u.id
    WHERE a.is_internal = 1 AND a.deleted_at IS NULL
    ORDER BY a.name ASC
  `).all() as (Omit<Authority, 'is_internal'> & { is_internal: number })[]

  return results.map(auth => ({
    ...auth,
    is_internal: true
  }))
}

// Get external authorities (for external letters)
export function getExternalAuthorities(): Authority[] {
  const db = getDatabase()

  const results = db.prepare(`
    SELECT a.*,
           u.display_name as creator_name,
           (SELECT COUNT(*) FROM letters WHERE authority_id = a.id AND deleted_at IS NULL) as letter_count
    FROM authorities a
    LEFT JOIN users u ON a.created_by = u.id
    WHERE a.is_internal = 0 AND a.deleted_at IS NULL
    ORDER BY a.name ASC
  `).all() as (Omit<Authority, 'is_internal'> & { is_internal: number })[]

  return results.map(auth => ({
    ...auth,
    is_internal: false
  }))
}

// Search authorities by name or short_name
export function searchAuthorities(query: string): Authority[] {
  const db = getDatabase()
  const searchTerm = `%${query}%`

  const results = db.prepare(`
    SELECT a.*,
           u.display_name as creator_name,
           (SELECT COUNT(*) FROM letters WHERE authority_id = a.id AND deleted_at IS NULL) as letter_count
    FROM authorities a
    LEFT JOIN users u ON a.created_by = u.id
    WHERE a.deleted_at IS NULL
      AND (a.name LIKE ? OR a.short_name LIKE ? OR a.contact_email LIKE ?)
    ORDER BY a.name ASC
  `).all(searchTerm, searchTerm, searchTerm) as (Omit<Authority, 'is_internal'> & { is_internal: number })[]

  return results.map(auth => ({
    ...auth,
    is_internal: auth.is_internal === 1 || (auth.is_internal === null && auth.type === 'internal')
  }))
}

// Find authority by email domain
export function findAuthorityByEmailDomain(email: string): Authority | null {
  const db = getDatabase()

  // Extract domain from email
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return null

  // Try to find authority with matching email domain
  const authority = db.prepare(`
    SELECT a.*,
           u.display_name as creator_name
    FROM authorities a
    LEFT JOIN users u ON a.created_by = u.id
    WHERE a.deleted_at IS NULL
      AND LOWER(a.contact_email) LIKE ?
    ORDER BY a.name ASC
    LIMIT 1
  `).get(`%@${domain}`) as (Omit<Authority, 'is_internal'> & { is_internal: number }) | undefined

  if (!authority) return null

  return {
    ...authority,
    is_internal: authority.is_internal === 1 || (authority.is_internal === null && authority.type === 'internal')
  }
}

// Update authority
export function updateAuthority(
  id: string,
  data: UpdateAuthorityData,
  userId: string
): { success: boolean; error?: string } {
  console.log('[authority.service] updateAuthority called with:', JSON.stringify({ id, data, userId }, null, 2))
  const db = getDatabase()

  // Check if authority exists
  const existing = getAuthorityById(id)
  console.log('[authority.service] existing authority is_internal:', existing?.is_internal)
  if (!existing) {
    return { success: false, error: 'Authority not found' }
  }

  // Check for duplicate name if name is being changed
  if (data.name && data.name.trim() !== existing.name) {
    const duplicate = db.prepare(
      'SELECT id FROM authorities WHERE name = ? AND id != ? AND deleted_at IS NULL'
    ).get(data.name.trim(), id) as { id: string } | undefined

    if (duplicate) {
      return { success: false, error: 'An authority with this name already exists' }
    }
  }

  const updates: string[] = []
  const values: any[] = []

  if (data.name !== undefined) {
    updates.push('name = ?')
    values.push(data.name.trim())
  }
  if (data.short_name !== undefined) {
    updates.push('short_name = ?')
    values.push(data.short_name?.trim() || null)
  }
  if (data.type !== undefined) {
    updates.push('type = ?')
    values.push(data.type)
  }
  if (data.is_internal !== undefined) {
    updates.push('is_internal = ?')
    values.push(data.is_internal ? 1 : 0)
  }
  if (data.address !== undefined) {
    updates.push('address = ?')
    values.push(data.address?.trim() || null)
  }
  if (data.contact_email !== undefined) {
    updates.push('contact_email = ?')
    values.push(data.contact_email?.trim() || null)
  }
  if (data.contact_phone !== undefined) {
    updates.push('contact_phone = ?')
    values.push(data.contact_phone?.trim() || null)
  }
  if (data.notes !== undefined) {
    updates.push('notes = ?')
    values.push(data.notes?.trim() || null)
  }

  if (updates.length === 0) {
    console.log('[authority.service] No updates to apply')
    return { success: true }
  }

  updates.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id)

  const sql = `UPDATE authorities SET ${updates.join(', ')} WHERE id = ?`
  console.log('[authority.service] SQL:', sql)
  console.log('[authority.service] Values:', values)

  try {
    db.prepare(sql).run(...values)

    // Verify the update
    const updated = getAuthorityById(id)
    console.log('[authority.service] After update, is_internal:', updated?.is_internal)

    // Log audit
    logAudit('AUTHORITY_UPDATE', userId, getUsername(userId), 'authority', id, {
      updated_fields: Object.keys(data)
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error updating authority:', error)
    return { success: false, error: error.message }
  }
}

// Delete authority (soft delete)
export function deleteAuthority(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  // Check if authority exists
  const existing = getAuthorityById(id)
  if (!existing) {
    return { success: false, error: 'Authority not found' }
  }

  // Check if authority has linked letters
  const letterCount = db.prepare(
    'SELECT COUNT(*) as count FROM letters WHERE authority_id = ? AND deleted_at IS NULL'
  ).get(id) as { count: number }

  if (letterCount.count > 0) {
    return {
      success: false,
      error: `Cannot delete authority with ${letterCount.count} linked letter(s). Please reassign or delete the letters first.`
    }
  }

  try {
    db.prepare(`
      UPDATE authorities SET deleted_at = ?, updated_at = ? WHERE id = ?
    `).run(new Date().toISOString(), new Date().toISOString(), id)

    // Log audit
    logAudit('AUTHORITY_DELETE', userId, getUsername(userId), 'authority', id, {
      name: existing.name
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting authority:', error)
    return { success: false, error: error.message }
  }
}

// Get authority statistics
export function getAuthorityStats(): {
  total: number
  byType: Record<string, number>
} {
  const db = getDatabase()

  const total = db.prepare(
    'SELECT COUNT(*) as count FROM authorities WHERE deleted_at IS NULL'
  ).get() as { count: number }

  const byType = db.prepare(`
    SELECT type, COUNT(*) as count
    FROM authorities
    WHERE deleted_at IS NULL
    GROUP BY type
  `).all() as { type: string; count: number }[]

  return {
    total: total.count,
    byType: byType.reduce((acc, item) => {
      acc[item.type] = item.count
      return acc
    }, {} as Record<string, number>)
  }
}
