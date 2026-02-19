import { useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useUndoRedo } from '../context/UndoRedoContext'
import { notifyDataChanged } from '../utils/dataEvents'
import type { Topic, CreateTopicData, UpdateTopicData } from '../types'

export function useUndoableTopics() {
  const { user } = useAuth()
  const { recordOperation } = useUndoRedo()

  // Create a topic with undo support
  const createTopic = useCallback(async (
    data: CreateTopicData
  ): Promise<{ success: boolean; topic?: Topic; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      const result = await window.electronAPI.topics.create(data, user.id)

      if (result.success && result.topic) {
        const topic = result.topic as Topic

        // Record the operation for undo
        recordOperation({
          operation: 'create',
          entityType: 'topic',
          entityId: topic.id,
          description: `Create topic "${topic.title}"`,
          beforeState: null,
          afterState: {
            entityType: 'topic',
            entityId: topic.id,
            data: topic as unknown as Record<string, unknown>
          },
          userId: user.id
        })

        notifyDataChanged('topic', 'create', topic.id)
      }

      return result as { success: boolean; topic?: Topic; error?: string }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create topic'
      return { success: false, error: message }
    }
  }, [user, recordOperation])

  // Update a topic with undo support
  const updateTopic = useCallback(async (
    id: string,
    data: UpdateTopicData
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      // Capture before state
      const beforeData = await window.electronAPI.history.getEntity('topic', id)
      if (!beforeData) {
        return { success: false, error: 'Topic not found' }
      }

      const result = await window.electronAPI.topics.update(id, data, user.id)

      if (result.success) {
        // Capture after state
        const afterData = await window.electronAPI.history.getEntity('topic', id)

        // Get title for description
        const title = (afterData?.title || beforeData.title || 'Unknown') as string

        // Record the operation for undo
        recordOperation({
          operation: 'update',
          entityType: 'topic',
          entityId: id,
          description: `Update topic "${title}"`,
          beforeState: {
            entityType: 'topic',
            entityId: id,
            data: beforeData
          },
          afterState: afterData ? {
            entityType: 'topic',
            entityId: id,
            data: afterData
          } : null,
          userId: user.id
        })

        notifyDataChanged('topic', 'update', id)
      }

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update topic'
      return { success: false, error: message }
    }
  }, [user, recordOperation])

  // Delete a topic with undo support
  const deleteTopic = useCallback(async (
    id: string,
    title?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      // Capture before state (the full topic before deletion)
      const beforeData = await window.electronAPI.history.getEntity('topic', id)
      if (!beforeData) {
        return { success: false, error: 'Topic not found' }
      }

      const topicTitle = title || (beforeData.title as string) || 'Unknown'

      const result = await window.electronAPI.topics.delete(id, user.id)

      if (result.success) {
        // Record the operation for undo
        recordOperation({
          operation: 'delete',
          entityType: 'topic',
          entityId: id,
          description: `Delete topic "${topicTitle}"`,
          beforeState: {
            entityType: 'topic',
            entityId: id,
            data: beforeData
          },
          afterState: null,
          userId: user.id
        })

        notifyDataChanged('topic', 'delete', id)
      }

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete topic'
      return { success: false, error: message }
    }
  }, [user, recordOperation])

  return {
    createTopic,
    updateTopic,
    deleteTopic
  }
}
