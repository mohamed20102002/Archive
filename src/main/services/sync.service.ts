/**
 * Sync Service
 *
 * Handles conflict detection and resolution for concurrent edits.
 * Tracks last_modified timestamps and provides conflict resolution strategies.
 */

import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'

export interface EntityVersion {
  entity_type: string
  entity_id: string
  version: number
  updated_at: string
  updated_by: string | null
  checksum: string
}

export interface ConflictInfo {
  entity_type: string
  entity_id: string
  local_version: number
  local_updated_at: string
  local_updated_by: string | null
  server_version: number
  server_updated_at: string
  server_updated_by: string | null
  field_conflicts: FieldConflict[]
}

export interface FieldConflict {
  field: string
  local_value: unknown
  server_value: unknown
  original_value: unknown
}

export type MergeStrategy = 'keep_local' | 'keep_server' | 'keep_newer' | 'manual'

export interface MergeResult {
  success: boolean
  merged_data?: Record<string, unknown>
  conflicts_resolved?: number
  strategy_used: MergeStrategy
  error?: string
}

// Entity version tracking table
const ENTITY_VERSIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS entity_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_by TEXT,
    checksum TEXT NOT NULL,
    UNIQUE(entity_type, entity_id)
  )
`

const ENTITY_VERSIONS_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_entity_versions_lookup
  ON entity_versions(entity_type, entity_id)
`

/**
 * Initialize the entity versions table
 */
export function initSyncTables(): void {
  const db = getDatabase()
  db.exec(ENTITY_VERSIONS_TABLE)
  db.exec(ENTITY_VERSIONS_INDEX)
}

/**
 * Calculate a checksum for entity data
 */
export function calculateChecksum(data: Record<string, unknown>): string {
  const crypto = require('crypto')
  const normalized = JSON.stringify(data, Object.keys(data).sort())
  return crypto.createHash('md5').update(normalized).digest('hex')
}

/**
 * Get the current version of an entity
 */
export function getEntityVersion(entityType: string, entityId: string): EntityVersion | null {
  const db = getDatabase()

  const row = db.prepare(`
    SELECT * FROM entity_versions
    WHERE entity_type = ? AND entity_id = ?
  `).get(entityType, entityId) as EntityVersion | undefined

  return row || null
}

/**
 * Update entity version after successful save
 */
export function updateEntityVersion(
  entityType: string,
  entityId: string,
  data: Record<string, unknown>,
  userId: string | null
): EntityVersion {
  const db = getDatabase()
  const checksum = calculateChecksum(data)
  const now = new Date().toISOString()

  const existing = getEntityVersion(entityType, entityId)
  const newVersion = existing ? existing.version + 1 : 1

  db.prepare(`
    INSERT INTO entity_versions (entity_type, entity_id, version, updated_at, updated_by, checksum)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(entity_type, entity_id) DO UPDATE SET
      version = ?,
      updated_at = ?,
      updated_by = ?,
      checksum = ?
  `).run(
    entityType, entityId, newVersion, now, userId, checksum,
    newVersion, now, userId, checksum
  )

  return {
    entity_type: entityType,
    entity_id: entityId,
    version: newVersion,
    updated_at: now,
    updated_by: userId,
    checksum
  }
}

/**
 * Check if there's a conflict before saving
 */
export function checkConflict(
  entityType: string,
  entityId: string,
  clientVersion: number,
  clientData: Record<string, unknown>,
  originalData: Record<string, unknown>
): ConflictInfo | null {
  const serverVersion = getEntityVersion(entityType, entityId)

  // No conflict if entity doesn't exist yet or versions match
  if (!serverVersion || serverVersion.version === clientVersion) {
    return null
  }

  // Version mismatch - check for actual field conflicts
  const serverData = getEntityData(entityType, entityId)
  if (!serverData) {
    return null
  }

  const fieldConflicts: FieldConflict[] = []
  const allFields = new Set([
    ...Object.keys(clientData),
    ...Object.keys(serverData)
  ])

  for (const field of allFields) {
    // Skip metadata fields
    if (['id', 'created_at', 'updated_at', 'version'].includes(field)) continue

    const clientValue = clientData[field]
    const serverValue = serverData[field]
    const originalValue = originalData[field]

    // Conflict if both client and server changed from original
    if (
      !deepEqual(clientValue, originalValue) &&
      !deepEqual(serverValue, originalValue) &&
      !deepEqual(clientValue, serverValue)
    ) {
      fieldConflicts.push({
        field,
        local_value: clientValue,
        server_value: serverValue,
        original_value: originalValue
      })
    }
  }

  // If no actual field conflicts, it's just a version bump
  if (fieldConflicts.length === 0) {
    return null
  }

  return {
    entity_type: entityType,
    entity_id: entityId,
    local_version: clientVersion,
    local_updated_at: new Date().toISOString(),
    local_updated_by: null,
    server_version: serverVersion.version,
    server_updated_at: serverVersion.updated_at,
    server_updated_by: serverVersion.updated_by,
    field_conflicts: fieldConflicts
  }
}

