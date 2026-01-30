import { useState, useCallback } from 'react'
import { useToast } from '../context/ToastContext'
import type { OutlookMailbox, OutlookFolder, OutlookEmail } from '../types'

export function useOutlook() {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [mailboxes, setMailboxes] = useState<OutlookMailbox[]>([])
  const [error, setError] = useState<string | null>(null)

  const toast = useToast()

  const connect = useCallback(async (): Promise<boolean> => {
    setIsConnecting(true)
    setError(null)

    try {
      const result = await window.electronAPI.outlook.connect()
      if (result.success) {
        setIsConnected(true)
        toast.success('Connected to Outlook')
        return true
      } else {
        setError(result.error || 'Connection failed')
        toast.error('Connection failed', result.error)
        return false
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed'
      setError(message)
      toast.error('Connection failed', message)
      return false
    } finally {
      setIsConnecting(false)
    }
  }, [toast])

  const disconnect = useCallback(async (): Promise<void> => {
    await window.electronAPI.outlook.disconnect()
    setIsConnected(false)
    setMailboxes([])
    toast.info('Disconnected from Outlook')
  }, [toast])

  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const connected = await window.electronAPI.outlook.isConnected()
      setIsConnected(connected)
      return connected
    } catch {
      setIsConnected(false)
      return false
    }
  }, [])

  const loadMailboxes = useCallback(async (): Promise<OutlookMailbox[]> => {
    try {
      const data = await window.electronAPI.outlook.getMailboxes()
      const boxes = data as OutlookMailbox[]
      setMailboxes(boxes)
      return boxes
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load mailboxes'
      toast.error('Error', message)
      return []
    }
  }, [toast])

  const getFolders = useCallback(async (storeId: string): Promise<OutlookFolder[]> => {
    try {
      const data = await window.electronAPI.outlook.getFolders(storeId)
      return data as OutlookFolder[]
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load folders'
      toast.error('Error', message)
      return []
    }
  }, [toast])

  const getEmails = useCallback(async (folderId: string, storeId: string, limit?: number): Promise<OutlookEmail[]> => {
    try {
      const data = await window.electronAPI.outlook.getEmails(folderId, storeId, limit)
      return data as OutlookEmail[]
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load emails'
      toast.error('Error', message)
      return []
    }
  }, [toast])

  const getEmailDetails = useCallback(async (entryId: string, storeId: string): Promise<OutlookEmail | null> => {
    try {
      const data = await window.electronAPI.outlook.getEmailDetails(entryId, storeId)
      return data as OutlookEmail | null
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load email details'
      toast.error('Error', message)
      return null
    }
  }, [toast])

  return {
    isConnected,
    isConnecting,
    mailboxes,
    error,
    connect,
    disconnect,
    checkConnection,
    loadMailboxes,
    getFolders,
    getEmails,
    getEmailDetails
  }
}
