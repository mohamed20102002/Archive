import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { notifyDataChanged, onDataTypeChanged } from '../utils/dataEvents'
import type { Topic, CreateTopicData, UpdateTopicData } from '../types'

export function useTopics() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { user } = useAuth()
  const toast = useToast()
  // Use ref to avoid toast changes triggering loadTopics recreation
  const toastRef = useRef(toast)
  toastRef.current = toast

  const loadTopics = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await window.electronAPI.topics.getAll({}) as { data: Topic[] }
      setTopics(result.data || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load topics'
      setError(message)
      toastRef.current.error('Error', message)
    } finally {
      setIsLoading(false)
    }
  }, []) // Removed toast dependency - using ref instead

  useEffect(() => {
    loadTopics()
  }, [loadTopics])

  // Listen for record changes to update topic record counts (with debounce)
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout | null = null
    let lastEventTime = 0

    const unsubscribe = onDataTypeChanged(['record', 'topic', 'all'], (event) => {
      const now = Date.now()
      console.log(`[useTopics] Data change event:`, event.type, event.action, `timeSinceLast=${now - lastEventTime}ms`)

      // Ignore events within 500ms
      if (now - lastEventTime < 500) {
        console.log(`[useTopics] Ignoring event (debounced)`)
        return
      }
      lastEventTime = now

      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        console.log(`[useTopics] Reloading topics`)
        loadTopics()
      }, 300)
    })

    return () => {
      unsubscribe()
      if (debounceTimer) clearTimeout(debounceTimer)
    }
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
        notifyDataChanged('topic', 'create', (result.topic as any)?.id)
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
        notifyDataChanged('topic', 'update', id)
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
        notifyDataChanged('topic', 'delete', id)
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
  // Use ref to avoid toast changes triggering loadTopic recreation
  const toastRef = useRef(toast)
  toastRef.current = toast

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
      toastRef.current.error('Error', message)
    } finally {
      setIsLoading(false)
    }
  }, [topicId]) // Removed toast dependency - using ref instead

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
