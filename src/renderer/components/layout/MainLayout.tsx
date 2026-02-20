import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { FloatingConsole } from '../common/FloatingConsole'
import { SuspenseFallback } from '../common/Skeleton'
import { ErrorBoundary } from '../common/ErrorBoundary'
import { useBackupProgress } from '../../hooks/useBackupProgress'
import { BackupProgressOverlay } from '../backup/BackupProgressOverlay'
import { useSettings } from '../../context/SettingsContext'
import { CommandPalette, useCommandPalette } from '../common/CommandPalette'
import { KeyboardShortcutsOverlay, useKeyboardShortcutsOverlay, GoToIndicator } from '../common/KeyboardShortcuts'
import { useGoToNavigation } from '../../hooks/useKeyboardNavigation'
import { Breadcrumbs } from '../common/Breadcrumbs'
import { SkipLinks } from '../accessibility/SkipLinks'

// Lazy loaded components for code splitting
const OutlookBrowser = lazy(() => import('../outlook/OutlookBrowser').then(m => ({ default: m.OutlookBrowser })))
const Dashboard = lazy(() => import('../dashboard/Dashboard').then(m => ({ default: m.Dashboard })))
const TopicList = lazy(() => import('../topics/TopicList').then(m => ({ default: m.TopicList })))
const LetterList = lazy(() => import('../letters/LetterList').then(m => ({ default: m.LetterList })))
const MOMList = lazy(() => import('../mom/MOMList').then(m => ({ default: m.MOMList })))
const OpenIssues = lazy(() => import('../issues/OpenIssues').then(m => ({ default: m.OpenIssues })))
const ReminderList = lazy(() => import('../reminders/ReminderList').then(m => ({ default: m.ReminderList })))
const ShiftHandover = lazy(() => import('../handover/ShiftHandover').then(m => ({ default: m.ShiftHandover })))
const AttendancePage = lazy(() => import('../attendance/AttendancePage').then(m => ({ default: m.AttendancePage })))
const CalendarView = lazy(() => import('../calendar/CalendarView').then(m => ({ default: m.CalendarView })))
const AdvancedSearchPage = lazy(() => import('../search/AdvancedSearchPage').then(m => ({ default: m.AdvancedSearchPage })))
const SecureResources = lazy(() => import('../secure-resources/SecureResources').then(m => ({ default: m.SecureResources })))
const AuditLog = lazy(() => import('../audit/AuditLog').then(m => ({ default: m.AuditLog })))
const BackupRestore = lazy(() => import('../backup/BackupRestore').then(m => ({ default: m.BackupRestore })))
const Settings = lazy(() => import('../settings/Settings').then(m => ({ default: m.Settings })))
const ScheduledEmails = lazy(() => import('../scheduled-emails/ScheduledEmails').then(m => ({ default: m.ScheduledEmails })))
const MentionsPage = lazy(() => import('../mentions/MentionsPage').then(m => ({ default: m.MentionsPage })))

