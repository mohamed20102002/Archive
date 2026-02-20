import React, { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useSettings } from './context/SettingsContext'
import { SearchHighlightProvider } from './context/SearchHighlightContext'
import { MainLayout } from './components/layout/MainLayout'
import { LoginForm } from './components/auth/LoginForm'
import { FirstRunSetup } from './components/auth/FirstRunSetup'
import { SessionTimeoutWarning } from './components/auth/SessionTimeoutWarning'
import { TopicList } from './components/topics/TopicList'
import { Timeline } from './components/records/Timeline'
import { LetterList } from './components/letters/LetterList'
import { ReminderList } from './components/reminders/ReminderList'
import { ShiftHandover } from './components/handover/ShiftHandover'
import { AuditLog } from './components/audit/AuditLog'
import { OpenIssues } from './components/issues/OpenIssues'
import { SecureResources } from './components/secure-resources/SecureResources'
import { AttendancePage } from './components/attendance/AttendancePage'
import { Settings } from './components/settings/Settings'
import { MOMList } from './components/mom/MOMList'

function DefaultRedirect() {
  const { settings, loading } = useSettings()

  if (loading) return null
  return <Navigate to={settings.default_view || '/dashboard'} replace />
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-archive-light">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// Global counter for tracking app mounts (helps debug refresh issues)
let appMountCount = 0

export function App() {
  const [isFirstRun, setIsFirstRun] = useState<boolean | null>(null)
  const [checkingFirstRun, setCheckingFirstRun] = useState(true)
  const { isAuthenticated, isLoading } = useAuth()

  // Track app mounts and add global error handlers
  useEffect(() => {
    appMountCount++
    console.log(`[App] Mounted (count: ${appMountCount}) at ${new Date().toISOString()}`)

    // Global error handler for uncaught errors
    const handleError = (event: ErrorEvent) => {
      console.error('[App] Uncaught error:', event.error, event.message, event.filename, event.lineno)
    }

    // Global handler for unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('[App] Unhandled promise rejection:', event.reason)
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      console.log(`[App] Unmounting (count: ${appMountCount}) at ${new Date().toISOString()}`)
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  useEffect(() => {
    async function checkFirstRun() {
      try {
        const firstRun = await window.electronAPI.app.isFirstRun()
        setIsFirstRun(firstRun)
      } catch (error) {
        console.error('Error checking first run:', error)
        setIsFirstRun(false)
      } finally {
        setCheckingFirstRun(false)
      }
    }

    checkFirstRun()
  }, [])

  // Fix: Global focus restoration for Electron window focus issues
  // This ensures inputs become clickable after window regains focus
  useEffect(() => {
    const handleWindowFocus = () => {
      // Small delay to let Electron's focus handling complete
      setTimeout(() => {
        // If no element is focused, focus the document body to restore click handling
        if (!document.activeElement || document.activeElement === document.body) {
          document.body.focus()
        }
      }, 50)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleWindowFocus()
      }
    }

    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  if (checkingFirstRun || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-archive-light">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">Initializing...</p>
        </div>
      </div>
    )
  }

  // First run setup
  if (isFirstRun) {
    return (
      <FirstRunSetup
        onComplete={() => {
          setIsFirstRun(false)
        }}
      />
    )
  }

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SearchHighlightProvider>
      {/* Session timeout warning overlay */}
      <SessionTimeoutWarning />
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <LoginForm />
            )
          }
        />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DefaultRedirect />} />
          {/* Keep-alive routes: rendered in MainLayout, toggled by CSS */}
          <Route path="dashboard" element={null} />
          <Route path="topics" element={null} />
          <Route path="topics/:topicId" element={<Timeline />} />
          <Route path="issues" element={null} />
          <Route path="reminders" element={null} />
          <Route path="mentions" element={null} />
          <Route path="mom" element={null} />
          <Route path="letters" element={null} />
          <Route path="outlook" element={null} />
          <Route path="handover" element={null} />
          <Route path="secure-resources" element={null} />
          <Route path="attendance" element={null} />
          <Route path="calendar" element={null} />
          <Route path="search" element={null} />
          <Route path="scheduled-emails" element={null} />
          <Route path="audit" element={null} />
          <Route path="backup" element={null} />
          <Route path="settings" element={null} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </SearchHighlightProvider>
    </HashRouter>
  )
}