/**
 * Get entity data from the database
 */
function getEntityData(entityType: string, entityId: string): Record<string, unknown> | null {
  const db = getDatabase()

  const tableMap: Record<string, string> = {
    topic: 'topics',
    record: 'records',
    letter: 'letters',
    mom: 'moms',
    issue: 'issues',
    credential: 'credentials',
    contact: 'contacts',
    authority: 'authorities'
  }

  const table = tableMap[entityType]
  if (!table) return null

  try {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(entityId)
    return row as Record<string, unknown> | null
  } catch {
    return null
  }
}

/**
 * Deep equality check for values
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return a === b
  if (typeof a !== typeof b) return false

  if (typeof a === 'object') {
    const aObj = a as Record<string, unknown>
    const bObj = b as Record<string, unknown>
    const aKeys = Object.keys(aObj)
    const bKeys = Object.keys(bObj)

    if (aKeys.length !== bKeys.length) return false

    return aKeys.every(key => deepEqual(aObj[key], bObj[key]))
  }

  return false
}

/**
 * Merge conflicting changes using specified strategy
 */
export function mergeConflict(
  conflict: ConflictInfo,
  clientData: Record<string, unknown>,
  strategy: MergeStrategy,
  manualResolutions?: Record<string, unknown>
): MergeResult {
  const serverData = getEntityData(conflict.entity_type, conflict.entity_id)
  if (!serverData) {
    return { success: false, error: 'Server data not found', strategy_used: strategy }
  }

  const merged = { ...serverData }
  let conflictsResolved = 0

  switch (strategy) {
    case 'keep_local':
      // Override server with all client changes
      for (const fc of conflict.field_conflicts) {
        merged[fc.field] = fc.local_value
        conflictsResolved++
      }
      break

    case 'keep_server':
      // Keep server values (merged already has server data)
      conflictsResolved = conflict.field_conflicts.length
      break

    case 'keep_newer':
      // Use timestamp to decide
      const localTime = new Date(conflict.local_updated_at).getTime()
      const serverTime = new Date(conflict.server_updated_at).getTime()

      if (localTime > serverTime) {
        for (const fc of conflict.field_conflicts) {
          merged[fc.field] = fc.local_value
          conflictsResolved++
        }
      } else {
        conflictsResolved = conflict.field_conflicts.length
      }
      break

    case 'manual':
      if (!manualResolutions) {
        return { success: false, error: 'Manual resolutions required', strategy_used: strategy }
      }

      for (const fc of conflict.field_conflicts) {
        if (fc.field in manualResolutions) {
          merged[fc.field] = manualResolutions[fc.field]
          conflictsResolved++
        }
      }

      // Check all conflicts are resolved
      if (conflictsResolved !== conflict.field_conflicts.length) {
        return {
          success: false,
          error: `Not all conflicts resolved: ${conflictsResolved}/${conflict.field_conflicts.length}`,
          strategy_used: strategy
        }
      }
      break
  }

  return {
    success: true,
    merged_data: merged,
    conflicts_resolved: conflictsResolved,
    strategy_used: strategy
  }
}

/**
 * Get recent changes for an entity type
 */
export function getRecentChanges(
  entityType?: string,
  since?: string,
  limit: number = 50
): EntityVersion[] {
  const db = getDatabase()

  let query = 'SELECT * FROM entity_versions WHERE 1=1'
  const params: unknown[] = []

  if (entityType) {
    query += ' AND entity_type = ?'
    params.push(entityType)
  }

  if (since) {
    query += ' AND updated_at > ?'
    params.push(since)
  }

  query += ' ORDER BY updated_at DESC LIMIT ?'
  params.push(limit)

  return db.prepare(query).all(...params) as EntityVersion[]
}

/**
 * Clean up old version entries
 */
export function cleanupOldVersions(daysToKeep: number = 90): number {
  const db = getDatabase()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysToKeep)

  const result = db.prepare(`
    DELETE FROM entity_versions
    WHERE updated_at < ?
  `).run(cutoff.toISOString())

  return result.changes
}

export default {
  initSyncTables,
  calculateChecksum,
  getEntityVersion,
  updateEntityVersion,
  checkConflict,
  mergeConflict,
  getRecentChanges,
  cleanupOldVersions
}
