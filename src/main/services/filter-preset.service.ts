/**
 * Filter Preset Service
 *
 * Manages saved filter presets for list views.
 * Supports presets for topics, letters, MOMs, issues, etc.
 */

import { getDatabase } from '../database/connection'
import { randomUUID } from 'crypto'

export type EntityType = 'topics' | 'records' | 'letters' | 'moms' | 'issues' | 'contacts' | 'authorities' | 'attendance'

export interface FilterPreset {
  id: string
  user_id: string
  entity_type: EntityType
  name: string
  filters: Record<string, unknown>
  is_default: boolean
  is_shared: boolean
  created_at: string
  updated_at: string
}

export interface CreatePresetInput {
  userId: string
  entityType: EntityType
  name: string
  filters: Record<string, unknown>
  isDefault?: boolean
  isShared?: boolean
}

export interface UpdatePresetInput {
  name?: string
  filters?: Record<string, unknown>
  isDefault?: boolean
  isShared?: boolean
}

/**
 * Initialize filter_presets table if not exists
 */
export function ensureFilterPresetsTable(): void {
  const db = getDatabase()

  db.exec(`
    CREATE TABLE IF NOT EXISTS filter_presets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      name TEXT NOT NULL,
      filters TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      is_shared INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_filter_presets_user_entity
    ON filter_presets(user_id, entity_type)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_filter_presets_shared
    ON filter_presets(is_shared, entity_type)
  `)
}

/**
 * Create a new filter preset
 */
