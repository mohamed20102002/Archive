import { useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useUndoRedo } from '../context/UndoRedoContext'
import { notifyDataChanged } from '../utils/dataEvents'
import type { Issue, CreateIssueData, UpdateIssueData } from '../types'

export function useUndoableIssues() {
  const { user } = useAuth()
  const { recordOperation } = useUndoRedo()

  // Create an issue with undo support
  const createIssue = useCallback(async (
    data: CreateIssueData
  ): Promise<{ success: boolean; issue?: Issue; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      const result = await window.electronAPI.issues.create(data, user.id)

      if (result.success && result.issue) {
        const issue = result.issue as Issue

        // Record the operation for undo
        recordOperation({
          operation: 'create',
          entityType: 'issue',
          entityId: issue.id,
          description: `Create issue "${issue.title}"`,
          beforeState: null,
          afterState: {
            entityType: 'issue',
            entityId: issue.id,
            data: issue as unknown as Record<string, unknown>
          },
          userId: user.id
        })

        notifyDataChanged('issue', 'create', issue.id)
      }

      return result as { success: boolean; issue?: Issue; error?: string }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create issue'
      return { success: false, error: message }
    }
  }, [user, recordOperation])

  // Update an issue with undo support
  const updateIssue = useCallback(async (
    id: string,
    data: UpdateIssueData
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      // Capture before state
      const beforeData = await window.electronAPI.history.getEntity('issue', id)
      if (!beforeData) {
        return { success: false, error: 'Issue not found' }
      }

      const result = await window.electronAPI.issues.update(id, data, user.id)

      if (result.success) {
        // Capture after state
        const afterData = await window.electronAPI.history.getEntity('issue', id)

        // Get title for description
        const title = (afterData?.title || beforeData.title || 'Unknown') as string

        // Record the operation for undo
        recordOperation({
          operation: 'update',
          entityType: 'issue',
          entityId: id,
          description: `Update issue "${title}"`,
          beforeState: {
            entityType: 'issue',
            entityId: id,
            data: beforeData
          },
          afterState: afterData ? {
            entityType: 'issue',
            entityId: id,
            data: afterData
          } : null,
          userId: user.id
        })

        notifyDataChanged('issue', 'update', id)
      }

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update issue'
      return { success: false, error: message }
    }
  }, [user, recordOperation])

  // Delete (complete) an issue with undo support
  const deleteIssue = useCallback(async (
    id: string,
    title?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      // Capture before state (the full issue before deletion/completion)
      const beforeData = await window.electronAPI.history.getEntity('issue', id)
      if (!beforeData) {
        return { success: false, error: 'Issue not found' }
      }

      const issueTitle = title || (beforeData.title as string) || 'Unknown'

      // Note: For issues, "delete" typically means closing/completing
      const result = await window.electronAPI.issues.close(id, 'Deleted via undo/redo', user.id)

      if (result.success) {
        // Record the operation for undo
        recordOperation({
          operation: 'delete',
          entityType: 'issue',
          entityId: id,
          description: `Delete issue "${issueTitle}"`,
          beforeState: {
            entityType: 'issue',
            entityId: id,
            data: beforeData
          },
          afterState: null,
          userId: user.id
        })

        notifyDataChanged('issue', 'delete', id)
      }

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete issue'
      return { success: false, error: message }
    }
  }, [user, recordOperation])

  return {
    createIssue,
    updateIssue,
    deleteIssue
  }
}
