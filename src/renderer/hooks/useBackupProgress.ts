import { useState, useEffect, useCallback } from 'react'
import { BackupProgress } from '../types'

export function useBackupProgress() {
  const [progress, setProgress] = useState<BackupProgress | null>(null)

  useEffect(() => {
    window.electronAPI.backup.onProgress((data: unknown) => {
      setProgress(data as BackupProgress)
    })

    return () => {
      window.electronAPI.backup.offProgress()
    }
  }, [])

  const clearProgress = useCallback(() => {
    setProgress(null)
  }, [])

  return { progress, clearProgress }
}
