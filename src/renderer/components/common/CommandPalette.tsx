/**
 * Command Palette Component (Ctrl+K)
 *
 * A universal command palette for quick navigation and actions.
 * Supports keyboard navigation and fuzzy search.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'

type CommandCategory = 'navigation' | 'action' | 'recent' | 'search'

interface Command {
  id: string
  title: string
  subtitle?: string
  category: CommandCategory
  icon?: React.ReactNode
  shortcut?: string
  action: () => void | Promise<void>
  keywords?: string[]
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

// Icons for different command types
const icons = {
  navigation: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  action: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  search: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  recent: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  topic: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  letter: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  mom: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  issue: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  ),
  settings: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

const categoryLabels: Record<CommandCategory, string> = {
  navigation: 'Navigation',
  action: 'Actions',
  recent: 'Recent',
  search: 'Search Results'
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [searchResults, setSearchResults] = useState<Command[]>([])
  const [recentItems, setRecentItems] = useState<Command[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Navigation commands
  const navigationCommands: Command[] = useMemo(() => [
    {
      id: 'nav-dashboard',
      title: t('nav.dashboard', 'Dashboard'),
      category: 'navigation',
      icon: icons.navigation,
      shortcut: 'G D',
      action: () => navigate('/'),
      keywords: ['home', 'main', 'overview']
    },
    {
      id: 'nav-topics',
      title: t('nav.topics', 'Topics'),
      category: 'navigation',
      icon: icons.topic,
      shortcut: 'G T',
      action: () => navigate('/topics'),
      keywords: ['projects', 'folders']
    },
    {
      id: 'nav-letters',
      title: t('nav.letters', 'Letters'),
      category: 'navigation',
      icon: icons.letter,
      shortcut: 'G L',
      action: () => navigate('/letters'),
      keywords: ['correspondence', 'mail']
    },
    {
      id: 'nav-moms',
      title: t('nav.moms', 'Minutes of Meeting'),
      category: 'navigation',
      icon: icons.mom,
      shortcut: 'G M',
      action: () => navigate('/mom'),
      keywords: ['meetings', 'minutes', 'notes']
    },
    {
      id: 'nav-issues',
      title: t('nav.issues', 'Open Issues'),
      category: 'navigation',
      icon: icons.issue,
      shortcut: 'G I',
      action: () => navigate('/issues'),
      keywords: ['problems', 'tasks', 'todos']
    },
    {
      id: 'nav-search',
      title: t('nav.search', 'Advanced Search'),
      category: 'navigation',
      icon: icons.search,
      shortcut: 'G S',
      action: () => navigate('/search'),
      keywords: ['find', 'query']
    },
    {
      id: 'nav-calendar',
      title: t('nav.calendar', 'Calendar'),
      category: 'navigation',
      icon: icons.navigation,
      action: () => navigate('/calendar'),
      keywords: ['schedule', 'events', 'dates']
    },
    {
      id: 'nav-attendance',
      title: t('nav.attendance', 'Attendance'),
      category: 'navigation',
      icon: icons.navigation,
      action: () => navigate('/attendance'),
      keywords: ['presence', 'leave', 'vacation']
    },
    {
      id: 'nav-settings',
      title: t('nav.settings', 'Settings'),
      category: 'navigation',
      icon: icons.settings,
      shortcut: 'G ,',
      action: () => navigate('/settings'),
      keywords: ['preferences', 'config', 'options']
    },
    {
      id: 'nav-backup',
      title: t('nav.backup', 'Backup & Restore'),
      category: 'navigation',
      icon: icons.navigation,
      action: () => navigate('/backup'),
      keywords: ['save', 'restore', 'export']
    }
  ], [navigate, t])

  // Action commands
  const actionCommands: Command[] = useMemo(() => [
    {
      id: 'action-new-topic',
      title: t('topics.create', 'Create New Topic'),
      category: 'action',
      icon: icons.action,
      action: () => {
        navigate('/topics')
        // Trigger new topic modal via custom event
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('command:newTopic'))
        }, 100)
      },
      keywords: ['add', 'new', 'create', 'topic']
    },
    {
      id: 'action-new-letter',
      title: t('letters.create', 'Create New Letter'),
      category: 'action',
      icon: icons.action,
      action: () => {
        navigate('/letters')
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('command:newLetter'))
        }, 100)
      },
      keywords: ['add', 'new', 'create', 'letter']
    },
    {
      id: 'action-new-mom',
      title: t('moms.create', 'Create New MOM'),
      category: 'action',
      icon: icons.action,
      action: () => {
        navigate('/mom')
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('command:newMom'))
        }, 100)
      },
      keywords: ['add', 'new', 'create', 'meeting', 'minutes']
    },
    {
      id: 'action-new-issue',
      title: t('issues.create', 'Create New Issue'),
      category: 'action',
      icon: icons.action,
      action: () => {
        navigate('/issues')
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('command:newIssue'))
        }, 100)
      },
      keywords: ['add', 'new', 'create', 'issue', 'problem']
    },
    {
      id: 'action-toggle-theme',
      title: t('settings.toggleTheme', 'Toggle Dark Mode'),
      category: 'action',
      icon: icons.action,
      action: () => {
        document.documentElement.classList.toggle('dark')
        const isDark = document.documentElement.classList.contains('dark')
        localStorage.setItem('theme', isDark ? 'dark' : 'light')
      },
      keywords: ['dark', 'light', 'theme', 'mode']
    }
  ], [navigate, t])

  // Load recent items
  useEffect(() => {
    if (!user?.id || !isOpen) return

    loadRecentItems()
  }, [user?.id, isOpen])

  async function loadRecentItems() {
    if (!user?.id) return

    try {
      // Get recent views from local storage
      const recentViews = JSON.parse(localStorage.getItem(`recent_views_${user.id}`) || '[]')
      const items: Command[] = recentViews.slice(0, 5).map((item: any) => ({
        id: `recent-${item.type}-${item.id}`,
        title: item.title,
        subtitle: item.type,
        category: 'recent' as CommandCategory,
        icon: icons[item.type as keyof typeof icons] || icons.navigation,
        action: () => {
          if (item.type === 'topic') {
            navigate(`/topics/${item.id}`)
          } else if (item.type === 'letter') {
            navigate('/letters', { state: { highlightId: item.id } })
          } else if (item.type === 'mom') {
            navigate('/mom', { state: { highlightId: item.id } })
          } else if (item.type === 'issue') {
            navigate('/issues', { state: { highlightId: item.id } })
          }
        }
      }))

      setRecentItems(items)
    } catch (error) {
      console.error('Error loading recent items:', error)
    }
  }

  // Search for items
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([])
      return
    }

    const searchTimer = setTimeout(async () => {
      try {
        const results = await window.electronAPI.search.global(query, 5)
        const commands: Command[] = (results as any).topics?.slice(0, 3).map((item: any) => ({
          id: `search-topic-${item.id}`,
          title: item.title,
          subtitle: 'Topic',
          category: 'search' as CommandCategory,
          icon: icons.topic,
          action: () => navigate(`/topics/${item.id}`)
        })) || []

        // Add letters
        const letters = (results as any).letters?.slice(0, 2).map((item: any) => ({
          id: `search-letter-${item.id}`,
          title: item.title,
          subtitle: 'Letter',
          category: 'search' as CommandCategory,
          icon: icons.letter,
          action: () => navigate('/letters', { state: { highlightId: item.id } })
        })) || []

        setSearchResults([...commands, ...letters])
      } catch (error) {
        console.error('Error searching:', error)
      }
    }, 200)

    return () => clearTimeout(searchTimer)
  }, [query, navigate])

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    const allCommands = [...navigationCommands, ...actionCommands]

    if (!query.trim()) {
      return [...recentItems, ...allCommands]
    }

    const lowerQuery = query.toLowerCase()

    const filtered = allCommands.filter(cmd => {
      const titleMatch = cmd.title.toLowerCase().includes(lowerQuery)
      const keywordMatch = cmd.keywords?.some(k => k.toLowerCase().includes(lowerQuery))
      return titleMatch || keywordMatch
    })

    return [...searchResults, ...filtered]
  }, [query, navigationCommands, actionCommands, recentItems, searchResults])

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<CommandCategory, Command[]> = {
      recent: [],
      search: [],
      navigation: [],
      action: []
    }

    filteredCommands.forEach(cmd => {
      groups[cmd.category].push(cmd)
    })

    return groups
  }, [filteredCommands])

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredCommands[selectedIndex]) {
        executeCommand(filteredCommands[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }, [filteredCommands, selectedIndex, onClose])

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`)
      selectedElement?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const executeCommand = async (command: Command) => {
    onClose()
    await command.action()
  }

  if (!isOpen) return null

  let commandIndex = 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="relative w-full max-w-xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center px-4 border-b border-gray-200 dark:border-gray-700">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder={t('commandPalette.placeholder', 'Type a command or search...')}
            className="flex-1 px-3 py-4 text-sm bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none"
          />
          <kbd className="hidden sm:inline-block px-2 py-1 text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 rounded">
            ESC
          </kbd>
        </div>

        {/* Commands List */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
              {t('commandPalette.noResults', 'No results found')}
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, commands]) => {
              if (commands.length === 0) return null

              return (
                <div key={category}>
                  <div className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800/50">
                    {t(`commandPalette.${category}`, categoryLabels[category as CommandCategory])}
                  </div>
                  <ul>
                    {commands.map((command) => {
                      const index = commandIndex++
                      const isSelected = index === selectedIndex

                      return (
                        <li
                          key={command.id}
                          data-index={index}
                          onClick={() => executeCommand(command)}
                          className={`
                            flex items-center gap-3 px-4 py-3 cursor-pointer
                            ${isSelected
                              ? 'bg-primary-50 dark:bg-primary-900/20'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }
                          `}
                        >
                          <span className={`text-gray-400 ${isSelected ? 'text-primary-600 dark:text-primary-400' : ''}`}>
                            {command.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isSelected ? 'text-primary-900 dark:text-primary-100' : 'text-gray-900 dark:text-gray-100'}`}>
                              {command.title}
                            </p>
                            {command.subtitle && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {command.subtitle}
                              </p>
                            )}
                          </div>
                          {command.shortcut && (
                            <kbd className="hidden sm:inline-block px-2 py-0.5 text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 rounded">
                              {command.shortcut}
                            </kbd>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 text-xs text-gray-400 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">↓</kbd>
              {t('commandPalette.toNavigate', 'to navigate')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">↵</kbd>
              {t('commandPalette.toSelect', 'to select')}
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Ctrl</kbd>
            <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">K</kbd>
            {t('commandPalette.toToggle', 'to toggle')}
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Hook to manage Command Palette state
 */
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K to open
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev)
  }
}

export default CommandPalette
