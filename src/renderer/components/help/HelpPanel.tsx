/**
 * Help Panel Component
 *
 * A comprehensive help system with searchable content, context-sensitive help,
 * and keyboard shortcut references.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'

interface HelpArticle {
  id: string
  title: string
  category: string
  content: string
  keywords: string[]
  relatedArticles?: string[]
}

interface HelpCategory {
  id: string
  title: string
  icon: React.ReactNode
  description: string
}

// Help categories
const helpCategories: HelpCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    description: 'Learn the basics of the application'
  },
  {
    id: 'topics',
    title: 'Topics & Records',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    description: 'Managing topics and records'
  },
  {
    id: 'letters',
    title: 'Letters',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    description: 'Managing correspondence'
  },
  {
    id: 'keyboard',
    title: 'Keyboard Shortcuts',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    description: 'Speed up your workflow'
  },
  {
    id: 'backup',
    title: 'Backup & Restore',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
      </svg>
    ),
    description: 'Protect your data'
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    description: 'Solve common issues'
  }
]

// Help articles content
const helpArticles: HelpArticle[] = [
  // Getting Started
  {
    id: 'welcome',
    title: 'Welcome to Project Data Archiving System',
    category: 'getting-started',
    content: `
# Welcome

The Project Data Archiving System helps you organize and manage your project documentation efficiently.

## Key Features
- **Topics**: Organize related records under topics
- **Records**: Store detailed information with attachments
- **Letters**: Track incoming and outgoing correspondence
- **MOMs**: Document meeting minutes and action items
- **Issues**: Track open issues and their resolutions

## Getting Help
- Press **Ctrl+/** or **?** to view keyboard shortcuts
- Press **Ctrl+K** to open the command palette
- Use the search feature to find anything quickly
    `,
    keywords: ['welcome', 'start', 'introduction', 'overview', 'features']
  },
  {
    id: 'navigation',
    title: 'Navigating the Application',
    category: 'getting-started',
    content: `
# Navigation

## Sidebar
The sidebar on the left provides quick access to all main sections.

## Command Palette (Ctrl+K)
Press **Ctrl+K** to open the command palette for quick navigation and actions.

## Go-To Navigation
Press **G** followed by a key to quickly navigate:
- **G + D**: Dashboard
- **G + T**: Topics
- **G + L**: Letters
- **G + M**: MOMs
- **G + I**: Issues
- **G + S**: Search
- **G + C**: Calendar
    `,
    keywords: ['navigation', 'sidebar', 'command palette', 'go-to', 'shortcuts']
  },
  // Topics & Records
  {
    id: 'creating-topics',
    title: 'Creating and Managing Topics',
    category: 'topics',
    content: `
# Topics

Topics are the primary way to organize your project data.

## Creating a Topic
1. Click **New Topic** or press **N** on the Topics page
2. Enter a name and optional description
3. Click **Save**

## Managing Records
Each topic can contain multiple records. Records store detailed information including:
- Title and content
- Date and status
- Priority level
- Attachments
- Links to emails, MOMs, and letters

## Archiving
Topics can be archived when no longer active. Archived topics are hidden by default but can be viewed using filters.
    `,
    keywords: ['topic', 'create', 'records', 'organize', 'archive']
  },
  {
    id: 'attachments',
    title: 'Working with Attachments',
    category: 'topics',
    content: `
# Attachments

## Adding Attachments
1. Open a record
2. Click **Add Attachment**
3. Select files from your computer
4. Attachments are copied to the application storage

## Supported File Types
- Documents: PDF, Word, Excel, PowerPoint
- Images: JPG, PNG, GIF
- Other: ZIP, TXT, and more

## Viewing Attachments
- Click on an attachment to preview
- Right-click for more options (download, delete)
    `,
    keywords: ['attachment', 'files', 'upload', 'documents', 'images']
  },
  // Letters
  {
    id: 'managing-letters',
    title: 'Managing Correspondence',
    category: 'letters',
    content: `
# Letters

Track all incoming and outgoing correspondence.

## Letter Types
- **Incoming**: Letters received from external parties
- **Outgoing**: Letters sent to external parties

## Key Fields
- Letter ID (auto-generated or custom)
- Subject and authority
- Dates (letter date, received date, deadline)
- Status tracking

## Response Deadlines
Set response deadlines for incoming letters. Overdue letters are highlighted automatically.

## Linking
Letters can be linked to:
- Topics and records
- MOMs
- Other letters (references)
    `,
    keywords: ['letters', 'correspondence', 'incoming', 'outgoing', 'deadline']
  },
  // Keyboard Shortcuts
  {
    id: 'shortcuts-global',
    title: 'Global Keyboard Shortcuts',
    category: 'keyboard',
    content: `
# Global Shortcuts

These shortcuts work throughout the application.

## Navigation
| Shortcut | Action |
|----------|--------|
| Ctrl+K | Open Command Palette |
| Ctrl+/ or ? | Show Keyboard Shortcuts |
| G then D | Go to Dashboard |
| G then T | Go to Topics |
| G then L | Go to Letters |
| Escape | Close dialogs |

## Actions
| Shortcut | Action |
|----------|--------|
| Ctrl+S | Save current item |
| Ctrl+N | Create new item |
| Ctrl+F | Focus search |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
    `,
    keywords: ['shortcuts', 'keyboard', 'hotkeys', 'commands', 'navigation']
  },
  {
    id: 'shortcuts-lists',
    title: 'List Navigation Shortcuts',
    category: 'keyboard',
    content: `
# List Shortcuts

Use these shortcuts when viewing lists.

## Navigation
| Shortcut | Action |
|----------|--------|
| J or Down | Move to next item |
| K or Up | Move to previous item |
| Enter | Open selected item |
| E | Edit selected item |
| Delete | Delete selected item |

## Selection
| Shortcut | Action |
|----------|--------|
| Space | Toggle selection |
| Ctrl+A | Select all |
| Escape | Clear selection |
    `,
    keywords: ['list', 'navigation', 'selection', 'keyboard', 'vim']
  },
  // Backup
  {
    id: 'creating-backups',
    title: 'Creating Backups',
    category: 'backup',
    content: `
# Backup

Regular backups protect your data from loss.

## Creating a Backup
1. Go to **Settings > Backup & Restore**
2. Click **Create Backup**
3. Choose a location to save the backup file
4. Wait for the backup to complete

## What's Included
- All topics, records, and their content
- Letters, MOMs, and issues
- Attachments and documents
- User preferences and settings

## Backup Schedule
Set up automatic backup reminders in Settings to ensure regular backups.
    `,
    keywords: ['backup', 'save', 'protect', 'export', 'data']
  },
  {
    id: 'restoring-backups',
    title: 'Restoring from Backup',
    category: 'backup',
    content: `
# Restore

Restore your data from a previous backup.

## Before Restoring
- Current data will be replaced
- Make a backup of current data first if needed

## Restore Process
1. Go to **Settings > Backup & Restore**
2. Click **Restore Backup**
3. Select your backup file
4. Confirm the restore operation
5. The application will restart after restore

## Verifying Restore
After restore, verify that your data is intact by checking:
- Topic and record counts
- Recent items
- Attachments
    `,
    keywords: ['restore', 'recovery', 'import', 'backup', 'data']
  },
  // Troubleshooting
  {
    id: 'common-issues',
    title: 'Common Issues',
    category: 'troubleshooting',
    content: `
# Common Issues

## Application Won't Start
1. Restart your computer
2. Check if antivirus is blocking the app
3. Reinstall the application

## Slow Performance
1. Clear temporary files
2. Optimize database (Settings > Advanced)
3. Check disk space

## Data Not Saving
1. Check disk space
2. Run database integrity check
3. Create a backup and restore

## Outlook Integration Issues
1. Verify Outlook is installed and configured
2. Check authentication settings
3. Restart both applications
    `,
    keywords: ['problem', 'issue', 'error', 'fix', 'help', 'slow', 'crash']
  },
  {
    id: 'contact-support',
    title: 'Getting Support',
    category: 'troubleshooting',
    content: `
# Support

## Self-Help Resources
- Search this help panel for answers
- Check the troubleshooting section
- Review keyboard shortcuts

## Reporting Issues
If you encounter a bug or issue:
1. Note the steps to reproduce
2. Take screenshots if helpful
3. Check the audit log for errors
4. Contact your system administrator

## Feature Requests
Feature requests and suggestions can be submitted to your administrator.
    `,
    keywords: ['support', 'help', 'contact', 'bug', 'report', 'feedback']
  }
]

interface HelpPanelProps {
  isOpen: boolean
  onClose: () => void
  initialArticle?: string
}

export function HelpPanel({ isOpen, onClose, initialArticle }: HelpPanelProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null)

  // Get context-sensitive help based on current route
  const contextCategory = useMemo(() => {
    const path = location.pathname
    if (path.includes('/topics')) return 'topics'
    if (path.includes('/letters')) return 'letters'
    if (path.includes('/backup')) return 'backup'
    if (path.includes('/settings')) return 'backup'
    return null
  }, [location.pathname])

  // Set initial article or context-sensitive content
  useEffect(() => {
    if (initialArticle) {
      const article = helpArticles.find(a => a.id === initialArticle)
      if (article) {
        setSelectedArticle(article)
        setSelectedCategory(article.category)
      }
    } else if (contextCategory && isOpen) {
      setSelectedCategory(contextCategory)
    }
  }, [initialArticle, contextCategory, isOpen])

  // Filter articles based on search and category
  const filteredArticles = useMemo(() => {
    let articles = helpArticles

    if (selectedCategory) {
      articles = articles.filter(a => a.category === selectedCategory)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      articles = articles.filter(a =>
        a.title.toLowerCase().includes(query) ||
        a.content.toLowerCase().includes(query) ||
        a.keywords.some(k => k.toLowerCase().includes(query))
      )
    }

    return articles
  }, [searchQuery, selectedCategory])

  const handleBack = useCallback(() => {
    if (selectedArticle) {
      setSelectedArticle(null)
    } else if (selectedCategory) {
      setSelectedCategory(null)
    }
  }, [selectedArticle, selectedCategory])

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedArticle) {
          setSelectedArticle(null)
        } else if (selectedCategory) {
          setSelectedCategory(null)
        } else {
          onClose()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedArticle, selectedCategory, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {(selectedArticle || selectedCategory) && (
              <button
                type="button"
                onClick={handleBack}
                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {selectedArticle?.title || (selectedCategory ? helpCategories.find(c => c.id === selectedCategory)?.title : t('help.title', 'Help'))}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        {!selectedArticle && (
          <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('help.searchPlaceholder', 'Search help articles...')}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500"
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {selectedArticle ? (
            // Article content
            <div className="p-6 prose dark:prose-invert prose-primary max-w-none">
              <div
                dangerouslySetInnerHTML={{
                  __html: selectedArticle.content
                    .replace(/^# /gm, '<h1>')
                    .replace(/^## /gm, '<h2>')
                    .replace(/^### /gm, '<h3>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\n\n/g, '</p><p>')
                    .replace(/\| /g, '<td>')
                    .replace(/ \|/g, '</td>')
                    .replace(/\|---/g, '')
                }}
              />
            </div>
          ) : selectedCategory || searchQuery ? (
            // Article list
            <div className="p-4">
              {filteredArticles.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  {t('help.noResults', 'No articles found')}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredArticles.map(article => (
                    <button
                      key={article.id}
                      type="button"
                      onClick={() => setSelectedArticle(article)}
                      className="w-full flex items-center gap-3 p-3 text-left rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {article.title}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {helpCategories.find(c => c.id === article.category)?.title}
                        </p>
                      </div>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Category grid
            <div className="p-6 grid grid-cols-2 gap-4">
              {helpCategories.map(category => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategory(category.id)}
                  className="flex flex-col items-center gap-3 p-6 text-center rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                >
                  <div className="p-3 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
                    {category.icon}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {category.title}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {category.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 flex items-center justify-between">
          <span>
            {t('help.pressEscape', 'Press Escape to close')}
          </span>
          <span>
            {t('help.version', 'v2.0.0')}
          </span>
        </div>
      </div>
    </div>,
    document.body
  )
}

/**
 * Hook to control help panel
 */
export function useHelpPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [initialArticle, setInitialArticle] = useState<string | undefined>()

  const open = useCallback((articleId?: string) => {
    setInitialArticle(articleId)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setInitialArticle(undefined)
  }, [])

  // Global keyboard shortcut for help (F1)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return {
    isOpen,
    initialArticle,
    open,
    close
  }
}

export default HelpPanel
