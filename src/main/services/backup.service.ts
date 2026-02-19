import * as fs from 'fs'
import * as path from 'path'
import archiver from 'archiver'
import yauzl from 'yauzl'
import { BrowserWindow } from 'electron'
import { getDatabase, getAuditDatabase, getDataPath, getEmailsPath, closeDatabase, checkpointDatabases, setRestoreInProgress } from '../database/connection'
import { getCurrentVersion, runMigrations } from '../database/migrations'
import { initializeSchema } from '../database/schema'
import { initializeAuditSchema } from '../database/audit'
import { logAudit } from '../database/audit'
import { clearAllSessions } from './auth.service'

// ── Types ──

export interface BackupModuleCounts {
  topics: number
  records: number
  emails: number
  letters: number
  moms: number
  issues: number
  attendance_entries: number
  handovers: number
  reminders: number
  authorities: number
  credentials: number
  secure_references: number
  secure_reference_files: number
  scheduled_emails: number
  users: number
}

export interface BackupInfo {
  backup_date: string
  backup_by_user_id: string
  backup_by_username: string
  backup_by_display_name: string
  app_version: string
  schema_version: number
  total_size_bytes: number
  file_count: number
  module_counts: BackupModuleCounts
  includes_emails?: boolean
}

export interface BackupComparison {
  backup: BackupInfo
  current: BackupInfo
  is_backup_older: boolean
  differences: {
    module: string
    backup_count: number
    current_count: number
    diff: number
  }[]
}

export interface BackupProgress {
  phase: string
  percentage: number
  message: string
  currentFile?: string
}

export interface BackupStatusFile {
  last_backup_date: string
  last_backup_user: string
  last_backup_file: string
  last_backup_size_bytes: number
}

// ── Helpers ──

function sendProgress(progress: BackupProgress): void {
  const windows = BrowserWindow.getAllWindows()
  if (windows.length > 0) {
    windows[0].webContents.send('backup:progress', progress)
  }
}

function getSystemDir(): string {
  const dir = path.join(getDataPath(), 'system')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

function getBackupStatusPath(): string {
  return path.join(getSystemDir(), 'backup_status.json')
}

function getRollbackDir(): string {
  const dir = path.join(getSystemDir(), 'rollback')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

function getAppVersion(): string {
  try {
    const pkgPath = path.join(process.cwd(), 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    return pkg.version || '1.0.0'
  } catch {
    return '1.0.0'
  }
}

function isExcludedPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/')
  // Exclude system folder
  if (normalized.startsWith('system/') || normalized === 'system') return true
  // Exclude WAL/SHM files
  if (normalized.endsWith('.db-wal') || normalized.endsWith('.db-shm')) return true
  // Exclude secure-resources/.temp folder (decrypted temp files)
  if (normalized.startsWith('secure-resources/.temp/') || normalized === 'secure-resources/.temp') return true
  // Include secure-resources/references and .keyfile (for backup)
  // Everything else in secure-resources is included now
  return false
}

function getDataDirectorySize(dataPath: string): { totalBytes: number; fileCount: number } {
  let totalBytes = 0
  let fileCount = 0

  function walk(dir: string, relBase: string): void {
    if (!fs.existsSync(dir)) return
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      const relPath = path.join(relBase, entry.name)
      if (isExcludedPath(relPath)) continue
      if (entry.isDirectory()) {
        walk(fullPath, relPath)
      } else {
        const stat = fs.statSync(fullPath)
        totalBytes += stat.size
        fileCount++
      }
    }
  }

  walk(dataPath, '')
  return { totalBytes, fileCount }
}

function collectFiles(dataPath: string): { fullPath: string; relativePath: string }[] {
  const files: { fullPath: string; relativePath: string }[] = []

  function walk(dir: string, relBase: string): void {
    if (!fs.existsSync(dir)) return
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      const relPath = path.join(relBase, entry.name).replace(/\\/g, '/')
      if (isExcludedPath(relPath)) continue
      if (entry.isDirectory()) {
        walk(fullPath, relPath)
      } else {
        files.push({ fullPath, relativePath: relPath })
      }
    }
  }

  walk(dataPath, '')
  return files
}

function getDirectorySize(dirPath: string): { totalBytes: number; fileCount: number } {
  let totalBytes = 0
  let fileCount = 0

  function walk(dir: string): void {
    if (!fs.existsSync(dir)) return
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else {
        const stat = fs.statSync(fullPath)
        totalBytes += stat.size
        fileCount++
      }
    }
  }

  walk(dirPath)
  return { totalBytes, fileCount }
}

