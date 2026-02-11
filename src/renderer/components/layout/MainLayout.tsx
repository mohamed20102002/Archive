import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { FloatingConsole } from '../common/FloatingConsole'
import { OutlookBrowser } from '../outlook/OutlookBrowser'
import { TopicList } from '../topics/TopicList'
import { LetterList } from '../letters/LetterList'
import { MOMList } from '../mom/MOMList'
import { OpenIssues } from '../issues/OpenIssues'
import { ReminderList } from '../reminders/ReminderList'
import { ShiftHandover } from '../handover/ShiftHandover'
import { AttendancePage } from '../attendance/AttendancePage'
import { SecureResources } from '../secure-resources/SecureResources'
import { AuditLog } from '../audit/AuditLog'
import { BackupRestore } from '../backup/BackupRestore'
import { Settings } from '../settings/Settings'

const keepAliveRoutes: { path: string; Component: React.ComponentType }[] = [
  { path: '/topics', Component: TopicList },
  { path: '/issues', Component: OpenIssues },
  { path: '/reminders', Component: ReminderList },
  { path: '/mom', Component: MOMList },
  { path: '/letters', Component: LetterList },
  { path: '/handover', Component: ShiftHandover },
  { path: '/secure-resources', Component: SecureResources },
  { path: '/attendance', Component: AttendancePage },
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

  return (
    <div className="min-h-screen bg-archive-light dark:bg-gray-900 flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header - always fixed */}
        <Header />

        {/* Page content - each page handles its own scroll */}
        <main className="flex-1 overflow-hidden relative">
          {/* Always render OutlookBrowser, hide when not active */}
          <div className={isOutlookRoute ? 'h-full' : 'hidden'}>
            <OutlookBrowser />
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
    </div>
  )
}
