import { useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useUndoRedo } from '../context/UndoRedoContext'
import { notifyDataChanged } from '../utils/dataEvents'
import type { Letter, CreateLetterData, UpdateLetterData } from '../types'

export function useUndoableLetters() {
  const { user } = useAuth()
  const { recordOperation } = useUndoRedo()

  // Create a letter with undo support
  const createLetter = useCallback(async (
    data: CreateLetterData
  ): Promise<{ success: boolean; letter?: Letter; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      const result = await window.electronAPI.letters.create(data, user.id)

      if (result.success && result.letter) {
        const letter = result.letter as Letter

        // Record the operation for undo
        recordOperation({
          operation: 'create',
          entityType: 'letter',
          entityId: letter.id,
          description: `Create letter "${letter.subject}"`,
          beforeState: null,
          afterState: {
            entityType: 'letter',
            entityId: letter.id,
            data: letter as unknown as Record<string, unknown>
          },
          userId: user.id
        })

        notifyDataChanged('letter', 'create', letter.id)
      }

      return result as { success: boolean; letter?: Letter; error?: string }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create letter'
      return { success: false, error: message }
    }
  }, [user, recordOperation])

  // Update a letter with undo support
  const updateLetter = useCallback(async (
    id: string,
    data: UpdateLetterData
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      // Capture before state
      const beforeData = await window.electronAPI.history.getEntity('letter', id)
      if (!beforeData) {
        return { success: false, error: 'Letter not found' }
      }

      const result = await window.electronAPI.letters.update(id, data, user.id)

      if (result.success) {
        // Capture after state
        const afterData = await window.electronAPI.history.getEntity('letter', id)

        // Get subject for description
        const subject = (afterData?.subject || beforeData.subject || 'Unknown') as string

        // Record the operation for undo
        recordOperation({
          operation: 'update',
          entityType: 'letter',
          entityId: id,
          description: `Update letter "${subject}"`,
          beforeState: {
            entityType: 'letter',
            entityId: id,
            data: beforeData
          },
          afterState: afterData ? {
            entityType: 'letter',
            entityId: id,
            data: afterData
          } : null,
          userId: user.id
        })

        notifyDataChanged('letter', 'update', id)
      }

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update letter'
      return { success: false, error: message }
    }
  }, [user, recordOperation])

  // Delete a letter with undo support
  const deleteLetter = useCallback(async (
    id: string,
    subject?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      // Capture before state (the full letter before deletion)
      const beforeData = await window.electronAPI.history.getEntity('letter', id)
      if (!beforeData) {
        return { success: false, error: 'Letter not found' }
      }

      const letterSubject = subject || (beforeData.subject as string) || 'Unknown'

      const result = await window.electronAPI.letters.delete(id, user.id)

      if (result.success) {
        // Record the operation for undo
        recordOperation({
          operation: 'delete',
          entityType: 'letter',
          entityId: id,
          description: `Delete letter "${letterSubject}"`,
          beforeState: {
            entityType: 'letter',
            entityId: id,
            data: beforeData
          },
          afterState: null,
          userId: user.id
        })

        notifyDataChanged('letter', 'delete', id)
      }

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete letter'
      return { success: false, error: message }
    }
  }, [user, recordOperation])

  return {
    createLetter,
    updateLetter,
    deleteLetter
  }
}