function collectEmailFiles(): { fullPath: string; relativePath: string }[] {
  const emailsPath = getEmailsPath()
  const files: { fullPath: string; relativePath: string }[] = []

  function walk(dir: string, relBase: string): void {
    if (!fs.existsSync(dir)) return
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      const relPath = path.join(relBase, entry.name).replace(/\\/g, '/')
      if (entry.isDirectory()) {
        walk(fullPath, relPath)
      } else {
        files.push({ fullPath, relativePath: `emails/${relPath}` })
      }
    }
  }

  walk(emailsPath, '')
  return files
}

export function getEmailsFolderSize(): { totalBytes: number; fileCount: number } {
  return getDirectorySize(getEmailsPath())
}

// ── Module Counts ──

export function getModuleCounts(): BackupModuleCounts {
  const db = getDatabase()

  const count = (table: string): number => {
    try {
      const deletedAtCol = table === 'emails' || table === 'handovers' || table === 'attendance_entries' ? null : 'deleted_at'
      const where = deletedAtCol ? ` WHERE ${deletedAtCol} IS NULL` : ''
      const result = db.prepare(`SELECT COUNT(*) as c FROM ${table}${where}`).get() as { c: number }
      return result.c
    } catch {
      return 0
    }
  }

  // Simple count without deleted_at filter (for tables that don't have it)
  const countSimple = (table: string): number => {
    try {
      const result = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }
      return result.c
    } catch {
      return 0
    }
  }

  return {
    topics: count('topics'),
    records: count('records'),
    emails: count('emails'),
    letters: count('letters'),
    moms: count('moms'),
    issues: count('issues'),
    attendance_entries: count('attendance_entries'),
    handovers: count('handovers'),
    reminders: count('reminders'),
    authorities: count('authorities'),
    credentials: count('credentials'),
    secure_references: count('secure_references'),
    secure_reference_files: countSimple('secure_reference_files'),
    scheduled_emails: count('email_schedules'),
    users: count('users')
  }
}

// ── Current Info ──

export function getCurrentInfo(userId: string, username: string, displayName: string): BackupInfo {
  const dataPath = getDataPath()
  const { totalBytes, fileCount } = getDataDirectorySize(dataPath)

  return {
    backup_date: new Date().toISOString(),
    backup_by_user_id: userId,
    backup_by_username: username,
    backup_by_display_name: displayName,
    app_version: getAppVersion(),
    schema_version: getCurrentVersion(),
    total_size_bytes: totalBytes,
    file_count: fileCount,
    module_counts: getModuleCounts()
  }
}

// ── Backup Status ──

export function getBackupStatus(): BackupStatusFile | null {
  const statusPath = getBackupStatusPath()
  if (!fs.existsSync(statusPath)) return null
  try {
    return JSON.parse(fs.readFileSync(statusPath, 'utf-8'))
  } catch {
    return null
  }
}

// Check if backup reminder should be shown based on settings and last backup date
export function checkBackupReminder(reminderDays: number): {
  shouldRemind: boolean
  daysSinceBackup: number | null
  lastBackupDate: string | null
} {
  // If reminder is disabled
  if (reminderDays <= 0) {
    return { shouldRemind: false, daysSinceBackup: null, lastBackupDate: null }
  }

  const status = getBackupStatus()

  // If never backed up
  if (!status || !status.last_backup_date) {
    return { shouldRemind: true, daysSinceBackup: null, lastBackupDate: null }
  }

  const lastBackup = new Date(status.last_backup_date)
  const now = new Date()
  const diffMs = now.getTime() - lastBackup.getTime()
  const daysSinceBackup = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  return {
    shouldRemind: daysSinceBackup >= reminderDays,
    daysSinceBackup,
    lastBackupDate: status.last_backup_date
  }
}

function saveBackupStatus(filePath: string, sizeBytes: number, username: string): void {
  const status: BackupStatusFile = {
    last_backup_date: new Date().toISOString(),
    last_backup_user: username,
    last_backup_file: filePath,
    last_backup_size_bytes: sizeBytes
  }
  fs.writeFileSync(getBackupStatusPath(), JSON.stringify(status, null, 2))
}

// ── Create Backup ──

