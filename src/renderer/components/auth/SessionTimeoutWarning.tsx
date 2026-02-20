import React, { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'

export function SessionTimeoutWarning() {
  const {
    sessionTimeoutWarning,
    sessionRemainingSeconds,
    extendSession,
    dismissTimeoutWarning,
    logout
  } = useAuth()

  const [displaySeconds, setDisplaySeconds] = useState(sessionRemainingSeconds)

  // Update display countdown every second when warning is shown
  useEffect(() => {
    if (!sessionTimeoutWarning) return

    setDisplaySeconds(sessionRemainingSeconds)

    const interval = setInterval(() => {
      setDisplaySeconds(prev => Math.max(0, prev - 1))
    }, 1000)

    return () => clearInterval(interval)
  }, [sessionTimeoutWarning, sessionRemainingSeconds])

  if (!sessionTimeoutWarning) return null

  const minutes = Math.floor(displaySeconds / 60)
  const seconds = displaySeconds % 60
  const timeString = minutes > 0
    ? `${minutes}:${seconds.toString().padStart(2, '0')}`
    : `${seconds}s`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Warning header */}
        <div className="bg-amber-500 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-600 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Session Timeout Warning</h2>
              <p className="text-sm text-amber-100">Your session will expire soon</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              {timeString}
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              You will be logged out due to inactivity
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={extendSession}
              className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
            >
              Stay Logged In
            </button>
            <button
              onClick={dismissTimeoutWarning}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
            >
              Dismiss
            </button>
          </div>

          <button
            onClick={logout}
            className="w-full mt-3 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            Log out now
          </button>
        </div>
      </div>
    </div>
  )
}

export default SessionTimeoutWarning
