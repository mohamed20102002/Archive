import Database from 'better-sqlite3'
import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

let db: Database.Database | null = null
let auditDb: Database.Database | null = null
let restoreInProgress = false

export function setRestoreInProgress(value: boolean): void {
  restoreInProgress = value
  console.log(`[connection] restoreInProgress set to: ${value}`)
}

export function isRestoreInProgress(): boolean {
  return restoreInProgress
}

export function getDataPath(): string {
  // Simple portable mode - data folder next to exe
  const basePath = app.isPackaged
    ? path.dirname(app.getPath('exe'))
    : process.cwd()
  return path.join(basePath, 'data')
}

export function getEmailsPath(): string {
  const basePath = app.isPackaged
    ? path.dirname(app.getPath('exe'))
    : process.cwd()
  return path.join(basePath, 'emails')
}

export function ensureDataDirectory(): void {
  const dataPath = getDataPath()
  const emailsPath = getEmailsPath()

  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true })
  }

  if (!fs.existsSync(emailsPath)) {
    fs.mkdirSync(emailsPath, { recursive: true })
  }
}

export function getDatabase(): Database.Database {
  if (!db) {
    // If restore is in progress, log the call stack and prevent reopening
    if (restoreInProgress) {
      const stack = new Error().stack
      console.error(`[CRITICAL] getDatabase() called during restore! Stack trace:\n${stack}`)
      throw new Error('Cannot open database during restore operation')
    }

    ensureDataDirectory()
    const dbPath = path.join(getDataPath(), 'archive.db')

    db = new Database(dbPath)

    // Enable WAL mode for better concurrency and crash safety
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.pragma('busy_timeout = 5000')

    console.log(`Database opened at: ${dbPath}`)
  }

  return db
}

export function getAuditDatabase(): Database.Database {
  if (!auditDb) {
    // If restore is in progress, log the call stack and prevent reopening
    if (restoreInProgress) {
      const stack = new Error().stack
      console.error(`[CRITICAL] getAuditDatabase() called during restore! Stack trace:\n${stack}`)
      throw new Error('Cannot open audit database during restore operation')
    }

    ensureDataDirectory()
    const auditDbPath = path.join(getDataPath(), 'audit.db')

    auditDb = new Database(auditDbPath)

    // Enable WAL mode
    auditDb.pragma('journal_mode = WAL')
    auditDb.pragma('busy_timeout = 5000')

    console.log(`Audit database opened at: ${auditDbPath}`)
  }

  return auditDb
}

export function closeDatabase(): void {
  const dataPath = getDataPath()
  const mainDbPath = path.join(dataPath, 'archive.db')
  const auditDbPath = path.join(dataPath, 'audit.db')

  if (db) {
    try {
      // Force checkpoint to merge WAL into main database file
      console.log('Main database: Running TRUNCATE checkpoint...')
      db.pragma('wal_checkpoint(TRUNCATE)')

      // Switch to DELETE journal mode to remove WAL files
      console.log('Main database: Switching to DELETE journal mode...')
      db.pragma('journal_mode = DELETE')

      console.log('Main database: Closing...')
      db.close()
      db = null
      console.log('Main database closed successfully')
    } catch (err) {
      console.error('Error closing main database:', err)
      db = null
    }
  }

  if (auditDb) {
    try {
      // Force checkpoint to merge WAL into main database file
      console.log('Audit database: Running TRUNCATE checkpoint...')
      auditDb.pragma('wal_checkpoint(TRUNCATE)')

      // Switch to DELETE journal mode to remove WAL files
      console.log('Audit database: Switching to DELETE journal mode...')
      auditDb.pragma('journal_mode = DELETE')

      console.log('Audit database: Closing...')
      auditDb.close()
      auditDb = null
      console.log('Audit database closed successfully')
    } catch (err) {
      console.error('Error closing audit database:', err)
      auditDb = null
    }
  }

  // Force delete WAL and SHM files if they still exist
  const walFiles = [
    `${mainDbPath}-wal`, `${mainDbPath}-shm`,
    `${auditDbPath}-wal`, `${auditDbPath}-shm`
  ]

  for (const walFile of walFiles) {
    if (fs.existsSync(walFile)) {
      try {
        fs.unlinkSync(walFile)
        console.log(`Deleted WAL/SHM file: ${walFile}`)
      } catch (err) {
        console.error(`Failed to delete WAL/SHM file ${walFile}:`, err)
      }
    }
  }
}

export function checkpointDatabases(): void {
  if (db) {
    db.pragma('wal_checkpoint(TRUNCATE)')
    console.log('Main database WAL checkpointed')
  }
  if (auditDb) {
    auditDb.pragma('wal_checkpoint(TRUNCATE)')
    console.log('Audit database WAL checkpointed')
  }
}

export function isDatabaseInitialized(): boolean {
  const dbPath = path.join(getDataPath(), 'archive.db')
  return fs.existsSync(dbPath)
}

export function refreshDatabase(): void {
  console.log('Refreshing database connections...')

  // Checkpoint WAL to ensure all changes are written
  checkpointDatabases()

  // Close connections
  closeDatabase()

  // Reopen connections
  getDatabase()
  getAuditDatabase()

  console.log('Database connections refreshed')
}