export async function createBackup(
  userId: string,
  username: string,
  displayName: string,
  savePath: string,
  includeEmails: boolean = false
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    sendProgress({ phase: 'preparing', percentage: 5, message: 'Gathering backup information...' })

    const dataPath = getDataPath()
    const backupInfo = getCurrentInfo(userId, username, displayName)
    backupInfo.includes_emails = includeEmails

    sendProgress({ phase: 'checkpointing', percentage: 10, message: 'Checkpointing databases...' })
    checkpointDatabases()

    sendProgress({ phase: 'closing_db', percentage: 15, message: 'Closing database connections...' })
    closeDatabase()

    try {
      const files = collectFiles(dataPath)
      const emailFiles = includeEmails ? collectEmailFiles() : []
      const allFiles = [...files, ...emailFiles]
      const totalFiles = allFiles.length

      await new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(savePath)
        const archive = archiver('zip', { zlib: { level: 6 } })

        output.on('close', () => resolve())
        archive.on('error', (err: Error) => reject(err))

        // Track real progress via entry event (fires when each file is actually compressed)
        let processedFiles = 0
        archive.on('entry', (entryData) => {
          processedFiles++
          const pct = Math.round(15 + (processedFiles / (totalFiles + 1)) * 80)
          sendProgress({
            phase: 'archiving',
            percentage: Math.min(pct, 95),
            message: `Archiving files (${processedFiles}/${totalFiles})...`,
            currentFile: entryData.name
          })
        })

        archive.pipe(output)

        // Add backup_info.json first
        archive.append(JSON.stringify(backupInfo, null, 2), { name: 'backup_info.json' })

        // Queue all data files (and email files if included)
        for (const file of allFiles) {
          archive.file(file.fullPath, { name: file.relativePath })
        }

        sendProgress({ phase: 'archiving', percentage: 15, message: `Archiving files (0/${totalFiles})...` })
        archive.finalize()
      })
    } finally {
      // Always reopen databases
      sendProgress({ phase: 'reopening_db', percentage: 95, message: 'Reopening database connections...' })
      getDatabase()
      getAuditDatabase()
    }

    // Get file size for status
    const stat = fs.statSync(savePath)

    // Log audit
    logAudit('BACKUP_CREATE', userId, username, 'BACKUP', null, {
      file_path: savePath,
      file_size: stat.size,
      module_counts: backupInfo.module_counts
    })

    // Save status
    saveBackupStatus(savePath, stat.size, username)

    sendProgress({ phase: 'complete', percentage: 100, message: 'Backup created successfully!' })

    return { success: true, filePath: savePath }
  } catch (error: any) {
    console.error('Backup creation failed:', error)

    // Ensure DB is open
    try { getDatabase() } catch { /* ignore */ }
    try { getAuditDatabase() } catch { /* ignore */ }

    try {
      logAudit('BACKUP_FAILED', userId, username, 'BACKUP', null, {
        operation: 'create',
        error: error.message
      })
    } catch { /* ignore */ }

    sendProgress({ phase: 'error', percentage: 0, message: `Backup failed: ${error.message}` })

    return { success: false, error: error.message }
  }
}

// ── Streaming ZIP helpers ──

function openZip(zipPath: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err)
      resolve(zipfile!)
    })
  })
}

function readEntryStream(zipfile: yauzl.ZipFile, entry: yauzl.Entry): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, stream) => {
      if (err) return reject(err)
      const chunks: Buffer[] = []
      stream!.on('data', (chunk: Buffer) => chunks.push(chunk))
      stream!.on('end', () => resolve(Buffer.concat(chunks)))
      stream!.on('error', reject)
    })
  })
}

