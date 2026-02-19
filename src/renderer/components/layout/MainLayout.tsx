import React, { useState, useEffect, useCallback } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { FloatingConsole } from '../common/FloatingConsole'
import { OutlookBrowser } from '../outlook/OutlookBrowser'
import { Dashboard } from '../dashboard/Dashboard'
import { TopicList } from '../topics/TopicList'
import { LetterList } from '../letters/LetterList'
import { MOMList } from '../mom/MOMList'
import { OpenIssues } from '../issues/OpenIssues'
import { ReminderList } from '../reminders/ReminderList'
import { ShiftHandover } from '../handover/ShiftHandover'
import { AttendancePage } from '../attendance/AttendancePage'
import { CalendarView } from '../calendar/CalendarView'
import { AdvancedSearchPage } from '../search/AdvancedSearchPage'
import { SecureResources } from '../secure-resources/SecureResources'
import { AuditLog } from '../audit/AuditLog'
import { BackupRestore } from '../backup/BackupRestore'
import { Settings } from '../settings/Settings'
import { ScheduledEmails } from '../scheduled-emails/ScheduledEmails'
import { useBackupProgress } from '../../hooks/useBackupProgress'
import { BackupProgressOverlay } from '../backup/BackupProgressOverlay'
import { useSettings } from '../../context/SettingsContext'

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

const keepAliveRoutes: { path: string; Component: React.ComponentType }[] = [
  { path: '/dashboard', Component: Dashboard },
  { path: '/topics', Component: TopicList },
  { path: '/issues', Component: OpenIssues },
  { path: '/reminders', Component: ReminderList },
  { path: '/mom', Component: MOMList },
  { path: '/letters', Component: LetterList },
  { path: '/handover', Component: ShiftHandover },
  { path: '/secure-resources', Component: SecureResources },
  { path: '/attendance', Component: AttendancePage },
  { path: '/calendar', Component: CalendarView },
  { path: '/search', Component: AdvancedSearchPage },
  { path: '/scheduled-emails', Component: ScheduledEmails },
  { path: '/audit', Component: AuditLog },
  { path: '/backup', Component: BackupRestore },
  { path: '/settings', Component: Settings },
]

const keepAlivePaths = new Set(keepAliveRoutes.map(r => r.path))

export function MainLayout() {
  const location = useLocation()
  const currentPath = location.pathname
  const isOutlookRoute = currentPath === '/outlook'
  const isKeepAliveRoute = keepAlivePaths.has(currentPath)

  // Global backup/restore progress overlay
  const { progress } = useBackupProgress()
  const showGlobalProgress = progress && progress.phase !== 'complete' && progress.phase !== 'error'

  // Log route changes to debug blink issue
  React.useEffect(() => {
    console.log(`[MainLayout] Route: ${currentPath}, isKeepAlive=${isKeepAliveRoute}, isOutlook=${isOutlookRoute}`)
  }, [currentPath, isKeepAliveRoute, isOutlookRoute])

  return (
    <div className="min-h-screen bg-archive-light dark:bg-gray-900 flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header - always fixed */}
        <Header />

        {/* Warning Banners */}
        <DiskSpaceWarningBanner />
        <BackupReminderBanner />

        {/* Page content - each page handles its own scroll */}
        <main className="flex-1 overflow-hidden relative">
          {/* Always render OutlookBrowser, hide when not active */}
          <div className={isOutlookRoute ? 'h-full' : 'hidden'}>
            <OutlookBrowser isActive={isOutlookRoute} />
          </div>

          {/* Keep-alive routes: always mounted, toggle visibility */}
          {keepAliveRoutes.map(({ path, Component }) => (
            <div key={path} className={currentPath === path ? 'h-full overflow-auto' : 'hidden'}>
              <Component />
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
    </div>
  )
}
