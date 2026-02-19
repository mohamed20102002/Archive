import React, { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { UserBadge } from '../auth/UserBadge'
import { ReminderBadge } from '../reminders/ReminderBadge'
import { UndoRedoButtons } from '../common/UndoRedoButtons'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../common/ConfirmDialog'

interface SearchResult {
  id: string
  type: 'topic' | 'record' | 'letter' | 'mom' | 'mom_action' | 'issue' | 'credential' | 'secure_reference' | 'contact' | 'authority'
  title: string
  subtitle?: string
  description?: string
  date?: string
  status?: string
  parentId?: string
  parentTitle?: string
}

interface GlobalSearchResults {
  topics: SearchResult[]
  records: SearchResult[]
  letters: SearchResult[]
  moms: SearchResult[]
  momActions: SearchResult[]
  issues: SearchResult[]
  credentials: SearchResult[]
  secureReferences: SearchResult[]
  contacts: SearchResult[]
  authorities: SearchResult[]
  totalCount: number
}

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
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
  '/settings': 'Settings',
  '/search': 'Advanced Search',
  '/calendar': 'Calendar',
  '/scheduled-emails': 'Scheduled Emails'
}

const typeIcons: Record<string, JSX.Element> = {
  topic: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
  record: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  letter: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  mom: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  mom_action: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  issue: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  credential: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>,
  secure_reference: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
  contact: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  authority: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
}

const typeLabels: Record<string, string> = {
  topic: 'Topics',
  record: 'Records',
  letter: 'Letters',
  mom: 'Minutes of Meeting',
  mom_action: 'MOM Actions',
  issue: 'Issues',
  credential: 'Credentials',
  secure_reference: 'References',
  contact: 'Contacts',
  authority: 'Authorities'
}

const typeColors: Record<string, string> = {
  topic: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  record: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  letter: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  mom: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  mom_action: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  issue: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  credential: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
  secure_reference: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  contact: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
  authority: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
}

export function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<GlobalSearchResults | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const toast = useToast()
  const confirm = useConfirm()
  const searchRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (searchQuery.trim().length < 2) {
      setSearchResults(null)
      setShowResults(false)
      return
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await window.electronAPI.search.global(searchQuery, 5)
        setSearchResults(results)
        setShowResults(true)
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery])

  const handleRefreshDatabase = async () => {
    console.log('[Header] Refresh button clicked at', new Date().toISOString())
    if (isRefreshing) return

    // Require confirmation to prevent accidental clicks
    const confirmed = await confirm({
      title: 'Refresh Database',
      message: 'This will refresh the database connection and reload the page. Continue?',
      confirmText: 'Refresh',
      danger: false
    })
    console.log('[Header] Confirm dialog result:', confirmed)
    if (!confirmed) return

    setIsRefreshing(true)
    // Log when refresh is triggered
    console.log('[Header] handleRefreshDatabase confirmed by user')
    if (window.electronAPI?.logger?.log) {
      window.electronAPI.logger.log('warn', '[Header] Database refresh confirmed by user')
    }
    try {
      const result = await window.electronAPI.database.refresh()
      if (result.success) {
        toast.success('Database refreshed')
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

  const getPageTitle = (): string => {
    if (pageTitles[location.pathname]) {
      return pageTitles[location.pathname]
    }
    if (location.pathname.startsWith('/topics/')) {
      return 'Topic Timeline'
    }
    return 'Dashboard'
  }

  const handleResultClick = (result: SearchResult) => {
    setShowResults(false)
    setSearchQuery('')

    const highlightState = {
      highlightType: result.type,
      highlightId: result.id,
      highlightParentId: result.parentId
    }

    switch (result.type) {
      case 'topic':
        navigate(`/topics/${result.id}`, { state: highlightState })
        break
      case 'record':
        if (result.parentId) {
          navigate(`/topics/${result.parentId}`, { state: highlightState })
        }
        break
      case 'letter':
        navigate('/letters', { state: highlightState })
        break
      case 'mom':
        navigate('/mom', { state: highlightState })
        break
      case 'mom_action':
        navigate('/mom', { state: { ...highlightState, highlightId: result.parentId, highlightActionId: result.id } })
        break
      case 'issue':
        navigate('/issues', { state: highlightState })
        break
      case 'credential':
      case 'secure_reference':
        navigate('/secure-resources', { state: highlightState })
        break
      case 'contact':
      case 'authority':
        navigate('/letters', { state: { ...highlightState, openContactsTab: true } })
        break
      default:
        break
    }
  }

  const getAllResults = (): SearchResult[] => {
    if (!searchResults) return []
    return [
      ...searchResults.topics,
      ...searchResults.records,
      ...searchResults.letters,
      ...searchResults.moms,
      ...searchResults.momActions,
      ...searchResults.issues,
      ...searchResults.credentials,
      ...searchResults.secureReferences,
      ...searchResults.contacts,
      ...searchResults.authorities
    ]
  }

  const groupedResults = searchResults ? {
    topics: searchResults.topics,
    records: searchResults.records,
    letters: searchResults.letters,
    moms: searchResults.moms,
    momActions: searchResults.momActions,
    issues: searchResults.issues,
    credentials: searchResults.credentials,
    secureReferences: searchResults.secureReferences,
    contacts: searchResults.contacts,
    authorities: searchResults.authorities
  } : null

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
      {/* Page Title */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{getPageTitle()}</h2>
      </div>

      {/* Search and Actions */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div ref={searchRef} className="relative">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults && setShowResults(true)}
              placeholder="Search everything..."
              className="w-72 pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            {isSearching ? (
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showResults && searchResults && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 max-h-[70vh] overflow-hidden">
              {searchResults.totalCount === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  <svg className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm">No results found for "{searchQuery}"</p>
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[calc(70vh-2rem)]">
                  <div className="p-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Found {searchResults.totalCount} result{searchResults.totalCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {groupedResults && Object.entries(groupedResults).map(([key, results]) => {
                    if (results.length === 0) return null
                    const typeKey = key === 'momActions' ? 'mom_action' :
                                   key === 'secureReferences' ? 'secure_reference' : key.slice(0, -1)
                    return (
                      <div key={key} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                        <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-700/30 flex items-center gap-2">
                          <span className={`p-1 rounded ${typeColors[typeKey]}`}>
                            {typeIcons[typeKey]}
                          </span>
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                            {typeLabels[typeKey]} ({results.length})
                          </span>
                        </div>
                        {results.map((result: SearchResult) => (
                          <button
                            key={`${result.type}-${result.id}`}
                            onClick={() => handleResultClick(result)}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-start gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {result.title}
                              </div>
                              {result.subtitle && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {result.subtitle}
                                </div>
                              )}
                              {result.parentTitle && (
                                <div className="text-xs text-primary-600 dark:text-primary-400 truncate">
                                  in {result.parentTitle}
                                </div>
                              )}
                            </div>
                            {result.status && (
                              <span className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded ${
                                result.status === 'open' || result.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                result.status === 'closed' || result.status === 'completed' ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' :
                                'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              }`}>
                                {result.status}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Undo/Redo Buttons */}
        <UndoRedoButtons />

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
