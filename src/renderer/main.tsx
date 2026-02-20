import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { SettingsProvider } from './context/SettingsContext'
import { UndoRedoProvider } from './context/UndoRedoContext'
import { ConfirmProvider } from './components/common/ConfirmDialog'
import { queryClient } from './lib/queryClient'
import './styles/globals.css'

// Initialize i18n before rendering
import './i18n'

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

// Loading fallback for Suspense
function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-archive-light">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-500">Loading...</p>
      </div>
    </div>
  )
}

// Global error boundary to catch any uncaught errors
class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[GlobalErrorBoundary] Caught error:', error)
    console.error('[GlobalErrorBoundary] Component stack:', errorInfo.componentStack)

    // Log to main process
    if (window.electronAPI?.logger?.log) {
      window.electronAPI.logger.log('error', `[GlobalErrorBoundary] ${error.message}`, {
        stack: error.stack,
        componentStack: errorInfo.componentStack
      })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-8">
          <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-900">Application Error</h1>
            </div>
            <p className="text-gray-600 mb-4">
              An unexpected error occurred. Please reload the application.
            </p>
            {this.state.error && (
              <div className="bg-gray-100 rounded-lg p-4 mb-4 overflow-auto max-h-64">
                <p className="font-mono text-sm text-red-600 mb-2">{this.state.error.message}</p>
                <pre className="font-mono text-xs text-gray-600 whitespace-pre-wrap">
                  {this.state.error.stack}
                </pre>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Reload Application
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <QueryClientProvider client={queryClient}>
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
        </QueryClientProvider>
      </Suspense>
    </GlobalErrorBoundary>
  </React.StrictMode>
)