export function createFilterPreset(input: CreatePresetInput): {
  success: boolean
  preset?: FilterPreset
  error?: string
} {
  ensureFilterPresetsTable()
  const db = getDatabase()

  const id = randomUUID()
  const now = new Date().toISOString()

  try {
    // If setting as default, unset other defaults for this entity type
    if (input.isDefault) {
      db.prepare(`
        UPDATE filter_presets
        SET is_default = 0, updated_at = ?
        WHERE user_id = ? AND entity_type = ?
      `).run(now, input.userId, input.entityType)
    }

    db.prepare(`
      INSERT INTO filter_presets (id, user_id, entity_type, name, filters, is_default, is_shared, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.userId,
      input.entityType,
      input.name.trim(),
      JSON.stringify(input.filters),
      input.isDefault ? 1 : 0,
      input.isShared ? 1 : 0,
      now,
      now
    )

    const preset: FilterPreset = {
      id,
      user_id: input.userId,
      entity_type: input.entityType,
      name: input.name.trim(),
      filters: input.filters,
      is_default: input.isDefault || false,
      is_shared: input.isShared || false,
      created_at: now,
      updated_at: now
    }

    return { success: true, preset }
  } catch (error: any) {
    console.error('Error creating filter preset:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get all filter presets for a user and entity type
 */
export function getFilterPresets(
  userId: string,
  entityType: EntityType
): FilterPreset[] {
  ensureFilterPresetsTable()
  const db = getDatabase()

  try {
    const results = db.prepare(`
      SELECT * FROM filter_presets
      WHERE (user_id = ? OR is_shared = 1)
        AND entity_type = ?
      ORDER BY is_default DESC, name ASC
    `).all(userId, entityType) as any[]

    return results.map(row => ({
      ...row,
      filters: JSON.parse(row.filters),
      is_default: Boolean(row.is_default),
      is_shared: Boolean(row.is_shared)
    }))
  } catch (error) {
    console.error('Error getting filter presets:', error)
    return []
  }
}

/**
 * Get a single filter preset by ID
 */
export function getFilterPresetById(id: string): FilterPreset | null {
  ensureFilterPresetsTable()
  const db = getDatabase()

  try {
    const row = db.prepare('SELECT * FROM filter_presets WHERE id = ?').get(id) as any

    if (!row) return null

    return {
      ...row,
      filters: JSON.parse(row.filters),
      is_default: Boolean(row.is_default),
      is_shared: Boolean(row.is_shared)
    }
  } catch (error) {
    console.error('Error getting filter preset:', error)
    return null
  }
}

/**
 * Get the default preset for a user and entity type
 */
export function getDefaultPreset(
  userId: string,
  entityType: EntityType
): FilterPreset | null {
  ensureFilterPresetsTable()
  const db = getDatabase()

  try {
    const row = db.prepare(`
      SELECT * FROM filter_presets
      WHERE user_id = ? AND entity_type = ? AND is_default = 1
    `).get(userId, entityType) as any

    if (!row) return null

    return {
      ...row,
      filters: JSON.parse(row.filters),
      is_default: true,
      is_shared: Boolean(row.is_shared)
    }
  } catch (error) {
    console.error('Error getting default preset:', error)
    return null
  }
}

/**
 * Update a filter preset
 */
export function updateFilterPreset(
  id: string,
  userId: string,
  input: UpdatePresetInput
): { success: boolean; error?: string } {
  ensureFilterPresetsTable()
  const db = getDatabase()

  const now = new Date().toISOString()

  try {
    // Get existing preset
    const existing = db.prepare(
      'SELECT * FROM filter_presets WHERE id = ? AND user_id = ?'
    ).get(id, userId) as any

    if (!existing) {
      return { success: false, error: 'Preset not found or access denied' }
    }

    // If setting as default, unset other defaults
    if (input.isDefault) {
      db.prepare(`
        UPDATE filter_presets
        SET is_default = 0, updated_at = ?
        WHERE user_id = ? AND entity_type = ? AND id != ?
      `).run(now, userId, existing.entity_type, id)
    }

    // Build update query
    const updates: string[] = ['updated_at = ?']
    const params: any[] = [now]

    if (input.name !== undefined) {
      updates.push('name = ?')
      params.push(input.name.trim())
    }

    if (input.filters !== undefined) {
      updates.push('filters = ?')
      params.push(JSON.stringify(input.filters))
    }

    if (input.isDefault !== undefined) {
      updates.push('is_default = ?')
      params.push(input.isDefault ? 1 : 0)
    }

    if (input.isShared !== undefined) {
      updates.push('is_shared = ?')
      params.push(input.isShared ? 1 : 0)
    }

    params.push(id)

    db.prepare(`
      UPDATE filter_presets
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...params)

    return { success: true }
  } catch (error: any) {
    console.error('Error updating filter preset:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Delete a filter preset
 */
export function deleteFilterPreset(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  ensureFilterPresetsTable()
  const db = getDatabase()

  try {
    const result = db.prepare(
      'DELETE FROM filter_presets WHERE id = ? AND user_id = ?'
    ).run(id, userId)

    if (result.changes === 0) {
      return { success: false, error: 'Preset not found or access denied' }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting filter preset:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Set a preset as default
 */
export function setDefaultPreset(
  id: string,
  userId: string,
  entityType: EntityType
): { success: boolean; error?: string } {
  return updateFilterPreset(id, userId, { isDefault: true })
}

/**
 * Clear default preset for an entity type
 */
export function clearDefaultPreset(
  userId: string,
  entityType: EntityType
): { success: boolean; error?: string } {
  ensureFilterPresetsTable()
  const db = getDatabase()

  const now = new Date().toISOString()

  try {
    db.prepare(`
      UPDATE filter_presets
      SET is_default = 0, updated_at = ?
      WHERE user_id = ? AND entity_type = ?
    `).run(now, userId, entityType)

    return { success: true }
  } catch (error: any) {
    console.error('Error clearing default preset:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get preset usage statistics
 */
export function getPresetStats(userId: string): {
  totalPresets: number
  byEntityType: Record<EntityType, number>
  sharedPresets: number
} {
  ensureFilterPresetsTable()
  const db = getDatabase()

  try {
    const total = db.prepare(
      'SELECT COUNT(*) as count FROM filter_presets WHERE user_id = ?'
    ).get(userId) as { count: number }

    const byType = db.prepare(`
      SELECT entity_type, COUNT(*) as count
      FROM filter_presets
      WHERE user_id = ?
      GROUP BY entity_type
    `).all(userId) as { entity_type: EntityType; count: number }[]

    const shared = db.prepare(
      'SELECT COUNT(*) as count FROM filter_presets WHERE user_id = ? AND is_shared = 1'
    ).get(userId) as { count: number }

    const byEntityType: Record<EntityType, number> = {
      topics: 0,
      records: 0,
      letters: 0,
      moms: 0,
      issues: 0,
      contacts: 0,
      authorities: 0,
      attendance: 0
    }

    for (const row of byType) {
      byEntityType[row.entity_type] = row.count
    }

    return {
      totalPresets: total.count,
      byEntityType,
      sharedPresets: shared.count
    }
  } catch (error) {
    console.error('Error getting preset stats:', error)
    return {
      totalPresets: 0,
      byEntityType: {
        topics: 0,
        records: 0,
        letters: 0,
        moms: 0,
        issues: 0,
        contacts: 0,
        authorities: 0,
        attendance: 0
      },
      sharedPresets: 0
    }
  }
}