// Backup Reminder Banner Component
function BackupReminderBanner() {
  const { settings, formatDate } = useSettings()
  const navigate = useNavigate()
  const [reminder, setReminder] = useState<{
    shouldRemind: boolean
    daysSinceBackup: number | null
    lastBackupDate: string | null
  } | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const checkReminder = useCallback(async () => {
    if (settings.backup_reminder_days <= 0) {
      setReminder(null)
      return
    }
    try {
      const result = await window.electronAPI.backup.checkReminder(settings.backup_reminder_days)
      setReminder(result)
    } catch (err) {
      console.error('Failed to check backup reminder:', err)
    }
  }, [settings.backup_reminder_days])

  useEffect(() => {
    checkReminder()
    // Re-check every hour
    const interval = setInterval(checkReminder, 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [checkReminder])

  // Reset dismissed state when reminder changes
  useEffect(() => {
    setDismissed(false)
  }, [reminder?.shouldRemind])

  if (!reminder?.shouldRemind || dismissed) {
    return null
  }

  const getMessage = () => {
    if (reminder.daysSinceBackup === null) {
      return 'You have never created a backup. Create one now to protect your data.'
    }
    return `It's been ${reminder.daysSinceBackup} days since your last backup (${formatDate(reminder.lastBackupDate)}). Consider creating a new backup.`
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-amber-100 dark:bg-amber-800/50 rounded-lg">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <span className="font-medium">Backup Reminder:</span> {getMessage()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/backup')}
            className="px-3 py-1.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
          >
            Create Backup
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-800/50 rounded-lg transition-colors"
            title="Dismiss for now"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// Disk Space Warning Banner Component
function DiskSpaceWarningBanner() {
  const [diskSpace, setDiskSpace] = useState<{
    available: number
    total: number
    percentUsed: number
    isLow: boolean
    drive: string
  } | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const checkDiskSpace = async () => {
      try {
        const result = await window.electronAPI.dashboard.getDiskSpace()
        setDiskSpace(result)
      } catch (err) {
        console.error('Failed to check disk space:', err)
      }
    }

    checkDiskSpace()
    // Re-check every 10 minutes
    const interval = setInterval(checkDiskSpace, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (!diskSpace?.isLow || dismissed) {
    return null
  }

  const availableGB = (diskSpace.available / (1024 * 1024 * 1024)).toFixed(2)

  return (
    <div className="bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800 px-4 py-2.5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-red-100 dark:bg-red-800/50 rounded-lg">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-sm text-red-800 dark:text-red-300">
            <span className="font-medium">Low Disk Space:</span> Only {availableGB} GB available on drive {diskSpace.drive}. Free up space to avoid data loss.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 hover:bg-red-100 dark:hover:bg-red-800/50 rounded-lg transition-colors"
          title="Dismiss for now"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

const keepAliveRoutes: { path: string; Component: React.LazyExoticComponent<React.ComponentType<any>>; fallbackType: 'page' | 'list' | 'dashboard' }[] = [
  { path: '/dashboard', Component: Dashboard, fallbackType: 'dashboard' },
  { path: '/topics', Component: TopicList, fallbackType: 'list' },
  { path: '/issues', Component: OpenIssues, fallbackType: 'list' },
  { path: '/reminders', Component: ReminderList, fallbackType: 'list' },
  { path: '/mom', Component: MOMList, fallbackType: 'list' },
  { path: '/letters', Component: LetterList, fallbackType: 'list' },
  { path: '/handover', Component: ShiftHandover, fallbackType: 'page' },
  { path: '/secure-resources', Component: SecureResources, fallbackType: 'list' },
  { path: '/attendance', Component: AttendancePage, fallbackType: 'page' },
  { path: '/calendar', Component: CalendarView, fallbackType: 'page' },
  { path: '/search', Component: AdvancedSearchPage, fallbackType: 'page' },
  { path: '/scheduled-emails', Component: ScheduledEmails, fallbackType: 'list' },
  { path: '/mentions', Component: MentionsPage, fallbackType: 'list' },
  { path: '/audit', Component: AuditLog, fallbackType: 'list' },
  { path: '/backup', Component: BackupRestore, fallbackType: 'page' },
  { path: '/settings', Component: Settings, fallbackType: 'page' },
]

const keepAlivePaths = new Set(keepAliveRoutes.map(r => r.path))

export function MainLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const currentPath = location.pathname
  const isOutlookRoute = currentPath === '/outlook'
  const isKeepAliveRoute = keepAlivePaths.has(currentPath)

  // Global backup/restore progress overlay
  const { progress } = useBackupProgress()
  const showGlobalProgress = progress && progress.phase !== 'complete' && progress.phase !== 'error'

  // Command palette and keyboard shortcuts
  const commandPalette = useCommandPalette()
  const shortcutsOverlay = useKeyboardShortcutsOverlay()
  const { pendingGo } = useGoToNavigation(navigate)

  // Log route changes to debug blink issue
  React.useEffect(() => {
    console.log(`[MainLayout] Route: ${currentPath}, isKeepAlive=${isKeepAliveRoute}, isOutlook=${isOutlookRoute}`)
  }, [currentPath, isKeepAliveRoute, isOutlookRoute])

  return (
    <div className="min-h-screen bg-archive-light dark:bg-gray-900 flex">
      {/* Skip Links for Keyboard Navigation */}
      <SkipLinks />

      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header - always fixed */}
        <Header />

        {/* Warning Banners */}
        <DiskSpaceWarningBanner />
        <BackupReminderBanner />

        {/* Breadcrumbs - show on detail pages */}
        {currentPath.includes('/topics/') && (
          <div className="px-6 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
            <Breadcrumbs />
          </div>
        )}

        {/* Page content - each page handles its own scroll */}
        <main id="main-content" className="flex-1 overflow-hidden relative" role="main" tabIndex={-1}>
          {/* Modal Portal Container - modals render here to only blur main content */}
          <div id="modal-root" className="absolute inset-0 z-[100] pointer-events-none" />

          {/* Always render OutlookBrowser, hide when not active */}
          <div className={isOutlookRoute ? 'h-full' : 'hidden'}>
            <Suspense fallback={<SuspenseFallback type="page" />}>
              <OutlookBrowser isActive={isOutlookRoute} />
            </Suspense>
          </div>

          {/* Keep-alive routes: always mounted, toggle visibility */}
          {keepAliveRoutes.map(({ path, Component, fallbackType }) => (
            <div key={path} className={currentPath === path ? 'h-full overflow-auto' : 'hidden'}>
              <ErrorBoundary level="page">
                <Suspense fallback={<SuspenseFallback type={fallbackType} />}>
                  <Component />
                </Suspense>
              </ErrorBoundary>
            </div>
          ))}

          {/* Non-keep-alive routes (e.g. /topics/:topicId) via Outlet */}
          {!isOutlookRoute && !isKeepAliveRoute && (
            <div className="h-full overflow-auto">
              <div className="p-6">
                <Outlet />
              </div>
            </div>
          )}

          {/* Developer Credit Footer */}
          <div className="absolute bottom-0 right-0 px-4 py-2">
            <p className="text-[10px] text-gray-400 dark:text-gray-600">
              Developed by Mohamed Darwish
            </p>
          </div>
        </main>
      </div>

      {/* Floating Console - Admin only */}
      <FloatingConsole />

      {/* Global Backup/Restore Progress Overlay - blocks entire UI during operations */}
      {showGlobalProgress && progress && (
        <BackupProgressOverlay progress={progress} />
      )}

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={commandPalette.isOpen}
        onClose={commandPalette.close}
      />

      {/* Keyboard Shortcuts Overlay (Ctrl+/ or ?) */}
      <KeyboardShortcutsOverlay
        isOpen={shortcutsOverlay.isOpen}
        onClose={shortcutsOverlay.close}
      />

      {/* Go-to mode indicator */}
      <GoToIndicator active={pendingGo} />
    </div>
  )
}
