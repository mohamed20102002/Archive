import React, { useState, useEffect } from 'react'
import { Modal } from '../common/Modal'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../common/ConfirmDialog'
import { useSettings } from '../../context/SettingsContext'
import type { Handover } from '../../types'

interface HandoverArchiveProps {
  onClose: () => void
}

export function HandoverArchive({ onClose }: HandoverArchiveProps) {
  const { user } = useAuth()
  const { success, error } = useToast()
  const confirm = useConfirm()
  const { formatDate } = useSettings()
  const [archives, setArchives] = useState<Handover[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadArchives = async () => {
    setIsLoading(true)
    try {
      const data = await window.electronAPI.handover.getArchives()
      setArchives(data as Handover[])
    } catch (err) {
      console.error('Error loading archives:', err)
      error('Failed to load archives')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadArchives()
  }, [])

  const handleOpen = async (id: string) => {
    try {
      const result = await window.electronAPI.handover.openFile(id)
      if (!result.success) {
        error('Failed to open file', result.error)
      }
    } catch (err: any) {
      error('Failed to open file', err.message)
    }
  }

  const handleDelete = async (archive: Handover) => {
    if (!user) return

    const confirmed = await confirm({
      title: 'Delete Handover',
      message: `Are you sure you want to delete the handover for ${formatDate(archive.start_date)} - ${formatDate(archive.end_date)}?`,
      confirmText: 'Delete',
      danger: true
    })
    if (!confirmed) return

    try {
      const result = await window.electronAPI.handover.deleteArchive(archive.id, user.id)
      if (result.success) {
        success('Handover deleted')
        loadArchives()
      } else {
        error('Failed to delete handover', result.error)
      }
    } catch (err: any) {
      error('Failed to delete handover', err.message)
    }
  }

  return (
    <Modal title="Handover Archives" onClose={onClose} size="lg">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
        </div>
      ) : archives.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">No archives found</h3>
          <p className="text-gray-500 dark:text-gray-400">Export a handover to create your first archive</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {archives.map((archive) => (
            <div key={archive.id} className="card p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    {formatDate(archive.start_date, 'short')} - {formatDate(archive.end_date)}
                  </h4>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    <span>{archive.record_count} records</span>
                    <span className="mx-2">|</span>
                    <span>Created {formatDate(archive.created_at, 'withTime')}</span>
                    {archive.creator_name && (
                      <>
                        <span className="mx-2">|</span>
                        <span>by {archive.creator_name}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpen(archive.id)}
                    className="p-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
                    title="Open file"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(archive)}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
