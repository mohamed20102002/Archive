import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { SettingsProvider } from './context/SettingsContext'
import { UndoRedoProvider } from './context/UndoRedoContext'
import { ConfirmProvider } from './components/common/ConfirmDialog'
import './styles/globals.css'

// === Persistent logging for debugging random window refreshes ===
// Wrapped in try-catch to prevent any logging issues from breaking the app
try {
  const startTime = Date.now()
  const sessionId = Math.random().toString(36).substring(2, 8)

  // Log to main process (persists across reloads)
  const persistentLog = (message: string) => {
    try {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      const logMessage = `[Renderer:${sessionId}] [+${elapsed}s] ${message}`
      console.log(logMessage)
      // Also write to main process logger if available
      if (window.electronAPI?.logger?.log) {
        window.electronAPI.logger.log('info', logMessage)
      }
    } catch (e) {
      // Ignore logging errors
    }
  }

  // Make persistentLog available globally for debugging
  ;(window as any).__persistentLog = persistentLog

  // Track page lifecycle events
  persistentLog('=== NEW SESSION STARTED ===')
  persistentLog('Performance: ' + JSON.stringify({
    navigationStart: performance.timeOrigin,
    navigationType: (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.type || 'unknown',
  }))
  persistentLog(`Location: ${window.location.href}`)

  // Capture beforeunload - fires before page unloads
  window.addEventListener('beforeunload', () => {
    persistentLog(`BEFOREUNLOAD event triggered!`)
  })

  // Capture pagehide - fires when page is hidden
  window.addEventListener('pagehide', (e) => {
    persistentLog(`PAGEHIDE event - persisted: ${e.persisted}`)
  })

  // Capture visibility changes
  document.addEventListener('visibilitychange', () => {
    persistentLog(`Visibility changed to: ${document.visibilityState}`)
  })

  // Monitor Vite HMR events (development mode only)
  if (import.meta.hot) {
    persistentLog('Vite HMR is active')

    import.meta.hot.on('vite:beforeFullReload', () => {
      persistentLog('VITE: beforeFullReload triggered!')
    })

    import.meta.hot.on('vite:error', (payload: any) => {
      persistentLog(`VITE: error - ${payload?.message || 'unknown'}`)
    })
  }

  persistentLog('Event listeners attached, mounting React app...')
} catch (e) {
  console.error('Error setting up persistent logging:', e)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <UndoRedoProvider>
            <SettingsProvider>
              <App />
            </SettingsProvider>
          </UndoRedoProvider>
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  </React.StrictMode>
)
