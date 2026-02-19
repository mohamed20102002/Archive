import { useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useUndoRedo } from '../context/UndoRedoContext'
import { notifyDataChanged } from '../utils/dataEvents'
import type { Mom, CreateMomData, UpdateMomData } from '../types'

export function useUndoableMoms() {
  const { user } = useAuth()
  const { recordOperation } = useUndoRedo()

  // Create a MOM with undo support
  const createMom = useCallback(async (
    data: CreateMomData
  ): Promise<{ success: boolean; mom?: Mom; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      const result = await window.electronAPI.moms.create(data, user.id)

      if (result.success && result.mom) {
        const mom = result.mom as Mom

        // Record the operation for undo
        recordOperation({
          operation: 'create',
          entityType: 'mom',
          entityId: mom.id,
          description: `Create MOM "${mom.title}"`,
          beforeState: null,
          afterState: {
            entityType: 'mom',
            entityId: mom.id,
            data: mom as unknown as Record<string, unknown>
          },
          userId: user.id
        })

        notifyDataChanged('mom', 'create', mom.id)
      }

      return result as { success: boolean; mom?: Mom; error?: string }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create MOM'
      return { success: false, error: message }
    }
  }, [user, recordOperation])

  // Update a MOM with undo support
  const updateMom = useCallback(async (
    id: string,
    data: UpdateMomData
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      // Capture before state
      const beforeData = await window.electronAPI.history.getEntity('mom', id)
      if (!beforeData) {
        return { success: false, error: 'MOM not found' }
      }

      const result = await window.electronAPI.moms.update(id, data, user.id)

      if (result.success) {
        // Capture after state
        const afterData = await window.electronAPI.history.getEntity('mom', id)

        // Get title for description
        const title = (afterData?.title || beforeData.title || 'Unknown') as string

        // Record the operation for undo
        recordOperation({
          operation: 'update',
          entityType: 'mom',
          entityId: id,
          description: `Update MOM "${title}"`,
          beforeState: {
            entityType: 'mom',
            entityId: id,
            data: beforeData
          },
          afterState: afterData ? {
            entityType: 'mom',
            entityId: id,
            data: afterData
          } : null,
          userId: user.id
        })

        notifyDataChanged('mom', 'update', id)
      }

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update MOM'
      return { success: false, error: message }
    }
  }, [user, recordOperation])

  // Delete a MOM with undo support
  const deleteMom = useCallback(async (
    id: string,
    title?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      // Capture before state (the full MOM before deletion)
      const beforeData = await window.electronAPI.history.getEntity('mom', id)
      if (!beforeData) {
        return { success: false, error: 'MOM not found' }
      }

      const momTitle = title || (beforeData.title as string) || 'Unknown'

      const result = await window.electronAPI.moms.delete(id, user.id)

      if (result.success) {
        // Record the operation for undo
        recordOperation({
          operation: 'delete',
          entityType: 'mom',
          entityId: id,
          description: `Delete MOM "${momTitle}"`,
          beforeState: {
            entityType: 'mom',
            entityId: id,
            data: beforeData
          },
          afterState: null,
          userId: user.id
        })

        notifyDataChanged('mom', 'delete', id)
      }

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete MOM'
      return { success: false, error: message }
    }
  }, [user, recordOperation])

  return {
    createMom,
    updateMom,
    deleteMom
  }
}
