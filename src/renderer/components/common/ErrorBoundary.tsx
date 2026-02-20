import React, { Component, ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  level?: 'page' | 'component' | 'critical'
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })

    // Log error
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)

    // Log to main process if available
    if (window.electronAPI?.logger?.log) {
      window.electronAPI.logger.log('error', `[ErrorBoundary] ${error.message}`, {
        stack: error.stack,
        componentStack: errorInfo.componentStack
      })
    }

    // Call custom error handler
    this.props.onError?.(error, errorInfo)
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          level={this.props.level || 'component'}
          onRetry={this.handleRetry}
          onReload={this.handleReload}
        />
      )
    }

    return this.props.children
  }
}

// Error fallback component
interface ErrorFallbackProps {
  error: Error | null
  errorInfo: ErrorInfo | null
  level: 'page' | 'component' | 'critical'
  onRetry?: () => void
  onReload?: () => void
}

export function ErrorFallback({ error, errorInfo, level, onRetry, onReload }: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = React.useState(false)

  const containerClasses = {
    critical: 'min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900',
    page: 'min-h-[50vh] flex items-center justify-center p-6',
    component: 'p-4'
  }

  const cardClasses = {
    critical: 'max-w-lg w-full bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8',
    page: 'max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6',
    component: 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4'
  }

  return (
    <div className={containerClasses[level]}>
      <div className={cardClasses[level]}>
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${level === 'critical' ? 'bg-red-100 dark:bg-red-900/50' : 'bg-red-100 dark:bg-red-800/50'}`}>
            <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {level === 'critical' ? 'Application Error' : level === 'page' ? 'Page Error' : 'Something went wrong'}
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {level === 'critical'
                ? 'A critical error has occurred. Please reload the application.'
                : 'An error occurred while rendering this content.'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1"
            >
              <svg className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {showDetails ? 'Hide details' : 'Show details'}
            </button>

            {showDetails && (
              <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded-lg overflow-auto max-h-48">
                <p className="text-xs font-mono text-red-600 dark:text-red-400 whitespace-pre-wrap">
                  {error.message}
                </p>
                {error.stack && (
                  <pre className="mt-2 text-xs font-mono text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {error.stack}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex gap-3">
          {onRetry && level !== 'critical' && (
            <button
              onClick={onRetry}
              className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
            >
              Try Again
            </button>
          )}
          {onReload && (
            <button
              onClick={onReload}
              className={`${level === 'critical' ? 'flex-1' : ''} px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors`}
            >
              Reload Application
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  level: 'page' | 'component' | 'critical' = 'component'
): React.FC<P> {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary level={level}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    )
  }
}

export default ErrorBoundary
