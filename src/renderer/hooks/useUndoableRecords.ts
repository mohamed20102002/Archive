import { useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useUndoRedo } from '../context/UndoRedoContext'
import { notifyDataChanged } from '../utils/dataEvents'
import type { Record, CreateRecordData, UpdateRecordData } from '../types'

export function useUndoableRecords() {
  const { user } = useAuth()
  const { recordOperation } = useUndoRedo()

  // Create a record with undo support
  const createRecord = useCallback(async (
    data: CreateRecordData
  ): Promise<{ success: boolean; record?: Record; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      const result = await window.electronAPI.records.create(data, user.id)

      if (result.success && result.record) {
        const record = result.record as Record

        // Record the operation for undo
        recordOperation({
          operation: 'create',
          entityType: 'record',
          entityId: record.id,
          description: `Create record "${record.title}"`,
          beforeState: null,
          afterState: {
            entityType: 'record',
            entityId: record.id,
            data: record as unknown as globalThis.Record<string, unknown>
          },
          userId: user.id
        })

        notifyDataChanged('record', 'create', record.id)
      }

      return result as { success: boolean; record?: Record; error?: string }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create record'
      return { success: false, error: message }
    }
  }, [user, recordOperation])

  // Update a record with undo support
  const updateRecord = useCallback(async (
    id: string,
    data: UpdateRecordData
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      // Capture before state
      const beforeData = await window.electronAPI.history.getEntity('record', id)
      if (!beforeData) {
        return { success: false, error: 'Record not found' }
      }

      const result = await window.electronAPI.records.update(id, data, user.id)

      if (result.success) {
        // Capture after state
        const afterData = await window.electronAPI.history.getEntity('record', id)

        // Get title for description
        const title = (afterData?.title || beforeData.title || 'Unknown') as string

        // Record the operation for undo
        recordOperation({
          operation: 'update',
          entityType: 'record',
          entityId: id,
          description: `Update record "${title}"`,
          beforeState: {
            entityType: 'record',
            entityId: id,
            data: beforeData
          },
          afterState: afterData ? {
            entityType: 'record',
            entityId: id,
            data: afterData
          } : null,
          userId: user.id
        })

        notifyDataChanged('record', 'update', id)
      }

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update record'
      return { success: false, error: message }
    }
  }, [user, recordOperation])

  // Delete a record with undo support
  const deleteRecord = useCallback(async (
    id: string,
    title?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      // Capture before state (the full record before deletion)
      const beforeData = await window.electronAPI.history.getEntity('record', id)
      if (!beforeData) {
        return { success: false, error: 'Record not found' }
      }

      const recordTitle = title || (beforeData.title as string) || 'Unknown'

      const result = await window.electronAPI.records.delete(id, user.id)

      if (result.success) {
        // Record the operation for undo
        recordOperation({
          operation: 'delete',
          entityType: 'record',
          entityId: id,
          description: `Delete record "${recordTitle}"`,
          beforeState: {
            entityType: 'record',
            entityId: id,
            data: beforeData
          },
          afterState: null,
          userId: user.id
        })

        notifyDataChanged('record', 'delete', id)
      }

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete record'
      return { success: false, error: message }
    }
  }, [user, recordOperation])

  return {
    createRecord,
    updateRecord,
    deleteRecord
  }
}
