// In-memory log storage for the app console
interface LogEntry {
  timestamp: string
  level: 'log' | 'info' | 'warn' | 'error'
  message: string
  data?: unknown
}

const MAX_LOGS = 1000
const logs: LogEntry[] = []

// Store original console methods
const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console)
}

function formatArgs(args: unknown[]): string {
  return args.map(arg => {
    if (typeof arg === 'string') return arg
    if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack || ''}`
    try {
      return JSON.stringify(arg, null, 2)
    } catch {
      return String(arg)
    }
  }).join(' ')
}

export function addLog(level: LogEntry['level'], args: unknown[]): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: formatArgs(args)
  }

  logs.push(entry)

  // Keep only the last MAX_LOGS entries
  if (logs.length > MAX_LOGS) {
    logs.shift()
  }
}

// Override console methods to capture logs
export function initializeLogger(): void {
  console.log = (...args: unknown[]) => {
    addLog('log', args)
    originalConsole.log(...args)
  }

  console.info = (...args: unknown[]) => {
    addLog('info', args)
    originalConsole.info(...args)
  }

  console.warn = (...args: unknown[]) => {
    addLog('warn', args)
    originalConsole.warn(...args)
  }

  console.error = (...args: unknown[]) => {
    addLog('error', args)
    originalConsole.error(...args)
  }

  // Capture uncaught exceptions
  process.on('uncaughtException', (error) => {
    addLog('error', [`[Uncaught Exception] ${error.name}: ${error.message}`, error.stack])
    originalConsole.error('Uncaught Exception:', error)
  })

  // Capture unhandled promise rejections
  process.on('unhandledRejection', (reason) => {
    addLog('error', [`[Unhandled Rejection]`, reason])
    originalConsole.error('Unhandled Rejection:', reason)
  })

  console.log('[Logger] Console logger initialized')
}

export function getLogs(filter?: { level?: LogEntry['level']; limit?: number }): LogEntry[] {
  let result = [...logs]

  if (filter?.level) {
    result = result.filter(log => log.level === filter.level)
  }

  if (filter?.limit) {
    result = result.slice(-filter.limit)
  }

  return result
}

export function clearLogs(): void {
  logs.length = 0
  console.log('[Logger] Logs cleared')
}

export function getLogStats(): { total: number; errors: number; warnings: number } {
  return {
    total: logs.length,
    errors: logs.filter(l => l.level === 'error').length,
    warnings: logs.filter(l => l.level === 'warn').length
  }
}