function extractZipStreaming(
  zipPath: string,
  dataPath: string,
  emailsPath: string,
  onProgress: (extracted: number, total: number, fileName: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err)

      const totalEntries = zipfile!.entryCount
      let extracted = 0

      zipfile!.readEntry()

      zipfile!.on('entry', (entry: yauzl.Entry) => {
        const normalized = entry.fileName.replace(/\\/g, '/')

        // Skip metadata and guarded paths
        if (normalized === 'backup_info.json' ||
            normalized.startsWith('secure-resources/.temp/') ||
            normalized.startsWith('system/')) {
          extracted++
          zipfile!.readEntry()
          return
        }

        // Directory entries end with /
        if (normalized.endsWith('/')) {
          let dirPath: string
          if (normalized.startsWith('emails/')) {
            dirPath = path.join(emailsPath, normalized.substring('emails/'.length))
          } else {
            dirPath = path.join(dataPath, normalized)
          }
          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true })
          }
          extracted++
          onProgress(extracted, totalEntries, normalized)
          zipfile!.readEntry()
          return
        }

        // Determine target path
        let targetPath: string
        if (normalized.startsWith('emails/')) {
          const emailRelPath = normalized.substring('emails/'.length)
          if (!emailRelPath) {
            extracted++
            zipfile!.readEntry()
            return
          }
          targetPath = path.join(emailsPath, emailRelPath)
        } else {
          targetPath = path.join(dataPath, entry.fileName)
        }

        const targetDir = path.dirname(targetPath)
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true })
        }

        // Stream the entry to disk
        zipfile!.openReadStream(entry, (err, readStream) => {
          if (err) return reject(err)

          const writeStream = fs.createWriteStream(targetPath)
          readStream!.pipe(writeStream)

          writeStream.on('close', () => {
            extracted++
            onProgress(extracted, totalEntries, normalized)
            zipfile!.readEntry()
          })

          writeStream.on('error', (writeErr) => {
            zipfile!.close()
            reject(writeErr)
          })
        })
      })

      zipfile!.on('end', () => resolve())
      zipfile!.on('error', (zipErr: Error) => reject(zipErr))
    })
  })
}

// ── Analyze Backup ──

export function analyzeBackup(zipPath: string): Promise<{ success: boolean; info?: BackupInfo; error?: string }> {
  console.log('[analyzeBackup] Starting analysis of:', zipPath)

  return new Promise((resolve) => {
    console.log('[analyzeBackup] Calling yauzl.open...')

    yauzl.open(zipPath, { lazyEntries: true, autoClose: false }, (openErr, zipfile) => {
      console.log('[analyzeBackup] yauzl.open callback fired')

      if (openErr) {
        console.log('[analyzeBackup] Open error:', openErr.message)
        return resolve({ success: false, error: `[STEP1] Failed to open ZIP: ${openErr.message}` })
      }

      if (!zipfile) {
        console.log('[analyzeBackup] No zipfile object')
        return resolve({ success: false, error: '[STEP1] Failed to open ZIP: no zipfile object' })
      }

      console.log('[analyzeBackup] ZIP opened successfully. Entry count:', zipfile.entryCount)

      let resolved = false
      let entryCount = 0
      let foundBackupInfo = false

      zipfile.on('error', (err: Error) => {
        console.log('[analyzeBackup] zipfile error event:', err.message)
        if (!resolved) {
          resolved = true
          resolve({ success: false, error: `[STEP2] ZIP read error: ${err.message}` })
        }
      })

      zipfile.on('entry', (entry: yauzl.Entry) => {
        entryCount++
        const fileName = entry.fileName.replace(/\\/g, '/')

        // Log first 5 entries and backup_info.json
        if (entryCount <= 5 || fileName === 'backup_info.json') {
          console.log(`[analyzeBackup] Entry #${entryCount}: "${fileName}"`)
        }

        if (resolved) return

        if (fileName === 'backup_info.json') {
          foundBackupInfo = true
          console.log('[analyzeBackup] Found backup_info.json! Opening read stream...')

          zipfile.openReadStream(entry, (streamErr, stream) => {
            if (streamErr) {
              resolved = true
              zipfile.close()
              return resolve({ success: false, error: `[STEP3] Stream open error: ${streamErr.message}` })
            }

            if (!stream) {
              resolved = true
              zipfile.close()
              return resolve({ success: false, error: '[STEP3] Stream is null' })
            }

            const chunks: Buffer[] = []

            stream.on('data', (chunk: Buffer) => {
              chunks.push(chunk)
            })

            stream.on('error', (readErr: Error) => {
              if (!resolved) {
                resolved = true
                zipfile.close()
                resolve({ success: false, error: `[STEP4] Stream read error: ${readErr.message}` })
              }
            })

            stream.on('end', () => {
              if (resolved) return
              resolved = true
              zipfile.close()

              try {
                const data = Buffer.concat(chunks).toString('utf-8')
                console.log('[analyzeBackup] JSON length:', data.length)

                const info: BackupInfo = JSON.parse(data)

                if (!info.backup_date || !info.module_counts) {
                  return resolve({ success: false, error: '[STEP5] Malformed backup_info.json: missing required fields' })
                }

                console.log('[analyzeBackup] SUCCESS')
                resolve({ success: true, info })
              } catch (parseErr: any) {
                resolve({ success: false, error: `[STEP5] JSON parse error: ${parseErr.message}` })
              }
            })
          })
        } else {
          // Not backup_info.json, continue to next entry
          zipfile.readEntry()
        }
      })

      zipfile.on('end', () => {
        console.log(`[analyzeBackup] ZIP end. Entries: ${entryCount}, foundBackupInfo: ${foundBackupInfo}`)
        if (!resolved) {
          resolved = true
          resolve({ success: false, error: `[STEP6] Scanned ${entryCount} entries but backup_info.json not found` })
        }
      })

      console.log('[analyzeBackup] Starting to read entries...')
      zipfile.readEntry()
    })
  })
}

