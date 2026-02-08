import React, { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useSettings } from './context/SettingsContext'
import { MainLayout } from './components/layout/MainLayout'
import { LoginForm } from './components/auth/LoginForm'
import { FirstRunSetup } from './components/auth/FirstRunSetup'
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
  return <Navigate to={settings.default_view || '/topics'} replace />
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

export function App() {
  const [isFirstRun, setIsFirstRun] = useState<boolean | null>(null)
  const [checkingFirstRun, setCheckingFirstRun] = useState(true)
  const { isAuthenticated, isLoading } = useAuth()

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
    <HashRouter>
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
          <Route path="topics" element={null} />
          <Route path="topics/:topicId" element={<Timeline />} />
          <Route path="issues" element={null} />
          <Route path="reminders" element={null} />
          <Route path="mom" element={null} />
          <Route path="letters" element={null} />
          <Route path="outlook" element={null} />
          <Route path="handover" element={null} />
          <Route path="secure-resources" element={null} />
          <Route path="attendance" element={null} />
          <Route path="audit" element={null} />
          <Route path="backup" element={null} />
          <Route path="settings" element={null} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
