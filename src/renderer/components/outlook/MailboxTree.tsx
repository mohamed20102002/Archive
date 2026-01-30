import React, { useState } from 'react'
import type { OutlookMailbox, OutlookFolder } from '../../types'

interface MailboxTreeProps {
  mailboxes: OutlookMailbox[]
  folders: OutlookFolder[]
  selectedMailbox: OutlookMailbox | null
  selectedFolder: OutlookFolder | null
  onSelectMailbox: (mailbox: OutlookMailbox) => void
  onSelectFolder: (folder: OutlookFolder) => void
}

export function MailboxTree({
  mailboxes,
  folders,
  selectedMailbox,
  selectedFolder,
  onSelectMailbox,
  onSelectFolder
}: MailboxTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId)
    } else {
      newExpanded.add(folderId)
    }
    setExpandedFolders(newExpanded)
  }

  // Build folder tree
  const buildFolderTree = (folders: OutlookFolder[]): OutlookFolder[] => {
    // For simplicity, we'll display a flat list but indent based on path depth
    return folders
  }

  const getFolderDepth = (folder: OutlookFolder): number => {
    return (folder.path.match(/\//g) || []).length
  }

  const getFolderIcon = (folderName: string): React.ReactNode => {
    const name = folderName.toLowerCase()

    if (name.includes('inbox')) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      )
    }

    if (name.includes('sent')) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      )
    }

    if (name.includes('draft')) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      )
    }

    if (name.includes('deleted') || name.includes('trash')) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      )
    }

    if (name.includes('junk') || name.includes('spam')) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      )
    }

    if (name.includes('archive')) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      )
    }

    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 h-full overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="font-medium text-gray-900 text-sm">Mailboxes</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {mailboxes.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No mailboxes found</p>
        ) : (
          <div className="space-y-1">
            {mailboxes.map((mailbox) => (
              <div key={mailbox.id}>
                <button
                  onClick={() => onSelectMailbox(mailbox)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                    selectedMailbox?.id === mailbox.id
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <span className="truncate font-medium">{mailbox.name}</span>
                </button>

                {/* Folders */}
                {selectedMailbox?.id === mailbox.id && folders.length > 0 && (
                  <div className="ml-2 mt-1 space-y-0.5">
                    {buildFolderTree(folders).map((folder) => {
                      const depth = getFolderDepth(folder)
                      const isSelected = selectedFolder?.id === folder.id

                      return (
                        <button
                          key={folder.id}
                          onClick={() => onSelectFolder(folder)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors ${
                            isSelected
                              ? 'bg-primary-100 text-primary-700'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                          style={{ paddingLeft: `${(depth + 1) * 12}px` }}
                        >
                          <span className={isSelected ? 'text-primary-600' : 'text-gray-400'}>
                            {getFolderIcon(folder.name)}
                          </span>
                          <span className="truncate">{folder.name}</span>
                          {folder.unreadCount > 0 && (
                            <span className="ml-auto text-xs bg-primary-600 text-white px-1.5 py-0.5 rounded-full">
                              {folder.unreadCount}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
