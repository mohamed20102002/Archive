import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import type { Topic, CreateTopicData, UpdateTopicData } from '../types'

export function useTopics() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { user } = useAuth()
  const toast = useToast()

  const loadTopics = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await window.electronAPI.topics.getAll()
      setTopics(data as Topic[])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load topics'
      setError(message)
      toast.error('Error', message)
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadTopics()
  }, [loadTopics])

  const createTopic = useCallback(async (data: CreateTopicData): Promise<{ success: boolean; topic?: Topic; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      const result = await window.electronAPI.topics.create(data, user.id)
      if (result.success) {
        await loadTopics()
        toast.success('Topic created', `"${data.title}" has been created`)
      }
      return result as { success: boolean; topic?: Topic; error?: string }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create topic'
      toast.error('Error', message)
      return { success: false, error: message }
    }
  }, [user, loadTopics, toast])

  const updateTopic = useCallback(async (id: string, data: UpdateTopicData): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      const result = await window.electronAPI.topics.update(id, data, user.id)
      if (result.success) {
        await loadTopics()
        toast.success('Topic updated')
      }
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update topic'
      toast.error('Error', message)
      return { success: false, error: message }
    }
  }, [user, loadTopics, toast])

  const deleteTopic = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      const result = await window.electronAPI.topics.delete(id, user.id)
      if (result.success) {
        await loadTopics()
        toast.success('Topic deleted')
      }
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete topic'
      toast.error('Error', message)
      return { success: false, error: message }
    }
  }, [user, loadTopics, toast])

  const searchTopics = useCallback(async (query: string): Promise<Topic[]> => {
    try {
      const results = await window.electronAPI.topics.search(query)
      return results as Topic[]
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Search failed'
      toast.error('Error', message)
      return []
    }
  }, [toast])

  const getTopicById = useCallback(async (id: string): Promise<Topic | null> => {
    try {
      const topic = await window.electronAPI.topics.getById(id)
      return topic as Topic | null
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load topic'
      toast.error('Error', message)
      return null
    }
  }, [toast])

  return {
    topics,
    isLoading,
    error,
    refresh: loadTopics,
    createTopic,
    updateTopic,
    deleteTopic,
    searchTopics,
    getTopicById
  }
}

export function useTopic(topicId: string | undefined) {
  const [topic, setTopic] = useState<Topic | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const toast = useToast()

  const loadTopic = useCallback(async () => {
    if (!topicId) {
      setTopic(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const data = await window.electronAPI.topics.getById(topicId)
      setTopic(data as Topic | null)
      if (!data) {
        setError('Topic not found')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load topic'
      setError(message)
      toast.error('Error', message)
    } finally {
      setIsLoading(false)
    }
  }, [topicId, toast])

  useEffect(() => {
    loadTopic()
  }, [loadTopic])

  return {
    topic,
    isLoading,
    error,
    refresh: loadTopic
  }
}
