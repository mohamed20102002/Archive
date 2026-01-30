import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import type { Record, CreateRecordData, UpdateRecordData } from '../types'

export function useRecords(topicId: string | undefined) {
  const [records, setRecords] = useState<Record[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { user } = useAuth()
  const toast = useToast()

  const loadRecords = useCallback(async () => {
    if (!topicId) {
      setRecords([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const data = await window.electronAPI.records.getByTopic(topicId)
      setRecords(data as Record[])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load records'
      setError(message)
      toast.error('Error', message)
    } finally {
      setIsLoading(false)
    }
  }, [topicId, toast])

  useEffect(() => {
    loadRecords()
  }, [loadRecords])

  const createRecord = useCallback(async (data: Omit<CreateRecordData, 'topic_id'>): Promise<{ success: boolean; record?: Record; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    if (!topicId) {
      return { success: false, error: 'No topic selected' }
    }

    try {
      const result = await window.electronAPI.records.create(
        { ...data, topic_id: topicId },
        user.id
      )
      if (result.success) {
        await loadRecords()
        toast.success('Record created', `"${data.title}" has been added`)
      }
      return result as { success: boolean; record?: Record; error?: string }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create record'
      toast.error('Error', message)
      return { success: false, error: message }
    }
  }, [user, topicId, loadRecords, toast])

  const updateRecord = useCallback(async (id: string, data: UpdateRecordData): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      const result = await window.electronAPI.records.update(id, data, user.id)
      if (result.success) {
        await loadRecords()
        toast.success('Record updated')
      }
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update record'
      toast.error('Error', message)
      return { success: false, error: message }
    }
  }, [user, loadRecords, toast])

  const deleteRecord = useCallback(async (id: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      const result = await window.electronAPI.records.delete(id, user.id)
      if (result.success) {
        await loadRecords()
        toast.success('Record deleted')
      }
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete record'
      toast.error('Error', message)
      return { success: false, error: message }
    }
  }, [user, loadRecords, toast])

  const searchRecords = useCallback(async (query: string): Promise<Record[]> => {
    try {
      const results = await window.electronAPI.records.search(query, topicId)
      return results as Record[]
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Search failed'
      toast.error('Error', message)
      return []
    }
  }, [topicId, toast])

  return {
    records,
    isLoading,
    error,
    refresh: loadRecords,
    createRecord,
    updateRecord,
    deleteRecord,
    searchRecords
  }
}

export function useRecord(recordId: string | undefined) {
  const [record, setRecord] = useState<Record | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const toast = useToast()

  const loadRecord = useCallback(async () => {
    if (!recordId) {
      setRecord(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const data = await window.electronAPI.records.getById(recordId)
      setRecord(data as Record | null)
      if (!data) {
        setError('Record not found')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load record'
      setError(message)
      toast.error('Error', message)
    } finally {
      setIsLoading(false)
    }
  }, [recordId, toast])

  useEffect(() => {
    loadRecord()
  }, [loadRecord])

  return {
    record,
    isLoading,
    error,
    refresh: loadRecord
  }
}
