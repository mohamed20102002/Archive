import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'

// Types
export interface Contact {
  id: string
  name: string
  title: string | null
  authority_id: string | null
  email: string | null
  phone: string | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  // Joined fields
  authority_name?: string
  authority_short_name?: string
  creator_name?: string
}

export interface CreateContactData {
  name: string
  title?: string
  authority_id?: string
  email?: string
  phone?: string
  notes?: string
}

export interface UpdateContactData {
  name?: string
  title?: string
  authority_id?: string
  email?: string
  phone?: string
  notes?: string
}

// Helper function to generate ID
function generateId(): string {
  return `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Helper to get username
function getUsername(userId: string): string {
  const db = getDatabase()
  const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as { username: string } | undefined
  return user?.username || 'unknown'
}

// Create contact
export function createContact(
  data: CreateContactData,
  userId: string
): { success: boolean; contact?: Contact; error?: string } {
  const db = getDatabase()

  // Validate required fields
  if (!data.name?.trim()) {
    return { success: false, error: 'Contact name is required' }
  }

  // Validate authority if provided
  if (data.authority_id) {
    const authority = db.prepare('SELECT id FROM authorities WHERE id = ? AND deleted_at IS NULL').get(data.authority_id)
    if (!authority) {
      return { success: false, error: 'Invalid authority' }
    }
  }

  const id = generateId()
  const now = new Date().toISOString()

  try {
    db.prepare(`
      INSERT INTO contacts (
        id, name, title, authority_id, email, phone, notes,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name.trim(),
      data.title?.trim() || null,
      data.authority_id || null,
      data.email?.trim() || null,
      data.phone?.trim() || null,
      data.notes?.trim() || null,
      userId,
      now,
      now
    )

    // Log audit
    logAudit('CONTACT_CREATE', userId, getUsername(userId), 'contact', id, {
      name: data.name,
      authority_id: data.authority_id
    })

    const contact = getContactById(id)
    return { success: true, contact: contact || undefined }
  } catch (error: any) {
    console.error('Error creating contact:', error)
    return { success: false, error: error.message }
  }
}

// Get contact by ID
export function getContactById(id: string): Contact | null {
  const db = getDatabase()

  const contact = db.prepare(`
    SELECT c.*,
           a.name as authority_name,
           a.short_name as authority_short_name,
           u.display_name as creator_name
    FROM contacts c
    LEFT JOIN authorities a ON c.authority_id = a.id
    LEFT JOIN users u ON c.created_by = u.id
    WHERE c.id = ? AND c.deleted_at IS NULL
  `).get(id) as Contact | undefined

  return contact || null
}

// Get all contacts
export function getAllContacts(): Contact[] {
  const db = getDatabase()

  return db.prepare(`
    SELECT c.*,
           a.name as authority_name,
           a.short_name as authority_short_name,
           u.display_name as creator_name
    FROM contacts c
    LEFT JOIN authorities a ON c.authority_id = a.id
    LEFT JOIN users u ON c.created_by = u.id
    WHERE c.deleted_at IS NULL
    ORDER BY c.name ASC
  `).all() as Contact[]
}

// Get contacts by authority
export function getContactsByAuthority(authorityId: string): Contact[] {
  const db = getDatabase()

  return db.prepare(`
    SELECT c.*,
           a.name as authority_name,
           a.short_name as authority_short_name,
           u.display_name as creator_name
    FROM contacts c
    LEFT JOIN authorities a ON c.authority_id = a.id
    LEFT JOIN users u ON c.created_by = u.id
    WHERE c.authority_id = ? AND c.deleted_at IS NULL
    ORDER BY c.name ASC
  `).all(authorityId) as Contact[]
}

// Search contacts
export function searchContacts(query: string): Contact[] {
  const db = getDatabase()
  const searchTerm = `%${query}%`

  return db.prepare(`
    SELECT c.*,
           a.name as authority_name,
           a.short_name as authority_short_name,
           u.display_name as creator_name
    FROM contacts c
    LEFT JOIN authorities a ON c.authority_id = a.id
    LEFT JOIN users u ON c.created_by = u.id
    WHERE c.deleted_at IS NULL
      AND (c.name LIKE ? OR c.title LIKE ? OR c.email LIKE ? OR a.name LIKE ?)
    ORDER BY c.name ASC
  `).all(searchTerm, searchTerm, searchTerm, searchTerm) as Contact[]
}

// Update contact
export function updateContact(
  id: string,
  data: UpdateContactData,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  // Check if contact exists
  const existing = getContactById(id)
  if (!existing) {
    return { success: false, error: 'Contact not found' }
  }

  // Validate authority if provided
  if (data.authority_id) {
    const authority = db.prepare('SELECT id FROM authorities WHERE id = ? AND deleted_at IS NULL').get(data.authority_id)
    if (!authority) {
      return { success: false, error: 'Invalid authority' }
    }
  }

  const updates: string[] = []
  const values: any[] = []

  if (data.name !== undefined) {
    if (!data.name?.trim()) {
      return { success: false, error: 'Contact name is required' }
    }
    updates.push('name = ?')
    values.push(data.name.trim())
  }
  if (data.title !== undefined) {
    updates.push('title = ?')
    values.push(data.title?.trim() || null)
  }
  if (data.authority_id !== undefined) {
    updates.push('authority_id = ?')
    values.push(data.authority_id || null)
  }
  if (data.email !== undefined) {
    updates.push('email = ?')
    values.push(data.email?.trim() || null)
  }
  if (data.phone !== undefined) {
    updates.push('phone = ?')
    values.push(data.phone?.trim() || null)
  }
  if (data.notes !== undefined) {
    updates.push('notes = ?')
    values.push(data.notes?.trim() || null)
  }

  if (updates.length === 0) {
    return { success: true }
  }

  updates.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id)

  try {
    db.prepare(`
      UPDATE contacts SET ${updates.join(', ')} WHERE id = ?
    `).run(...values)

    // Log audit
    logAudit('CONTACT_UPDATE', userId, getUsername(userId), 'contact', id, {
      updated_fields: Object.keys(data)
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error updating contact:', error)
    return { success: false, error: error.message }
  }
}

// Delete contact (soft delete)
export function deleteContact(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  // Check if contact exists
  const existing = getContactById(id)
  if (!existing) {
    return { success: false, error: 'Contact not found' }
  }

  // Check if contact is used in any letters
  const letterCount = db.prepare(
    'SELECT COUNT(*) as count FROM letters WHERE contact_id = ? AND deleted_at IS NULL'
  ).get(id) as { count: number }

  if (letterCount.count > 0) {
    return {
      success: false,
      error: `Cannot delete contact used in ${letterCount.count} letter(s). Please remove the contact from letters first.`
    }
  }

  try {
    db.prepare(`
      UPDATE contacts SET deleted_at = ?, updated_at = ? WHERE id = ?
    `).run(new Date().toISOString(), new Date().toISOString(), id)

    // Log audit
    logAudit('CONTACT_DELETE', userId, getUsername(userId), 'contact', id, {
      name: existing.name
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting contact:', error)
    return { success: false, error: error.message }
  }
}
