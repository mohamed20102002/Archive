import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useBackupProgress } from '../../hooks/useBackupProgress'
import { BackupSection } from './BackupSection'
import { RestoreSection } from './RestoreSection'
import { RestoreComparisonModal } from './RestoreComparisonModal'
import { BackupProgressOverlay } from './BackupProgressOverlay'
import type { BackupInfo, BackupComparison } from '../../types'

export function BackupRestore() {
  const { user } = useAuth()
  const toast = useToast()
  const { progress, clearProgress } = useBackupProgress()

  const [isOperationInProgress, setIsOperationInProgress] = useState(false)
  const [comparisonData, setComparisonData] = useState<{ comparison: BackupComparison; zipPath: string } | null>(null)

  // Show progress overlay when an operation is active
  const showProgress = progress && progress.phase !== 'complete' && progress.phase !== 'error'
  // Show completed/error state briefly
  const showResult = progress && (progress.phase === 'complete' || progress.phase === 'error')

  const handleCreateBackup = async (includeEmails: boolean) => {
    if (!user) return
    setIsOperationInProgress(true)
    clearProgress()

    try {
      const result = await window.electronAPI.backup.create(user.id, user.username, user.display_name, includeEmails)

      if (result.success) {
        toast.success('Backup created successfully')
      } else if (result.error !== 'Backup canceled') {
        toast.error(result.error || 'Backup failed')
      }
    } catch (err: any) {
      toast.error(`Backup failed: ${err.message}`)
    } finally {
      setIsOperationInProgress(false)
      // Clear progress after a short delay to show completion
      setTimeout(clearProgress, 2000)
    }
  }

  const handleSelectFile = async () => {
    if (!user) return

    try {
      const selectResult = await window.electronAPI.backup.selectFile()
      if (!selectResult.success || !selectResult.filePath) return

      const zipPath = selectResult.filePath

      // Analyze
      const analyzeResult = await window.electronAPI.backup.analyze(zipPath) as { success: boolean; info?: BackupInfo; error?: string }
      if (!analyzeResult.success || !analyzeResult.info) {
        toast.error(analyzeResult.error || 'Failed to analyze backup file')
        return
      }

      // Compare
      const comparison = await window.electronAPI.backup.compare(
        analyzeResult.info,
        user.id,
        user.username,
        user.display_name
      ) as BackupComparison

      setComparisonData({ comparison, zipPath })
    } catch (err: any) {
      toast.error(`Failed to analyze backup: ${err.message}`)
    }
  }

  const handleConfirmRestore = async () => {
    if (!user || !comparisonData) return

    setComparisonData(null)
    setIsOperationInProgress(true)
    clearProgress()

    try {
      const result = await window.electronAPI.backup.restore(
        comparisonData.zipPath,
        user.id,
        user.username,
        user.display_name
      )

      if (result.success) {
        // Reload the entire app so all components pick up the restored data
        setTimeout(() => {
          window.location.reload()
        }, 1500)
        return
      } else {
        toast.error(result.error || 'Restore failed')
      }
    } catch (err: any) {
      toast.error(`Restore failed: ${err.message}`)
    } finally {
      setIsOperationInProgress(false)
      setTimeout(clearProgress, 2000)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Page description */}
      <div className="mb-8">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Create backups of your data or restore from a previously saved backup file.
          Secure resources (credentials, key files) are never included in backups.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BackupSection
          onCreateBackup={handleCreateBackup}
          isOperationInProgress={isOperationInProgress}
        />
        <RestoreSection
          onSelectFile={handleSelectFile}
          isOperationInProgress={isOperationInProgress}
        />
      </div>

      {/* Comparison modal */}
      {comparisonData && (
        <RestoreComparisonModal
          comparison={comparisonData.comparison}
          onConfirm={handleConfirmRestore}
          onCancel={() => setComparisonData(null)}
        />
      )}

      {/* Progress overlay */}
      {(showProgress || showResult) && progress && (
        <BackupProgressOverlay progress={progress} />
      )}
    </div>
  )
}
