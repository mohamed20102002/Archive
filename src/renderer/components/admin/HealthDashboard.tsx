import React, { useState, useEffect } from 'react'

interface HealthCheck {
  name: string
  status: 'healthy' | 'warning' | 'critical'
  message: string
  value?: number | string
  threshold?: number | string
  unit?: string
}

interface HealthStatus {
  overall: 'healthy' | 'warning' | 'critical'
  timestamp: string
  checks: HealthCheck[]
  summary: {
    healthy: number
    warning: number
    critical: number
  }
}

interface SystemMetrics {
  memory: {
    total: number
    used: number
    free: number
    percentUsed: number
  }
  cpu: {
    cores: number
    model: string
    loadAverage: number[]
  }
  disk: {
    total: number
    used: number
    free: number
    percentUsed: number
  }
  uptime: {
    system: number
    app: number
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}

const statusColors = {
  healthy: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
    icon: 'text-green-500'
  },
  warning: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-400',
    border: 'border-yellow-200 dark:border-yellow-800',
    icon: 'text-yellow-500'
  },
  critical: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
    icon: 'text-red-500'
  }
}

function StatusIcon({ status }: { status: 'healthy' | 'warning' | 'critical' }) {
  const colors = statusColors[status]

  if (status === 'healthy') {
    return (
      <svg className={`w-5 h-5 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    )
  }

  if (status === 'warning') {
    return (
      <svg className={`w-5 h-5 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    )
  }

  return (
    <svg className={`w-5 h-5 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function HealthCheckCard({ check }: { check: HealthCheck }) {
  const colors = statusColors[check.status]

  return (
    <div className={`p-4 rounded-lg border ${colors.bg} ${colors.border}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <StatusIcon status={check.status} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`font-medium ${colors.text}`}>{check.name}</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {check.message}
          </p>
          {check.value !== undefined && (
            <div className="mt-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 dark:text-gray-400">Value:</span>
                <span className={`font-mono ${colors.text}`}>
                  {typeof check.value === 'number' ? check.value.toFixed(2) : check.value}
                  {check.unit && ` ${check.unit}`}
                </span>
                {check.threshold !== undefined && (
                  <>
                    <span className="text-gray-500 dark:text-gray-400">/ Threshold:</span>
                    <span className="font-mono text-gray-600 dark:text-gray-400">
                      {check.threshold}
                      {check.unit && ` ${check.unit}`}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ title, value, subtitle, icon, color = 'blue' }: {
  title: string
  value: string
  subtitle?: string
  icon: React.ReactNode
  color?: 'blue' | 'green' | 'yellow' | 'purple'
}) {
  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function ProgressBar({ percent, color = 'blue' }: { percent: number; color?: 'blue' | 'green' | 'yellow' | 'red' }) {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500'
  }

  const barColor = percent > 90 ? 'red' : percent > 70 ? 'yellow' : color

  return (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
      <div
        className={`h-2 rounded-full transition-all duration-300 ${colorClasses[barColor]}`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  )
}

export function HealthDashboard() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchData = async () => {
    try {
      const [health, systemMetrics] = await Promise.all([
        window.electronAPI.health.runChecks(),
        window.electronAPI.health.getMetrics()
      ])

      setHealthStatus(health)
      setMetrics(systemMetrics)
      setLastRefresh(new Date())
    } catch (error) {
      console.error('Failed to fetch health data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()

    // Refresh every minute
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
  }

  const handleOptimize = async () => {
    setOptimizing(true)
    try {
      const result = await window.electronAPI.health.optimizeDatabase()
      if (result.success) {
        const savedBytes = (result.sizeBefore || 0) - (result.sizeAfter || 0)
        alert(`Database optimized. Space saved: ${formatBytes(savedBytes)}`)
        await fetchData()
      } else {
        alert(`Optimization failed: ${result.error}`)
      }
    } catch (error) {
      alert(`Optimization failed: ${error}`)
    } finally {
      setOptimizing(false)
    }
  }

  const handleCheckpoint = async () => {
    try {
      const result = await window.electronAPI.health.forceCheckpoint()
      if (result.success) {
        alert('WAL checkpoint completed successfully')
        await fetchData()
      } else {
        alert(`Checkpoint failed: ${result.error}`)
      }
    } catch (error) {
      alert(`Checkpoint failed: ${error}`)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            System Health
          </h2>
          {lastRefresh && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCheckpoint}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
          >
            WAL Checkpoint
          </button>
          <button
            onClick={handleOptimize}
            disabled={optimizing}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-50"
          >
            {optimizing ? 'Optimizing...' : 'Optimize Database'}
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Overall Status Banner */}
      {healthStatus && (
        <div className={`p-4 rounded-lg border flex items-center gap-4 ${statusColors[healthStatus.overall].bg} ${statusColors[healthStatus.overall].border}`}>
          <div className={`p-3 rounded-full ${healthStatus.overall === 'healthy' ? 'bg-green-200 dark:bg-green-800' : healthStatus.overall === 'warning' ? 'bg-yellow-200 dark:bg-yellow-800' : 'bg-red-200 dark:bg-red-800'}`}>
            <StatusIcon status={healthStatus.overall} />
          </div>
          <div className="flex-1">
            <h3 className={`text-lg font-semibold ${statusColors[healthStatus.overall].text}`}>
              System Status: {healthStatus.overall.charAt(0).toUpperCase() + healthStatus.overall.slice(1)}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {healthStatus.summary.healthy} healthy, {healthStatus.summary.warning} warnings, {healthStatus.summary.critical} critical
            </p>
          </div>
        </div>
      )}

      {/* System Metrics */}
      {metrics && (
        <div className="grid grid-cols-4 gap-4">
          <MetricCard
            title="Memory Usage"
            value={`${metrics.memory.percentUsed.toFixed(1)}%`}
            subtitle={`${formatBytes(metrics.memory.used)} / ${formatBytes(metrics.memory.total)}`}
            color="blue"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            }
          />
          <MetricCard
            title="Disk Usage"
            value={`${metrics.disk.percentUsed.toFixed(1)}%`}
            subtitle={`${formatBytes(metrics.disk.free)} free`}
            color="green"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            }
          />
          <MetricCard
            title="CPU Cores"
            value={`${metrics.cpu.cores}`}
            subtitle={metrics.cpu.model.slice(0, 30)}
            color="yellow"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
          />
          <MetricCard
            title="App Uptime"
            value={formatDuration(metrics.uptime.app)}
            subtitle={`System: ${formatDuration(metrics.uptime.system)}`}
            color="purple"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>
      )}

      {/* Resource Usage Bars */}
      {metrics && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Resource Usage</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Memory</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {formatBytes(metrics.memory.used)} / {formatBytes(metrics.memory.total)}
                </span>
              </div>
              <ProgressBar percent={metrics.memory.percentUsed} color="blue" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Disk</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {formatBytes(metrics.disk.used)} / {formatBytes(metrics.disk.total)}
                </span>
              </div>
              <ProgressBar percent={metrics.disk.percentUsed} color="green" />
            </div>
          </div>
        </div>
      )}

      {/* Health Checks Grid */}
      {healthStatus && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Health Checks</h3>
          <div className="grid grid-cols-2 gap-4">
            {healthStatus.checks.map((check, index) => (
              <HealthCheckCard key={index} check={check} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default HealthDashboard
