import React, { useState, useEffect } from 'react'
import { MailboxTree } from './MailboxTree'
import { EmailList } from './EmailList'
import { EmailPreview } from './EmailPreview'
import { useToast } from '../../context/ToastContext'
import type { OutlookMailbox, OutlookFolder, OutlookEmail } from '../../types'

// Keys for localStorage persistence
const STORAGE_KEYS = {
  selectedMailboxId: 'outlook_selected_mailbox_id',
  selectedFolderId: 'outlook_selected_folder_id'
}

export function OutlookBrowser() {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [mailboxes, setMailboxes] = useState<OutlookMailbox[]>([])
  const [folders, setFolders] = useState<OutlookFolder[]>([])
  const [emails, setEmails] = useState<OutlookEmail[]>([])
  const [selectedMailbox, setSelectedMailbox] = useState<OutlookMailbox | null>(null)
  const [selectedFolder, setSelectedFolder] = useState<OutlookFolder | null>(null)
  const [selectedEmail, setSelectedEmail] = useState<OutlookEmail | null>(null)
  const [isLoadingEmails, setIsLoadingEmails] = useState(false)
  const [isLoadingEmailDetails, setIsLoadingEmailDetails] = useState(false)
  const [archivedEmailIds, setArchivedEmailIds] = useState<Set<string>>(new Set())
  const [isRestoring, setIsRestoring] = useState(false)

  const { success, error, warning } = useToast()

  // Load archived email IDs
  const loadArchivedEmailIds = async () => {
    try {
      const ids = await window.electronAPI.emails.getArchivedIds()
      setArchivedEmailIds(new Set(ids))
    } catch (err) {
      console.error('Error loading archived email IDs:', err)
    }
  }

  // Restore state on mount
  useEffect(() => {
    const initializeAndRestore = async () => {
      const connected = await checkConnection()
      loadArchivedEmailIds()

      // Check if we should skip Outlook refresh (set by database refresh)
      const skipRefresh = sessionStorage.getItem('skipOutlookRefresh')
      if (skipRefresh) {
        sessionStorage.removeItem('skipOutlookRefresh')
        // Still restore UI state from localStorage but don't fetch new data
        const savedMailboxId = localStorage.getItem(STORAGE_KEYS.selectedMailboxId)
        const savedFolderId = localStorage.getItem(STORAGE_KEYS.selectedFolderId)
        // Keep existing state, user can manually refresh if needed
        console.log('Skipping Outlook refresh after database refresh')
        return
      }

      if (connected) {
        setIsRestoring(true)
        try {
          // Load mailboxes first
          const mailboxData = await window.electronAPI.outlook.getMailboxes()
          const loadedMailboxes = mailboxData as OutlookMailbox[]
          setMailboxes(loadedMailboxes)

          // Try to restore selected mailbox
          const savedMailboxId = localStorage.getItem(STORAGE_KEYS.selectedMailboxId)
          if (savedMailboxId) {
            const savedMailbox = loadedMailboxes.find(m => m.id === savedMailboxId)
            if (savedMailbox) {
              setSelectedMailbox(savedMailbox)

              // Load folders for this mailbox
              const folderData = await window.electronAPI.outlook.getFolders(savedMailbox.id)
              const loadedFolders = folderData as OutlookFolder[]
              setFolders(loadedFolders)

              // Try to restore selected folder
              const savedFolderId = localStorage.getItem(STORAGE_KEYS.selectedFolderId)
              if (savedFolderId) {
                const savedFolder = loadedFolders.find(f => f.id === savedFolderId)
                if (savedFolder) {
                  setSelectedFolder(savedFolder)

                  // Load emails for this folder
                  setIsLoadingEmails(true)
                  try {
                    const emailData = await window.electronAPI.outlook.getEmails(savedFolder.id, savedFolder.storeId, 50)
                    setEmails(emailData as OutlookEmail[])
                  } catch (err) {
                    console.error('Error loading emails during restore:', err)
                  } finally {
                    setIsLoadingEmails(false)
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error('Error restoring Outlook state:', err)
        } finally {
          setIsRestoring(false)
        }
      }
    }

    initializeAndRestore()
  }, [])

  const checkConnection = async (): Promise<boolean> => {
    try {
      const connected = await window.electronAPI.outlook.isConnected()
      setIsConnected(connected)
      return connected
    } catch (err) {
      console.error('Error checking Outlook connection:', err)
      return false
    }
  }

  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      const result = await window.electronAPI.outlook.connect()
      if (result.success) {
        setIsConnected(true)
        success('Connected to Outlook', 'You can now browse your emails')
        // Load mailboxes
        const data = await window.electronAPI.outlook.getMailboxes()
        setMailboxes(data as OutlookMailbox[])
      } else {
        error('Connection failed', result.error || 'Could not connect to Outlook')
      }
    } catch (err: any) {
      error('Connection failed', err.message || 'Could not connect to Outlook')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    await window.electronAPI.outlook.disconnect()
    setIsConnected(false)
    setMailboxes([])
    setFolders([])
    setEmails([])
    setSelectedMailbox(null)
    setSelectedFolder(null)
    setSelectedEmail(null)
    // Clear saved state
    localStorage.removeItem(STORAGE_KEYS.selectedMailboxId)
    localStorage.removeItem(STORAGE_KEYS.selectedFolderId)
    success('Disconnected', 'Outlook connection closed')
  }

  const [isRefreshingOutlook, setIsRefreshingOutlook] = useState(false)

  const handleRefreshOutlook = async () => {
    if (isRefreshingOutlook) return
    setIsRefreshingOutlook(true)
    try {
      // Clear cache to force fresh fetch
      await window.electronAPI.outlook.clearCache()

      // Reload current data
      const mailboxData = await window.electronAPI.outlook.getMailboxes()
      const loadedMailboxes = mailboxData as OutlookMailbox[]
      setMailboxes(loadedMailboxes)

      if (selectedMailbox) {
        const folderData = await window.electronAPI.outlook.getFolders(selectedMailbox.id)
        setFolders(folderData as OutlookFolder[])

        if (selectedFolder) {
          setIsLoadingEmails(true)
          const emailData = await window.electronAPI.outlook.getEmails(selectedFolder.id, selectedFolder.storeId, 50)
          setEmails(emailData as OutlookEmail[])
          setIsLoadingEmails(false)
        }
      }

      loadArchivedEmailIds()
      success('Outlook refreshed', 'Email data updated')
    } catch (err: any) {
      error('Refresh failed', err.message)
    } finally {
      setIsRefreshingOutlook(false)
    }
  }

  const handleSelectMailbox = async (mailbox: OutlookMailbox) => {
    setSelectedMailbox(mailbox)
    setSelectedFolder(null)
    setSelectedEmail(null)
    setEmails([])

    // Save to localStorage
    localStorage.setItem(STORAGE_KEYS.selectedMailboxId, mailbox.id)
    localStorage.removeItem(STORAGE_KEYS.selectedFolderId)

    try {
      const data = await window.electronAPI.outlook.getFolders(mailbox.id)
      setFolders(data as OutlookFolder[])
    } catch (err: any) {
      error('Failed to load folders', err.message)
    }
  }

  const handleSelectFolder = async (folder: OutlookFolder) => {
    setSelectedFolder(folder)
    setSelectedEmail(null)
    setIsLoadingEmails(true)

    // Save to localStorage
    localStorage.setItem(STORAGE_KEYS.selectedFolderId, folder.id)

    try {
      const data = await window.electronAPI.outlook.getEmails(folder.id, folder.storeId, 50)
      setEmails(data as OutlookEmail[])
    } catch (err: any) {
      console.error('Error in handleSelectFolder:', err)
      error('Failed to load emails', err.message)
    } finally {
      setIsLoadingEmails(false)
    }
  }

  const handleSelectEmail = async (email: OutlookEmail) => {
    setIsLoadingEmailDetails(true)
    // Set basic email info immediately for better UX
    setSelectedEmail(email)

    try {
      const details = await window.electronAPI.outlook.getEmailDetails(email.entryId, email.storeId)
      setSelectedEmail(details as OutlookEmail)
    } catch (err: any) {
      console.error('Error loading email details:', err)
      error('Failed to load email details', err.message)
    } finally {
      setIsLoadingEmailDetails(false)
    }
  }

  // Show loading while restoring state
  if (isRestoring) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Restoring your previous session...</p>
        </div>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect to Outlook</h2>
          <p className="text-gray-600 mb-6">
            Connect to Microsoft Outlook to browse and archive emails. Make sure Outlook is running on your computer.
          </p>
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="btn-primary flex items-center gap-2 mx-auto"
          >
            {isConnecting ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span>Connect to Outlook</span>
              </>
            )}
          </button>
          <p className="text-xs text-gray-400 mt-4">
            Requires Microsoft Outlook to be installed and running
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-green-600">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="8" />
            </svg>
            <span>Connected to Outlook</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshOutlook}
            disabled={isRefreshingOutlook}
            className="btn-secondary text-sm flex items-center gap-1.5"
            title="Refresh Outlook data"
          >
            <svg
              className={`w-4 h-4 ${isRefreshingOutlook ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isRefreshingOutlook ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={handleDisconnect}
            className="btn-secondary text-sm"
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Mailbox/Folder Tree */}
        <div className="w-64 flex-shrink-0">
          <MailboxTree
            mailboxes={mailboxes}
            folders={folders}
            selectedMailbox={selectedMailbox}
            selectedFolder={selectedFolder}
            onSelectMailbox={handleSelectMailbox}
            onSelectFolder={handleSelectFolder}
          />
        </div>

        {/* Email List */}
        <div className="w-80 flex-shrink-0">
          <EmailList
            emails={emails}
            selectedEmail={selectedEmail}
            isLoading={isLoadingEmails}
            archivedEmailIds={archivedEmailIds}
            onSelectEmail={handleSelectEmail}
          />
        </div>

        {/* Email Preview */}
        <div className="flex-1 min-w-0">
          <EmailPreview
            email={selectedEmail}
            selectedFolder={selectedFolder}
            isArchived={selectedEmail ? archivedEmailIds.has(selectedEmail.entryId) : false}
            isLoadingDetails={isLoadingEmailDetails}
            onArchiveSuccess={loadArchivedEmailIds}
          />
        </div>
      </div>
    </div>
  )
}
