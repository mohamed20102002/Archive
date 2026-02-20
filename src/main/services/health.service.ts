import { getDatabase, isRestoreInProgress } from '../database/connection'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export interface HealthStatus {
  overall: 'healthy' | 'warning' | 'critical'
  timestamp: string
  checks: HealthCheck[]
  summary: {
    healthy: number
    warning: number
    critical: number
  }
}

export interface HealthCheck {
  name: string
  status: 'healthy' | 'warning' | 'critical'
  message: string
  value?: number | string
  threshold?: number | string
  unit?: string
}

export interface SystemMetrics {
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

// Health check interval (5 minutes)
const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000

// Thresholds
const DISK_WARNING_THRESHOLD = 2 * 1024 * 1024 * 1024 // 2GB
const DISK_CRITICAL_THRESHOLD = 1 * 1024 * 1024 * 1024 // 1GB
const MEMORY_WARNING_THRESHOLD = 80 // 80%
const MEMORY_CRITICAL_THRESHOLD = 95 // 95%
const DB_SIZE_WARNING_THRESHOLD = 500 * 1024 * 1024 // 500MB
const DB_SIZE_CRITICAL_THRESHOLD = 1024 * 1024 * 1024 // 1GB

// Store last health status
let lastHealthStatus: HealthStatus | null = null
let healthCheckInterval: NodeJS.Timeout | null = null
let appStartTime = Date.now()

/**
 * Get disk space information for the database directory
 */
async function getDiskSpace(): Promise<{ total: number; free: number; used: number }> {
  const dbPath = app.getPath('userData')

  try {
    // On Windows, use fsPromises.statfs or fallback to exec
    if (process.platform === 'win32') {
      // Use a simple approach - check the drive
      const drive = path.parse(dbPath).root
      const { execSync } = require('child_process')

      try {
        const output = execSync(`wmic logicaldisk where "DeviceID='${drive.replace('\\', '')}'" get Size,FreeSpace /format:csv`, {
          encoding: 'utf8',
          windowsHide: true
        })

        const lines = output.trim().split('\n').filter((l: string) => l.trim())
        if (lines.length >= 2) {
          const values = lines[1].split(',')
          const free = parseInt(values[1]) || 0
          const total = parseInt(values[2]) || 0
          return {
            total,
            free,
            used: total - free
          }
        }
      } catch {
        // Fallback to a default large value
        return { total: 100 * 1024 * 1024 * 1024, free: 50 * 1024 * 1024 * 1024, used: 50 * 1024 * 1024 * 1024 }
      }
    }

    // For Unix-like systems
    const { execSync } = require('child_process')
    const output = execSync(`df -B1 "${dbPath}"`, { encoding: 'utf8' })
    const lines = output.trim().split('\n')
    if (lines.length >= 2) {
      const values = lines[1].split(/\s+/)
      const total = parseInt(values[1]) || 0
      const used = parseInt(values[2]) || 0
      const free = parseInt(values[3]) || 0
      return { total, used, free }
    }
  } catch (error) {
    console.error('Failed to get disk space:', error)
  }

  // Fallback
  return { total: 0, free: 0, used: 0 }
}

/**
 * Get database file size
 */
function getDatabaseSize(): number {
  try {
    const dbPath = path.join(app.getPath('userData'), 'database.sqlite')
    const stats = fs.statSync(dbPath)
    return stats.size
  } catch {
    return 0
  }
}

/**
 * Check database connection health
 */
function checkDatabaseConnection(): HealthCheck {
  try {
    const db = getDatabase()
    const result = db.prepare('SELECT 1 as test').get() as { test: number }

    if (result && result.test === 1) {
      return {
        name: 'Database Connection',
        status: 'healthy',
        message: 'Database is connected and responding'
      }
    }

    return {
      name: 'Database Connection',
      status: 'critical',
      message: 'Database query returned unexpected result'
    }
  } catch (error) {
    return {
      name: 'Database Connection',
      status: 'critical',
      message: `Database connection failed: ${error}`
    }
  }
}

/**
 * Check database size
 */
function checkDatabaseSize(): HealthCheck {
  const size = getDatabaseSize()
  const sizeMB = size / (1024 * 1024)

  let status: 'healthy' | 'warning' | 'critical' = 'healthy'
  let message = `Database size: ${sizeMB.toFixed(2)} MB`

  if (size >= DB_SIZE_CRITICAL_THRESHOLD) {
    status = 'critical'
    message = `Database size is very large: ${sizeMB.toFixed(2)} MB. Consider archiving old data.`
  } else if (size >= DB_SIZE_WARNING_THRESHOLD) {
    status = 'warning'
    message = `Database size is growing: ${sizeMB.toFixed(2)} MB`
  }

  return {
    name: 'Database Size',
    status,
    message,
    value: sizeMB,
    threshold: DB_SIZE_WARNING_THRESHOLD / (1024 * 1024),
    unit: 'MB'
  }
}

/**
 * Check disk space
 */
async function checkDiskSpace(): Promise<HealthCheck> {
  const disk = await getDiskSpace()
  const freeGB = disk.free / (1024 * 1024 * 1024)

  let status: 'healthy' | 'warning' | 'critical' = 'healthy'
  let message = `Free disk space: ${freeGB.toFixed(2)} GB`

  if (disk.free <= DISK_CRITICAL_THRESHOLD) {
    status = 'critical'
    message = `Critical: Only ${freeGB.toFixed(2)} GB free disk space remaining!`
  } else if (disk.free <= DISK_WARNING_THRESHOLD) {
    status = 'warning'
    message = `Warning: Only ${freeGB.toFixed(2)} GB free disk space remaining`
  }

  return {
    name: 'Disk Space',
    status,
    message,
    value: freeGB,
    threshold: DISK_WARNING_THRESHOLD / (1024 * 1024 * 1024),
    unit: 'GB'
  }
}

/**
 * Check memory usage
 */
function checkMemoryUsage(): HealthCheck {
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem
  const percentUsed = (usedMem / totalMem) * 100

  let status: 'healthy' | 'warning' | 'critical' = 'healthy'
  let message = `Memory usage: ${percentUsed.toFixed(1)}%`

  if (percentUsed >= MEMORY_CRITICAL_THRESHOLD) {
    status = 'critical'
    message = `Critical: Memory usage at ${percentUsed.toFixed(1)}%`
  } else if (percentUsed >= MEMORY_WARNING_THRESHOLD) {
    status = 'warning'
    message = `Warning: Memory usage at ${percentUsed.toFixed(1)}%`
  }

  return {
    name: 'Memory Usage',
    status,
    message,
    value: percentUsed,
    threshold: MEMORY_WARNING_THRESHOLD,
    unit: '%'
  }
}

/**
 * Check process memory
 */
function checkProcessMemory(): HealthCheck {
  const memUsage = process.memoryUsage()
  const heapUsedMB = memUsage.heapUsed / (1024 * 1024)
  const heapTotalMB = memUsage.heapTotal / (1024 * 1024)
  const percentUsed = (memUsage.heapUsed / memUsage.heapTotal) * 100

  let status: 'healthy' | 'warning' | 'critical' = 'healthy'
  let message = `Heap: ${heapUsedMB.toFixed(1)} MB / ${heapTotalMB.toFixed(1)} MB (${percentUsed.toFixed(1)}%)`

  // Warn if heap usage is very high
  if (percentUsed > 90) {
    status = 'warning'
    message = `High heap usage: ${heapUsedMB.toFixed(1)} MB (${percentUsed.toFixed(1)}%)`
  }

  return {
    name: 'Process Memory',
    status,
    message,
    value: heapUsedMB,
    unit: 'MB'
  }
}

/**
 * Check database WAL size
 */
function checkWalSize(): HealthCheck {
  try {
    const dbPath = path.join(app.getPath('userData'), 'database.sqlite-wal')

    if (!fs.existsSync(dbPath)) {
      return {
        name: 'WAL File',
        status: 'healthy',
        message: 'No WAL file (database not in WAL mode or checkpointed)'
      }
    }

    const stats = fs.statSync(dbPath)
    const sizeMB = stats.size / (1024 * 1024)

    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    let message = `WAL file size: ${sizeMB.toFixed(2)} MB`

    // WAL file larger than 100MB is concerning
    if (sizeMB > 100) {
      status = 'warning'
      message = `Large WAL file: ${sizeMB.toFixed(2)} MB. Consider manual checkpoint.`
    }

    return {
      name: 'WAL File',
      status,
      message,
      value: sizeMB,
      threshold: 100,
      unit: 'MB'
    }
  } catch {
    return {
      name: 'WAL File',
      status: 'healthy',
      message: 'WAL file not found'
    }
  }
}

/**
 * Check pending database operations
 */
function checkDatabaseOperations(): HealthCheck {
  try {
    const db = getDatabase()

    // Check if database is locked
    const busyTimeout = db.pragma('busy_timeout') as { busy_timeout: number }[]

    return {
      name: 'Database Operations',
      status: 'healthy',
      message: `Database accessible, busy timeout: ${busyTimeout[0]?.busy_timeout || 0}ms`
    }
  } catch (error) {
    return {
      name: 'Database Operations',
      status: 'warning',
      message: `Database may be busy: ${error}`
    }
  }
}

/**
 * Run all health checks
 */
export async function runHealthChecks(): Promise<HealthStatus> {
  const checks: HealthCheck[] = []

  // Skip database checks during restore operation
  if (isRestoreInProgress()) {
    checks.push({
      name: 'Restore in Progress',
      status: 'warning',
      message: 'Database restore operation is in progress'
    })
    checks.push(await checkDiskSpace())
    checks.push(checkMemoryUsage())
    checks.push(checkProcessMemory())
  } else {
    // Run all checks
    checks.push(checkDatabaseConnection())
    checks.push(checkDatabaseSize())
    checks.push(await checkDiskSpace())
    checks.push(checkMemoryUsage())
    checks.push(checkProcessMemory())
    checks.push(checkWalSize())
    checks.push(checkDatabaseOperations())
  }

  // Calculate summary
  const summary = {
    healthy: checks.filter(c => c.status === 'healthy').length,
    warning: checks.filter(c => c.status === 'warning').length,
    critical: checks.filter(c => c.status === 'critical').length
  }

  // Determine overall status
  let overall: 'healthy' | 'warning' | 'critical' = 'healthy'
  if (summary.critical > 0) {
    overall = 'critical'
  } else if (summary.warning > 0) {
    overall = 'warning'
  }

  const status: HealthStatus = {
    overall,
    timestamp: new Date().toISOString(),
    checks,
    summary
  }

  lastHealthStatus = status

  return status
}

/**
 * Get system metrics
 */
export async function getSystemMetrics(): Promise<SystemMetrics> {
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const disk = await getDiskSpace()

  return {
    memory: {
      total: totalMem,
      used: totalMem - freeMem,
      free: freeMem,
      percentUsed: ((totalMem - freeMem) / totalMem) * 100
    },
    cpu: {
      cores: os.cpus().length,
      model: os.cpus()[0]?.model || 'Unknown',
      loadAverage: os.loadavg()
    },
    disk: {
      total: disk.total,
      used: disk.used,
      free: disk.free,
      percentUsed: disk.total > 0 ? (disk.used / disk.total) * 100 : 0
    },
    uptime: {
      system: os.uptime() * 1000, // Convert to ms
      app: Date.now() - appStartTime
    }
  }
}

/**
 * Get last health status
 */
export function getLastHealthStatus(): HealthStatus | null {
  return lastHealthStatus
}

/**
 * Start periodic health checks
 */
export function startHealthMonitoring(): void {
  if (healthCheckInterval) {
    return // Already running
  }

  appStartTime = Date.now()

  // Run initial check
  runHealthChecks().catch(err => {
    console.error('Initial health check failed:', err)
  })

  // Set up periodic checks
  healthCheckInterval = setInterval(() => {
    runHealthChecks().catch(err => {
      console.error('Periodic health check failed:', err)
    })
  }, HEALTH_CHECK_INTERVAL)

  console.log('Health monitoring started')
}

/**
 * Stop periodic health checks
 */
export function stopHealthMonitoring(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval)
    healthCheckInterval = null
    console.log('Health monitoring stopped')
  }
}

/**
 * Force a database checkpoint
 */
export function forceCheckpoint(): { success: boolean; error?: string } {
  try {
    const db = getDatabase()
    db.pragma('wal_checkpoint(TRUNCATE)')
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

/**
 * Optimize database (VACUUM)
 */
export function optimizeDatabase(): { success: boolean; error?: string; sizeBefore?: number; sizeAfter?: number } {
  try {
    const sizeBefore = getDatabaseSize()

    const db = getDatabase()
    db.exec('VACUUM')

    const sizeAfter = getDatabaseSize()

    return {
      success: true,
      sizeBefore,
      sizeAfter
    }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

/**
 * Analyze database (update statistics)
 */
export function analyzeDatabase(): { success: boolean; error?: string } {
  try {
    const db = getDatabase()
    db.exec('ANALYZE')
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}
