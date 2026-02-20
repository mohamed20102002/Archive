/**
 * View Service
 *
 * Manages saved views for different list pages.
 * Views include filters, sort orders, column configurations, and other display preferences.
 */

import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'

export interface ViewFilter {
  field: string
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'between'
  value: any
}

export interface ViewSort {
  field: string
  direction: 'asc' | 'desc'
}

export interface ViewConfig {
  filters: ViewFilter[]
  sorts: ViewSort[]
  columns?: {
    id: string
    visible: boolean
    width?: number
    order: number
  }[]
  groupBy?: string
  pageSize?: number
  customSettings?: Record<string, any>
}

export interface SavedView {
  id: number
  name: string
  entity_type: string // 'topics' | 'records' | 'letters' | 'moms' | 'issues' | etc.
  config: ViewConfig
  is_default: boolean
  is_shared: boolean
  created_by: number
  created_at: string
  updated_at: string
}

export interface CreateViewInput {
  name: string
  entity_type: string
  config: ViewConfig
  is_default?: boolean
  is_shared?: boolean
  created_by: number
}

export interface UpdateViewInput {
  name?: string
  config?: ViewConfig
  is_default?: boolean
  is_shared?: boolean
}

/**
 * Create a new saved view
 */
export function createView(input: CreateViewInput): SavedView {
  const db = getDatabase()
  const now = new Date().toISOString()

  // If this is being set as default, unset any existing default for this entity
  if (input.is_default) {
    db.prepare(`
      UPDATE saved_views
      SET is_default = 0
      WHERE entity_type = ? AND created_by = ?
    `).run(input.entity_type, input.created_by)
  }

  const result = db.prepare(`
    INSERT INTO saved_views (name, entity_type, config, is_default, is_shared, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.name,
    input.entity_type,
    JSON.stringify(input.config),
    input.is_default ? 1 : 0,
    input.is_shared ? 1 : 0,
    input.created_by,
    now,
    now
  )

  logAudit({
    action: 'create',
    entity_type: 'view',
    entity_id: result.lastInsertRowid as number,
    user_id: input.created_by,
    details: { name: input.name, entity_type: input.entity_type }
  })

  return getViewById(result.lastInsertRowid as number)!
}

/**
 * Get a view by ID
 */
export function getViewById(id: number): SavedView | null {
  const db = getDatabase()

  const row = db.prepare(`
    SELECT * FROM saved_views WHERE id = ?
  `).get(id) as any

  if (!row) return null

  return {
    ...row,
    config: JSON.parse(row.config),
    is_default: !!row.is_default,
    is_shared: !!row.is_shared
  }
}

/**
 * Get all views for an entity type and user
 */
export function getViews(
  entityType: string,
  userId: number,
  includeShared: boolean = true
): SavedView[] {
  const db = getDatabase()

  let query = `
    SELECT * FROM saved_views
    WHERE entity_type = ?
    AND (created_by = ?${includeShared ? ' OR is_shared = 1' : ''})
    ORDER BY is_default DESC, name ASC
  `

  const rows = db.prepare(query).all(entityType, userId) as any[]

  return rows.map(row => ({
    ...row,
    config: JSON.parse(row.config),
    is_default: !!row.is_default,
    is_shared: !!row.is_shared
  }))
}

/**
 * Get the default view for an entity type and user
 */
export function getDefaultView(entityType: string, userId: number): SavedView | null {
  const db = getDatabase()

  // First try to get user's default
  let row = db.prepare(`
    SELECT * FROM saved_views
    WHERE entity_type = ? AND created_by = ? AND is_default = 1
  `).get(entityType, userId) as any

  // If no user default, try shared default
  if (!row) {
    row = db.prepare(`
      SELECT * FROM saved_views
      WHERE entity_type = ? AND is_shared = 1 AND is_default = 1
    `).get(entityType) as any
  }

  if (!row) return null

  return {
    ...row,
    config: JSON.parse(row.config),
    is_default: !!row.is_default,
    is_shared: !!row.is_shared
  }
}

/**
 * Update a saved view
 */
export function updateView(id: number, input: UpdateViewInput, userId: number): SavedView | null {
  const db = getDatabase()
  const existing = getViewById(id)

  if (!existing) return null

  // Check permission
  if (existing.created_by !== userId && !existing.is_shared) {
    throw new Error('Permission denied')
  }

  const now = new Date().toISOString()

  // If setting as default, unset others
  if (input.is_default) {
    db.prepare(`
      UPDATE saved_views
      SET is_default = 0
      WHERE entity_type = ? AND created_by = ? AND id != ?
    `).run(existing.entity_type, userId, id)
  }

  const updates: string[] = []
  const values: any[] = []

  if (input.name !== undefined) {
    updates.push('name = ?')
    values.push(input.name)
  }
  if (input.config !== undefined) {
    updates.push('config = ?')
    values.push(JSON.stringify(input.config))
  }
  if (input.is_default !== undefined) {
    updates.push('is_default = ?')
    values.push(input.is_default ? 1 : 0)
  }
  if (input.is_shared !== undefined) {
    updates.push('is_shared = ?')
    values.push(input.is_shared ? 1 : 0)
  }

  updates.push('updated_at = ?')
  values.push(now)
  values.push(id)

  db.prepare(`
    UPDATE saved_views
    SET ${updates.join(', ')}
    WHERE id = ?
  `).run(...values)

  logAudit({
    action: 'update',
    entity_type: 'view',
    entity_id: id,
    user_id: userId,
    details: { name: input.name || existing.name }
  })

  return getViewById(id)
}

/**
 * Delete a saved view
 */
export function deleteView(id: number, userId: number): boolean {
  const db = getDatabase()
  const existing = getViewById(id)

  if (!existing) return false

  // Check permission
  if (existing.created_by !== userId) {
    throw new Error('Permission denied')
  }

  db.prepare('DELETE FROM saved_views WHERE id = ?').run(id)

  logAudit({
    action: 'delete',
    entity_type: 'view',
    entity_id: id,
    user_id: userId,
    details: { name: existing.name }
  })

  return true
}

/**
 * Duplicate a view
 */
export function duplicateView(id: number, newName: string, userId: number): SavedView | null {
  const existing = getViewById(id)
  if (!existing) return null

  return createView({
    name: newName,
    entity_type: existing.entity_type,
    config: existing.config,
    is_default: false,
    is_shared: false,
    created_by: userId
  })
}

/**
 * Share/unshare a view
 */
export function toggleShareView(id: number, userId: number): SavedView | null {
  const existing = getViewById(id)
  if (!existing || existing.created_by !== userId) return null

  return updateView(id, { is_shared: !existing.is_shared }, userId)
}

export default {
  createView,
  getViewById,
  getViews,
  getDefaultView,
  updateView,
  deleteView,
  duplicateView,
  toggleShareView
}
