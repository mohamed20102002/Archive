import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'

interface LogEntry {
  timestamp: string
  level: string
  message: string
}

export function FloatingConsole() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logStats, setLogStats] = useState<{ total: number; errors: number; warnings: number } | null>(null)
  const [logFilter, setLogFilter] = useState<string>('all')
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [copied, setCopied] = useState(false)
  const consoleRef = useRef<HTMLDivElement>(null)

  // Only show for admin users
  const isAdmin = user?.role === 'admin'

  const loadLogs = async () => {
    setLoadingLogs(true)
    try {
      const filter = logFilter === 'all' ? undefined : { level: logFilter }
      const [logsResult, statsResult] = await Promise.all([
        window.electronAPI.logger.getLogs({ ...filter, limit: 500 }),
        window.electronAPI.logger.getStats()
      ])
      setLogs(logsResult)
      setLogStats(statsResult)
    } catch (err) {
      console.error('Failed to load logs:', err)
    } finally {
      setLoadingLogs(false)
    }
  }

  const handleClearLogs = async () => {
    try {
      await window.electronAPI.logger.clearLogs()
      setLogs([])
      setLogStats({ total: 0, errors: 0, warnings: 0 })
    } catch (err) {
      console.error('Failed to clear logs:', err)
    }
  }

  const handleCopyLogs = async () => {
    const text = logs.map(log =>
      `[${new Date(log.timestamp).toLocaleTimeString()}] [${log.level.toUpperCase()}] ${log.message}`
    ).join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy logs:', err)
    }
  }

  // Load logs when opened or filter changes
  useEffect(() => {
    if (isOpen) {
      loadLogs()
    }
  }, [isOpen, logFilter])

  // Auto-refresh logs every 5 seconds when open
  useEffect(() => {
    if (!isOpen) return
    const interval = setInterval(loadLogs, 5000)
    return () => clearInterval(interval)
  }, [isOpen, logFilter])

  // Load stats on mount for badge
  useEffect(() => {
    if (isAdmin) {
      window.electronAPI.logger.getStats().then(setLogStats)
    }
  }, [isAdmin])

  if (!isAdmin) return null

  return (
    <>
      {/* Floating Button - bottom right corner */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-20 right-6 z-[9999] p-4 rounded-full shadow-xl transition-all ${
          isOpen
            ? 'bg-blue-600 text-white'
            : logStats && logStats.errors > 0
              ? 'bg-red-600 text-white animate-pulse'
              : 'bg-gray-800 text-white hover:bg-gray-700 border-2 border-gray-600'
        }`}
        title="Application Console"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {logStats && logStats.errors > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {logStats.errors > 99 ? '99+' : logStats.errors}
          </span>
        )}
      </button>

      {/* Console Panel */}
      {isOpen && (
        <div
          ref={consoleRef}
          className="fixed bottom-36 right-6 z-[9999] w-[650px] max-w-[calc(100vw-14rem)] bg-gray-900 rounded-lg shadow-2xl border border-gray-700 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-200">Console</span>
              {logStats && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400">{logStats.total}</span>
                  {logStats.errors > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-900/50 text-red-400 rounded">
                      {logStats.errors} errors
                    </span>
                  )}
                  {logStats.warnings > 0 && (
                    <span className="px-1.5 py-0.5 bg-yellow-900/50 text-yellow-400 rounded">
                      {logStats.warnings} warnings
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                className="px-2 py-1 text-xs bg-gray-700 text-gray-200 border border-gray-600 rounded"
              >
                <option value="all">All</option>
                <option value="error">Errors</option>
                <option value="warn">Warnings</option>
                <option value="log">Info</option>
              </select>
              <button
                onClick={loadLogs}
                disabled={loadingLogs}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                title="Refresh"
              >
                <svg className={`w-4 h-4 ${loadingLogs ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={handleCopyLogs}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                title={copied ? 'Copied!' : 'Copy all logs'}
              >
                {copied ? (
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
              <button
                onClick={handleClearLogs}
                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
                title="Clear logs"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                title="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Log Content */}
          <div className="h-80 overflow-auto p-3 font-mono text-xs">
            {loadingLogs && logs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="animate-spin w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full mr-2" />
                Loading...
              </div>
            ) : logs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                No logs found
              </div>
            ) : (
              <div className="space-y-0.5">
                {logs.map((log, index) => (
                  <div
                    key={index}
                    className={`flex gap-2 py-0.5 ${
                      log.level === 'error' ? 'text-red-400 bg-red-900/20' :
                      log.level === 'warn' ? 'text-yellow-400 bg-yellow-900/10' :
                      log.level === 'info' ? 'text-blue-400' : 'text-gray-300'
                    }`}
                  >
                    <span className="text-gray-500 flex-shrink-0 w-20">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`w-14 flex-shrink-0 uppercase font-bold ${
                      log.level === 'error' ? 'text-red-500' :
                      log.level === 'warn' ? 'text-yellow-500' :
                      log.level === 'info' ? 'text-blue-500' : 'text-gray-500'
                    }`}>
                      [{log.level}]
                    </span>
                    <span className="whitespace-pre-wrap break-all flex-1">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