// ── Compare Backup ──

export function compareBackup(
  backupInfo: BackupInfo,
  userId: string,
  username: string,
  displayName: string
): BackupComparison {
  const currentInfo = getCurrentInfo(userId, username, displayName)

  const moduleKeys = Object.keys(backupInfo.module_counts) as (keyof BackupModuleCounts)[]
  const differences = moduleKeys.map(key => ({
    module: key,
    backup_count: backupInfo.module_counts[key] || 0,
    current_count: currentInfo.module_counts[key] || 0,
    diff: (backupInfo.module_counts[key] || 0) - (currentInfo.module_counts[key] || 0)
  }))

  const isBackupOlder = new Date(backupInfo.backup_date) < new Date(currentInfo.backup_date)

  return {
    backup: backupInfo,
    current: currentInfo,
    is_backup_older: isBackupOlder,
    differences
  }
}

// ── Create Rollback Backup ──

async function createRollbackBackup(): Promise<string> {
  const dataPath = getDataPath()
  const now = new Date()
  const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 16)
  const rollbackPath = path.join(getRollbackDir(), `Rollback_${dateStr}.zip`)

  const files = collectFiles(dataPath)

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(rollbackPath)
    const archive = archiver('zip', { zlib: { level: 6 } })

    output.on('close', () => resolve())
    archive.on('error', (err: Error) => reject(err))

    archive.pipe(output)

    for (const file of files) {
      archive.file(file.fullPath, { name: file.relativePath })
    }

    archive.finalize()
  })

  // Clean up old rollback files - keep only the latest one
  cleanupOldRollbacks(rollbackPath)

  return rollbackPath
}

// Clean up old rollback files, keeping only the most recent one
function cleanupOldRollbacks(keepPath: string): void {
  try {
    const rollbackDir = getRollbackDir()
    const files = fs.readdirSync(rollbackDir)
      .filter(f => f.startsWith('Rollback_') && f.endsWith('.zip'))
      .map(f => path.join(rollbackDir, f))
      .filter(f => f !== keepPath)

    for (const file of files) {
      try {
        fs.unlinkSync(file)
        console.log(`[Rollback] Cleaned up old rollback: ${path.basename(file)}`)
      } catch (err) {
        console.warn(`[Rollback] Failed to delete old rollback ${file}:`, err)
      }
    }
  } catch (err) {
    console.warn('[Rollback] Failed to cleanup old rollbacks:', err)
  }
}

// ── Delete Data Directory Contents ──

