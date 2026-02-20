import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'

interface MentionsBadgeProps {
  className?: string
}

export function MentionsBadge({ className = '' }: MentionsBadgeProps) {
  const { user } = useAuth()
  const [count, setCount] = useState(0)

  const loadCount = useCallback(async () => {
    if (!user?.id) return
    try {
      const result = await window.electronAPI.mentions.getUnacknowledgedCount(user.id)
      setCount(result)
    } catch (error) {
      console.error('Error loading mention count:', error)
    }
  }, [user?.id])

  useEffect(() => {
    loadCount()

    // Refresh every 30 seconds
    const interval = setInterval(loadCount, 30000)

    // Listen for data changes
    const handleDataChanged = () => loadCount()
    window.addEventListener('mention-data-changed', handleDataChanged)

    return () => {
      clearInterval(interval)
      window.removeEventListener('mention-data-changed', handleDataChanged)
    }
  }, [loadCount])

  if (count === 0) return null

  return (
    <span className={`flex items-center justify-center min-w-5 h-5 px-1 text-xs font-medium rounded-full bg-blue-500 text-white ${className}`}>
      {count > 99 ? '99+' : count}
    </span>
  )
}

// Export helper to trigger refresh
export function notifyMentionDataChanged(): void {
  window.dispatchEvent(new CustomEvent('mention-data-changed'))
}
