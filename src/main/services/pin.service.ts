import { getDatabase } from '../database/connection'
import { v4 as uuid } from 'uuid'

export type PinnableEntityType = 'topic' | 'record' | 'letter' | 'mom' | 'issue'

interface Pin {
  id: string
  entity_type: PinnableEntityType
  entity_id: string
  user_id: string
  created_at: string
}

// Check if an entity is pinned by a user
export function isPinned(
  entityType: PinnableEntityType,
  entityId: string,
  userId: string
): boolean {
  const db = getDatabase()
  const result = db.prepare(`
    SELECT 1 FROM pins
    WHERE entity_type = ? AND entity_id = ? AND user_id = ?
  `).get(entityType, entityId, userId)

  return !!result
}

// Get all pinned entity IDs for a specific type and user
export function getPinnedIds(
  entityType: PinnableEntityType,
  userId: string
): string[] {
  const db = getDatabase()
  const results = db.prepare(`
    SELECT entity_id FROM pins
    WHERE entity_type = ? AND user_id = ?
    ORDER BY created_at ASC
  `).all(entityType, userId) as { entity_id: string }[]

  return results.map(r => r.entity_id)
}

// Get all pins for a user (across all entity types)
export function getAllPins(userId: string): Pin[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM pins
    WHERE user_id = ?
    ORDER BY entity_type, created_at ASC
  `).all(userId) as Pin[]
}

// Pin an entity
export function pinEntity(
  entityType: PinnableEntityType,
  entityId: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  try {
    // Check if already pinned
    if (isPinned(entityType, entityId, userId)) {
      return { success: true } // Already pinned, no-op
    }

    const id = uuid()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO pins (id, entity_type, entity_id, user_id, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, entityType, entityId, userId, now)

    return { success: true }
  } catch (error) {
    console.error('[Pin] Error pinning entity:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to pin'
    }
  }
}

// Unpin an entity
export function unpinEntity(
  entityType: PinnableEntityType,
  entityId: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  try {
    db.prepare(`
      DELETE FROM pins
      WHERE entity_type = ? AND entity_id = ? AND user_id = ?
    `).run(entityType, entityId, userId)

    return { success: true }
  } catch (error) {
    console.error('[Pin] Error unpinning entity:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unpin'
    }
  }
}

// Toggle pin status
export function togglePin(
  entityType: PinnableEntityType,
  entityId: string,
  userId: string
): { success: boolean; pinned: boolean; error?: string } {
  const currentlyPinned = isPinned(entityType, entityId, userId)

  if (currentlyPinned) {
    const result = unpinEntity(entityType, entityId, userId)
    return { ...result, pinned: false }
  } else {
    const result = pinEntity(entityType, entityId, userId)
    return { ...result, pinned: true }
  }
}

// Get pin status for multiple entities at once (batch check)
export function getPinStatuses(
  entityType: PinnableEntityType,
  entityIds: string[],
  userId: string
): Record<string, boolean> {
  if (entityIds.length === 0) return {}

  const db = getDatabase()
  const placeholders = entityIds.map(() => '?').join(',')

  const results = db.prepare(`
    SELECT entity_id FROM pins
    WHERE entity_type = ? AND user_id = ? AND entity_id IN (${placeholders})
  `).all(entityType, userId, ...entityIds) as { entity_id: string }[]

  const pinnedSet = new Set(results.map(r => r.entity_id))

  return entityIds.reduce((acc, id) => {
    acc[id] = pinnedSet.has(id)
    return acc
  }, {} as Record<string, boolean>)
}

// Clean up pins for deleted entities (called when entity is permanently deleted)
export function cleanupPins(
  entityType: PinnableEntityType,
  entityId: string
): void {
  const db = getDatabase()

  try {
    db.prepare(`
      DELETE FROM pins WHERE entity_type = ? AND entity_id = ?
    `).run(entityType, entityId)
  } catch (error) {
    console.error('[Pin] Error cleaning up pins:', error)
  }
}
