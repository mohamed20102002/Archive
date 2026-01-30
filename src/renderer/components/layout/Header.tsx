import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { UserBadge } from '../auth/UserBadge'
import { ReminderBadge } from '../reminders/ReminderBadge'

const pageTitles: Record<string, string> = {
  '/topics': 'Topics',
  '/letters': 'Letters',
  '/outlook': 'Outlook Integration',
  '/reminders': 'Reminders',
  '/issues': 'Open Issues',
  '/handover': 'Shift Handover',
  '/secure-resources': 'Secure Resources',
  '/audit': 'Audit Log'
}

export function Header() {
  const location = useLocation()
  const [searchQuery, setSearchQuery] = useState('')

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
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* Page Title */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">{getPageTitle()}</h2>
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
            className="w-64 pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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

        {/* Reminders Badge */}
        <ReminderBadge />

        {/* Divider */}
        <div className="w-px h-8 bg-gray-200" />

        {/* User Badge */}
        <UserBadge />
      </div>
    </header>
  )
}
