import React, { useState, useEffect, useCallback } from 'react'

interface ScheduledEmailBadgeProps {
  className?: string
}

export function ScheduledEmailBadge({ className = '' }: ScheduledEmailBadgeProps) {
  const [counts, setCounts] = useState({ pending: 0, overdue: 0, total: 0 })

  const loadCounts = useCallback(async () => {
    try {
      // Generate instances for today first
      await window.electronAPI.scheduledEmails.generateInstances(
        new Date().toISOString().split('T')[0]
      )
      // Then get counts
      const result = await window.electronAPI.scheduledEmails.getPendingCounts()
      setCounts(result)
    } catch (error) {
      console.error('Error loading scheduled email counts:', error)
    }
  }, [])

  useEffect(() => {
    loadCounts()

    // Refresh every minute
    const interval = setInterval(loadCounts, 60000)

    // Listen for data changes
    const handleDataChanged = () => loadCounts()
    window.addEventListener('scheduled-email-data-changed', handleDataChanged)

    return () => {
      clearInterval(interval)
      window.removeEventListener('scheduled-email-data-changed', handleDataChanged)
    }
  }, [loadCounts])

  if (counts.total === 0) return null

  return (
    <span className={`flex items-center justify-center min-w-5 h-5 px-1 text-xs font-medium rounded-full ${
      counts.overdue > 0
        ? 'bg-red-500 text-white'
        : 'bg-orange-500 text-white'
    } ${className}`}>
      {counts.total}
    </span>
  )
}

// Export helper to trigger refresh
export function notifyScheduledEmailDataChanged(): void {
  window.dispatchEvent(new CustomEvent('scheduled-email-data-changed'))
}
