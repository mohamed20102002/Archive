import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'
import { getUsername } from './auth.service'

export type EntityType = 'record' | 'topic' | 'letter' | 'mom' | 'issue'

// ===== Undo Operations =====

// Undo Create = Soft delete the entity
export function undoCreate(
  entityType: EntityType,
  entityId: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()
  const now = new Date().toISOString()
  const username = getUsername(userId)

  try {
    const table = getTableName(entityType)
    const stmt = db.prepare(`UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ?`)
    const result = stmt.run(now, now, entityId)

    if (result.changes === 0) {
      return { success: false, error: `${entityType} not found` }
    }

    logAudit(
      `${entityType.toUpperCase()}_DELETE` as any,
      userId,
      username,
      entityType,
      entityId,
      { undone: 'create', via: 'undo' }
    )

    return { success: true }
  } catch (error) {
    console.error(`[History] Failed to undo create for ${entityType}:`, error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Required fields for each entity type (minimum fields that must exist)
const REQUIRED_FIELDS: Record<EntityType, string[]> = {
  record: ['title', 'type', 'topic_id'],
  topic: ['title'],
  letter: ['subject', 'letter_type'],
  mom: ['title', 'mom_id'],
  issue: ['title', 'importance', 'status']
}

// Undo Update = Restore previous state
export function undoUpdate(
  entityType: EntityType,
  entityId: string,
  previousData: Record<string, unknown>,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()
  const now = new Date().toISOString()
  const username = getUsername(userId)

  try {
    // Validate previousData is not null/undefined
    if (!previousData || typeof previousData !== 'object') {
      return { success: false, error: 'Invalid previous data: must be an object' }
    }

    // Validate required fields exist for entity type
    const requiredFields = REQUIRED_FIELDS[entityType] || []
    const missingFields = requiredFields.filter(field => !(field in previousData))
    if (missingFields.length > 0) {
      return { success: false, error: `Missing required fields for ${entityType}: ${missingFields.join(', ')}` }
    }

    const table = getTableName(entityType)

    // Build dynamic update query from previousData
    const updateFields = Object.keys(previousData)
      .filter(key => !['id', 'created_at', 'created_by'].includes(key))
      .map(key => `${key} = ?`)

    if (updateFields.length === 0) {
      return { success: false, error: 'No fields to restore' }
    }

    const values = Object.keys(previousData)
      .filter(key => !['id', 'created_at', 'created_by'].includes(key))
      .map(key => previousData[key])

    const sql = `UPDATE ${table} SET ${updateFields.join(', ')}, updated_at = ? WHERE id = ?`
    const stmt = db.prepare(sql)
    const result = stmt.run(...values, now, entityId)

    if (result.changes === 0) {
      return { success: false, error: `${entityType} not found` }
    }

    logAudit(
      `${entityType.toUpperCase()}_UPDATE` as any,
      userId,
      username,
      entityType,
      entityId,
      { undone: 'update', restored_fields: Object.keys(previousData), via: 'undo' }
    )

    return { success: true }
  } catch (error) {
    console.error(`[History] Failed to undo update for ${entityType}:`, error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Undo Delete = Restore (clear deleted_at)
export function undoDelete(
  entityType: EntityType,
  entityId: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()
  const now = new Date().toISOString()
  const username = getUsername(userId)

  try {
    const table = getTableName(entityType)

    // For issues, also check if we need to reopen
    if (entityType === 'issue') {
      const stmt = db.prepare(`UPDATE ${table} SET deleted_at = NULL, status = 'open', updated_at = ? WHERE id = ?`)
      const result = stmt.run(now, entityId)

      if (result.changes === 0) {
        return { success: false, error: 'Issue not found' }
      }
    } else {
      const stmt = db.prepare(`UPDATE ${table} SET deleted_at = NULL, updated_at = ? WHERE id = ?`)
      const result = stmt.run(now, entityId)

      if (result.changes === 0) {
        return { success: false, error: `${entityType} not found` }
      }
    }

    logAudit(
      `${entityType.toUpperCase()}_CREATE` as any,
      userId,
      username,
      entityType,
      entityId,
      { restored: true, undone: 'delete', via: 'undo' }
    )

    return { success: true }
  } catch (error) {
    console.error(`[History] Failed to undo delete for ${entityType}:`, error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ===== Redo Operations =====

// Redo Create = Restore the entity (clear deleted_at)
export function redoCreate(
  entityType: EntityType,
  entityId: string,
  userId: string
): { success: boolean; error?: string } {
  return undoDelete(entityType, entityId, userId)
}

// Redo Update = Apply after state
export function redoUpdate(
  entityType: EntityType,
  entityId: string,
  afterData: Record<string, unknown>,
  userId: string
): { success: boolean; error?: string } {
  return undoUpdate(entityType, entityId, afterData, userId)
}

// Redo Delete = Soft delete again
export function redoDelete(
  entityType: EntityType,
  entityId: string,
  userId: string
): { success: boolean; error?: string } {
  return undoCreate(entityType, entityId, userId)
}

// ===== Entity Getters (for capturing state) =====

export function getEntityById(
  entityType: EntityType,
  entityId: string
): Record<string, unknown> | null {
  const db = getDatabase()
  const table = getTableName(entityType)

  try {
    const stmt = db.prepare(`SELECT * FROM ${table} WHERE id = ?`)
    const result = stmt.get(entityId) as Record<string, unknown> | undefined
    return result || null
  } catch (error) {
    console.error(`[History] Failed to get ${entityType} by id:`, error)
    return null
  }
}

// ===== Helper Functions =====

function getTableName(entityType: EntityType): string {
  switch (entityType) {
    case 'record':
      return 'records'
    case 'topic':
      return 'topics'
    case 'letter':
      return 'letters'
    case 'mom':
      return 'moms'
    case 'issue':
      return 'issues'
    default:
      throw new Error(`Unknown entity type: ${entityType}`)
  }
}