// Helper to delete a file with retries (handles Windows file locking)
async function unlinkWithRetry(filePath: string, maxRetries: number = 10, delayMs: number = 1000): Promise<void> {
  console.log(`[unlinkWithRetry] Attempting to delete: ${filePath}`)
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      fs.unlinkSync(filePath)
      console.log(`[unlinkWithRetry] Successfully deleted: ${filePath}`)
      return
    } catch (error: any) {
      console.log(`[unlinkWithRetry] Attempt ${attempt}/${maxRetries} failed for ${filePath}: ${error.code} - ${error.message}`)
      if (error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'EACCES') {
        if (attempt < maxRetries) {
          console.log(`[unlinkWithRetry] Waiting ${delayMs}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, delayMs))
          delayMs *= 1.5 // Increase delay for each retry
        } else {
          console.log(`[unlinkWithRetry] All ${maxRetries} attempts failed for: ${filePath}`)
          throw new Error(`Failed to delete file after ${maxRetries} attempts: ${filePath}`)
        }
      } else {
        throw error
      }
    }
  }
}

// Helper to delete a directory with retries
async function rmDirWithRetry(dirPath: string, maxRetries: number = 5, delayMs: number = 500): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true })
      return
    } catch (error: any) {
      if (error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'EACCES') {
        if (attempt < maxRetries) {
          console.log(`Directory locked, retrying in ${delayMs}ms (attempt ${attempt}/${maxRetries}): ${dirPath}`)
          await new Promise(resolve => setTimeout(resolve, delayMs))
          delayMs *= 1.5
        } else {
          throw new Error(`Failed to delete directory after ${maxRetries} attempts: ${dirPath}`)
        }
      } else {
        throw error
      }
    }
  }
}

async function clearDataDirectory(dataPath: string): Promise<void> {
  console.log(`[clearDataDirectory] Starting to clear: ${dataPath}`)
  const entries = fs.readdirSync(dataPath, { withFileTypes: true })
  console.log(`[clearDataDirectory] Found ${entries.length} entries: ${entries.map(e => e.name).join(', ')}`)

  for (const entry of entries) {
    const fullPath = path.join(dataPath, entry.name)
    const relPath = entry.name

    // Never touch system directory
    if (relPath === 'system') {
      console.log(`[clearDataDirectory] Skipping protected: ${relPath}`)
      continue
    }

    // For secure-resources, clear references and .keyfile but keep .temp
    if (relPath === 'secure-resources') {
      console.log(`[clearDataDirectory] Clearing secure-resources contents (except .temp)...`)
      await clearSecureResourcesForRestore(fullPath)
      continue
    }

    if (entry.isDirectory()) {
      console.log(`[clearDataDirectory] Removing directory: ${relPath}`)
      await rmDirWithRetry(fullPath)
    } else {
      // Skip WAL/SHM (shouldn't exist after checkpoint, but just in case)
      if (relPath.endsWith('.db-wal') || relPath.endsWith('.db-shm')) {
        console.log(`[clearDataDirectory] Skipping WAL/SHM file: ${relPath}`)
        continue
      }
      console.log(`[clearDataDirectory] Removing file: ${relPath}`)
      await unlinkWithRetry(fullPath)
    }
  }
  console.log(`[clearDataDirectory] Completed clearing: ${dataPath}`)
}

// Clear secure-resources folder for restore, but preserve .temp folder
async function clearSecureResourcesForRestore(secureResourcesPath: string): Promise<void> {
  if (!fs.existsSync(secureResourcesPath)) return

  const entries = fs.readdirSync(secureResourcesPath, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(secureResourcesPath, entry.name)

    // Keep .temp folder (local decrypted files)
    if (entry.name === '.temp') {
      console.log(`[clearSecureResourcesForRestore] Keeping .temp folder`)
      continue
    }

    if (entry.isDirectory()) {
      console.log(`[clearSecureResourcesForRestore] Removing directory: ${entry.name}`)
      await rmDirWithRetry(fullPath)
    } else {
      console.log(`[clearSecureResourcesForRestore] Removing file: ${entry.name}`)
      await unlinkWithRetry(fullPath)
    }
  }
}

// ── Fix Foreign Key Violations ──

export function fixForeignKeyViolations(
  currentUserId: string,
  currentUsername: string,
  currentDisplayName: string
): { fixed: string[]; errors: string[] } {
  const db = getDatabase()
  const fixed: string[] = []
  const errors: string[] = []

  try {
    // Check for FK violations
    const fkErrors = db.pragma('foreign_key_check') as {
      table: string
      rowid: number
      parent: string
      fkid: number
    }[]

    if (fkErrors.length === 0) {
      console.log('[fixForeignKeyViolations] No foreign key violations found')
      return { fixed, errors }
    }

    console.log(`[fixForeignKeyViolations] Found ${fkErrors.length} violations:`, fkErrors)

    // Check if current user exists in the restored database
    const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(currentUserId)

    if (!userExists) {
      // The current logged-in user doesn't exist in the restored database
      // This is the most common cause of FK violations after restore
      console.log(`[fixForeignKeyViolations] Current user ${currentUserId} not found in restored database`)

      // Create a placeholder for the current user so they can continue working
      // They'll need to re-login to get proper credentials
      try {
        const now = new Date().toISOString()
        db.prepare(`
          INSERT INTO users (id, username, password_hash, display_name, role, is_active, created_at, updated_at)
          VALUES (?, ?, 'NEEDS_RESET', ?, 'admin', 1, ?, ?)
        `).run(currentUserId, currentUsername, currentDisplayName, now, now)

        fixed.push(`Created placeholder user: ${currentUsername}`)
        console.log(`[fixForeignKeyViolations] Created placeholder user: ${currentUsername}`)
      } catch (userErr: any) {
        // User might exist with different ID - username conflict
        if (userErr.message?.includes('UNIQUE constraint failed')) {
          errors.push(`Username "${currentUsername}" already exists with a different ID. You may need to login with the existing account.`)
        } else {
          errors.push(`Failed to create placeholder user: ${userErr.message}`)
        }
      }
    }

    // Group violations by table and parent table
    const violationsByTable = new Map<string, typeof fkErrors>()
    for (const err of fkErrors) {
      const key = `${err.table}->${err.parent}`
      if (!violationsByTable.has(key)) {
        violationsByTable.set(key, [])
      }
      violationsByTable.get(key)!.push(err)
    }

    // Log summary of remaining violations (if any after user fix)
    for (const [key, violations] of violationsByTable) {
      if (key.includes('->users')) {
        // Skip user-related violations if we already fixed them
        continue
      }
      errors.push(`${violations.length} orphaned records in ${key}`)
    }

  } catch (error: any) {
    console.error('[fixForeignKeyViolations] Error:', error)
    errors.push(`Error checking foreign keys: ${error.message}`)
  }

  return { fixed, errors }
}

// ── Restore Backup ──

export async function restoreBackup(
  zipPath: string,
  userId: string,
  username: string,
  displayName: string
): Promise<{ success: boolean; error?: string }> {
  let rollbackPath: string | null = null

  try {
    const dataPath = getDataPath()

    sendProgress({ phase: 'preparing', percentage: 5, message: 'Preparing restore...' })

    // Validate the ZIP first
    const analysis = await analyzeBackup(zipPath)
    if (!analysis.success || !analysis.info) {
      return { success: false, error: analysis.error || 'Invalid backup file' }
    }

    sendProgress({ phase: 'checkpointing', percentage: 10, message: 'Checkpointing databases...' })
    checkpointDatabases()

    sendProgress({ phase: 'closing_db', percentage: 15, message: 'Closing database connections...' })
    console.log('[restoreBackup] Setting restoreInProgress flag...')
    setRestoreInProgress(true)

    console.log('[restoreBackup] Calling closeDatabase()...')
    closeDatabase()
    console.log('[restoreBackup] closeDatabase() completed')

    // Wait for Windows to release file handles
    console.log('[restoreBackup] Waiting 2 seconds for file handles to be released...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    console.log('[restoreBackup] Wait completed, proceeding with restore...')

    try {
      // Create rollback
      sendProgress({ phase: 'creating_rollback', percentage: 20, message: 'Creating rollback backup...' })
      rollbackPath = await createRollbackBackup()

      // Clear data directory
      sendProgress({ phase: 'replacing', percentage: 40, message: 'Removing current data...' })
      await clearDataDirectory(dataPath)

      // If backup includes emails, clear the emails directory too
      const emailsPath = getEmailsPath()
      if (analysis.info.includes_emails) {
        sendProgress({ phase: 'replacing', percentage: 45, message: 'Removing current emails...' })
        if (fs.existsSync(emailsPath)) {
          const emailEntries = fs.readdirSync(emailsPath, { withFileTypes: true })
          for (const entry of emailEntries) {
            const fullPath = path.join(emailsPath, entry.name)
            if (entry.isDirectory()) {
              await rmDirWithRetry(fullPath)
            } else {
              await unlinkWithRetry(fullPath)
            }
          }
        }
      }

      // Extract ZIP using streaming (supports files >2GB)
      sendProgress({ phase: 'extracting', percentage: 50, message: 'Extracting backup files...' })
      await extractZipStreaming(zipPath, dataPath, emailsPath, (extracted, total, fileName) => {
        const pct = Math.round(50 + (extracted / total) * 35)
        sendProgress({
          phase: 'extracting',
          percentage: Math.min(pct, 85),
          message: `Extracting files (${extracted}/${total})...`,
          currentFile: fileName
        })
      })
    } finally {
      // Clear the restore flag before reopening databases
      console.log('[restoreBackup] Clearing restoreInProgress flag...')
      setRestoreInProgress(false)

      // Always reopen databases
      sendProgress({ phase: 'reopening_db', percentage: 85, message: 'Reopening database connections...' })
      getDatabase()
      getAuditDatabase()

      // Run migrations to update restored database to current schema
      sendProgress({ phase: 'migrating', percentage: 90, message: 'Applying schema migrations...' })
      try {
        initializeSchema()
        initializeAuditSchema()
        const migrationResult = runMigrations()
        console.log('[restoreBackup] Migrations applied:', migrationResult.applied)
        console.log('[restoreBackup] Current schema version:', migrationResult.currentVersion)
      } catch (migrationError: any) {
        console.error('[restoreBackup] Migration error:', migrationError)
        // Continue anyway - the restore might still work
      }
    }

    // Verify databases are working
    sendProgress({ phase: 'verifying', percentage: 95, message: 'Verifying restored data...' })
    try {
      const db = getDatabase()
      db.prepare('SELECT COUNT(*) FROM users').get()

      // Fix any foreign key violations (e.g., if current user doesn't exist in restored DB)
      const fkFixResult = fixForeignKeyViolations(userId, username, displayName)
      if (fkFixResult.fixed.length > 0) {
        console.log('[restoreBackup] FK fixes applied:', fkFixResult.fixed)
      }
      if (fkFixResult.errors.length > 0) {
        console.warn('[restoreBackup] FK fix warnings:', fkFixResult.errors)
      }
    } catch (verifyError: any) {
      // Attempt rollback
      if (rollbackPath) {
        try {
          closeDatabase()
          await new Promise(resolve => setTimeout(resolve, 1000))
          await clearDataDirectory(getDataPath())
          await extractZipStreaming(rollbackPath, getDataPath(), getEmailsPath(), () => {})
          getDatabase()
          getAuditDatabase()
          logAudit('BACKUP_ROLLBACK', userId, username, 'BACKUP', null, {
            reason: 'verification_failed',
            error: verifyError.message
          })
        } catch { /* ignore */ }
      }
      return { success: false, error: `Restore verification failed: ${verifyError.message}` }
    }

    // Log audit for rollback creation
    if (rollbackPath) {
      logAudit('BACKUP_ROLLBACK', userId, username, 'BACKUP', null, {
        rollback_path: rollbackPath
      })
    }

    // Log successful restore
    logAudit('BACKUP_RESTORE', userId, username, 'BACKUP', null, {
      source_file: zipPath,
      backup_date: analysis.info.backup_date,
      backup_by: analysis.info.backup_by_username
    })

    // Clear all active sessions to force re-login
    // This prevents FK errors when the current user's ID doesn't exist in the restored database
    clearAllSessions()

    // Notify renderer to refresh session (will trigger re-login if session is invalid)
    const windows = BrowserWindow.getAllWindows()
    if (windows.length > 0) {
      windows[0].webContents.send('backup:sessionInvalidated')
    }

    sendProgress({ phase: 'complete', percentage: 100, message: 'Restore completed successfully!' })

    return { success: true }
  } catch (error: any) {
    console.error('Restore failed:', error)

    // Clear the restore flag before any recovery
    setRestoreInProgress(false)

    // Ensure DB is open
    try { getDatabase() } catch { /* ignore */ }
    try { getAuditDatabase() } catch { /* ignore */ }

    // Try automatic rollback
    if (rollbackPath && fs.existsSync(rollbackPath)) {
      try {
        sendProgress({ phase: 'replacing', percentage: 50, message: 'Restore failed. Rolling back...' })
        closeDatabase()
        await new Promise(resolve => setTimeout(resolve, 1000))
        await clearDataDirectory(getDataPath())
        await extractZipStreaming(rollbackPath, getDataPath(), getEmailsPath(), () => {})
        getDatabase()
        getAuditDatabase()

        logAudit('BACKUP_ROLLBACK', userId, username, 'BACKUP', null, {
          reason: 'restore_failed',
          error: error.message
        })
      } catch (rollbackError: any) {
        console.error('Rollback also failed:', rollbackError)
      }
    }

    try {
      logAudit('BACKUP_FAILED', userId, username, 'BACKUP', null, {
        operation: 'restore',
        error: error.message
      })
    } catch { /* ignore */ }

    sendProgress({ phase: 'error', percentage: 0, message: `Restore failed: ${error.message}` })

    return { success: false, error: error.message }
  }
}
