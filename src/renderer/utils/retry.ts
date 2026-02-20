/**
 * Retry utility for handling transient failures
 */

export interface RetryOptions {
  maxAttempts?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
  retryCondition?: (error: unknown) => boolean
  onRetry?: (attempt: number, error: unknown) => void
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryCondition: () => true,
  onRetry: () => {}
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Execute a function with retry logic
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options }
  let lastError: unknown

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Check if we should retry
      if (attempt >= config.maxAttempts || !config.retryCondition(error)) {
        throw error
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
        config.maxDelayMs
      )

      // Notify about retry
      config.onRetry(attempt, error)

      // Wait before next attempt
      await sleep(delay)
    }
  }

  throw lastError
}

/**
 * Create a retryable version of a function
 */
export function createRetryable<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return ((...args: Parameters<T>) => retry(() => fn(...args), options)) as T
}

/**
 * Retry conditions for common scenarios
 */
export const retryConditions = {
  // Retry on network errors
  networkError: (error: unknown): boolean => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('econnrefused') ||
        message.includes('econnreset') ||
        message.includes('enotfound')
      )
    }
    return false
  },

  // Retry on file system errors (busy file, etc.)
  fileSystemError: (error: unknown): boolean => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      return (
        message.includes('ebusy') ||
        message.includes('eacces') ||
        message.includes('eperm') ||
        message.includes('locked')
      )
    }
    return false
  },

  // Retry on Outlook COM errors
  outlookError: (error: unknown): boolean => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      return (
        message.includes('outlook') ||
        message.includes('com') ||
        message.includes('mapi') ||
        message.includes('rpc')
      )
    }
    return false
  },

  // Retry on database errors (busy, locked)
  databaseError: (error: unknown): boolean => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      return (
        message.includes('sqlite_busy') ||
        message.includes('database is locked') ||
        message.includes('busy')
      )
    }
    return false
  },

  // Combine multiple conditions
  any: (...conditions: ((error: unknown) => boolean)[]): (error: unknown) => boolean => {
    return (error: unknown) => conditions.some(condition => condition(error))
  }
}

/**
 * Pre-configured retry presets
 */
export const retryPresets = {
  // For Outlook operations
  outlook: {
    maxAttempts: 3,
    initialDelayMs: 2000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryCondition: retryConditions.outlookError
  },

  // For file operations
  fileSystem: {
    maxAttempts: 3,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    retryCondition: retryConditions.fileSystemError
  },

  // For database operations
  database: {
    maxAttempts: 5,
    initialDelayMs: 100,
    maxDelayMs: 2000,
    backoffMultiplier: 2,
    retryCondition: retryConditions.databaseError
  },

  // For network/API operations
  network: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryCondition: retryConditions.networkError
  }
} as const

/**
 * Hook for tracking retry state in components
 */
export function useRetryState() {
  const [isRetrying, setIsRetrying] = React.useState(false)
  const [retryCount, setRetryCount] = React.useState(0)
  const [lastError, setLastError] = React.useState<Error | null>(null)

  const executeWithRetry = async <T,>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> => {
    setIsRetrying(true)
    setRetryCount(0)
    setLastError(null)

    try {
      return await retry(fn, {
        ...options,
        onRetry: (attempt, error) => {
          setRetryCount(attempt)
          if (error instanceof Error) {
            setLastError(error)
          }
          options.onRetry?.(attempt, error)
        }
      })
    } finally {
      setIsRetrying(false)
    }
  }

  const reset = () => {
    setIsRetrying(false)
    setRetryCount(0)
    setLastError(null)
  }

  return {
    isRetrying,
    retryCount,
    lastError,
    executeWithRetry,
    reset
  }
}

// Import React for the hook
import React from 'react'
