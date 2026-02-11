import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { UserBadge } from '../auth/UserBadge'
import { ReminderBadge } from '../reminders/ReminderBadge'
import { useToast } from '../../context/ToastContext'

const pageTitles: Record<string, string> = {
  '/topics': 'Topics',
  '/letters': 'Letters',
  '/outlook': 'Outlook Integration',
  '/reminders': 'Reminders',
  '/issues': 'Open Issues',
  '/mom': 'Minutes of Meeting',
  '/handover': 'Shift Handover',
  '/attendance': 'Attendance',
  '/secure-resources': 'Secure Resources',
  '/backup': 'Backup & Restore',
  '/audit': 'Audit Log',
  '/settings': 'Settings'
}

export function Header() {
  const location = useLocation()
  const [searchQuery, setSearchQuery] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const toast = useToast()

  const handleRefreshDatabase = async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      const result = await window.electronAPI.database.refresh()
      if (result.success) {
        toast.success('Database refreshed')
        // Set flag to skip Outlook refresh on reload (prevents freeze)
        sessionStorage.setItem('skipOutlookRefresh', 'true')
        setTimeout(() => {
          window.location.reload()
        }, 300)
      } else {
        toast.error(result.error || 'Failed to refresh')
        setIsRefreshing(false)
      }
    } catch (err: any) {
      toast.error(`Refresh failed: ${err.message}`)
      setIsRefreshing(false)
    }
  }

  // Get page title based on current route
  const getPageTitle = (): string => {
    // Check for exact match first
    if (pageTitles[location.pathname]) {
      return pageTitles[location.pathname]
    }

    // Check for topic detail page
    if (location.pathname.startsWith('/topics/')) {
      return 'Topic Timeline'
    }

    return 'Dashboard'
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implement global search
    console.log('Search:', searchQuery)
  }

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
      {/* Page Title */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{getPageTitle()}</h2>
      </div>

      {/* Search and Actions */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-64 pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </form>

        {/* Refresh Database Button */}
        <button
          onClick={handleRefreshDatabase}
          disabled={isRefreshing}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          title="Refresh Database"
        >
          <svg
            className={`w-5 h-5 text-gray-600 dark:text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        {/* Reminders Badge */}
        <ReminderBadge />

        {/* Divider */}
        <div className="w-px h-8 bg-gray-200 dark:bg-gray-600" />

        {/* User Badge */}
        <UserBadge />
      </div>
    </header>
  )
}
