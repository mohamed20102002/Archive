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

    // Set busy timeout first (this rarely fails)
    db.pragma('busy_timeout = 5000')
    db.pragma('foreign_keys = ON')

    // Try to enable WAL mode - may fail if orphaned WAL files are locked
    try {
      db.pragma('journal_mode = WAL')
    } catch (walErr: any) {
      console.warn(`Could not set WAL mode (will use DELETE mode): ${walErr.message}`)
      // If WAL fails, try to use DELETE mode instead
      try {
        db.pragma('journal_mode = DELETE')
      } catch {
        // If that also fails, just continue - default journal mode will be used
        console.warn('Could not set any journal mode, using default')
      }
    }

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

    // Set busy timeout first (this rarely fails)
    auditDb.pragma('busy_timeout = 5000')

    // Try to enable WAL mode - may fail if orphaned WAL files are locked
    try {
      auditDb.pragma('journal_mode = WAL')
    } catch (walErr: any) {
      console.warn(`Audit DB: Could not set WAL mode (will use DELETE mode): ${walErr.message}`)
      // If WAL fails, try to use DELETE mode instead
      try {
        auditDb.pragma('journal_mode = DELETE')
      } catch {
        // If that also fails, just continue - default journal mode will be used
        console.warn('Audit DB: Could not set any journal mode, using default')
      }
    }

    console.log(`Audit database opened at: ${auditDbPath}`)
  }

  return auditDb
}

export function closeDatabase(forceDeleteWal = false): void {
  const dataPath = getDataPath()
  const mainDbPath = path.join(dataPath, 'archive.db')
  const auditDbPath = path.join(dataPath, 'audit.db')

  if (db) {
    try {
      // Force checkpoint to merge WAL into main database file
      console.log('Main database: Running TRUNCATE checkpoint...')
      try {
        db.pragma('wal_checkpoint(TRUNCATE)')
      } catch (checkpointErr) {
        console.warn('Main database: Checkpoint failed (may be locked):', checkpointErr)
      }

      // Only try to switch journal mode if forceDeleteWal is true (app shutdown)
      // This avoids locking issues during normal refresh operations
      if (forceDeleteWal) {
        try {
          console.log('Main database: Switching to DELETE journal mode...')
          db.pragma('journal_mode = DELETE')
        } catch (journalErr) {
          console.warn('Main database: Could not switch journal mode:', journalErr)
        }
      }

      console.log('Main database: Closing...')
      db.close()
      db = null
      console.log('Main database closed successfully')
    } catch (err) {
      console.error('Error closing main database:', err)
      // Still try to nullify the reference
      try { db?.close() } catch { /* ignore */ }
      db = null
    }
  }

  if (auditDb) {
    try {
      // Force checkpoint to merge WAL into main database file
      console.log('Audit database: Running TRUNCATE checkpoint...')
      try {
        auditDb.pragma('wal_checkpoint(TRUNCATE)')
      } catch (checkpointErr) {
        console.warn('Audit database: Checkpoint failed (may be locked):', checkpointErr)
      }

      // Only try to switch journal mode if forceDeleteWal is true (app shutdown)
      if (forceDeleteWal) {
        try {
          console.log('Audit database: Switching to DELETE journal mode...')
          auditDb.pragma('journal_mode = DELETE')
        } catch (journalErr) {
          console.warn('Audit database: Could not switch journal mode:', journalErr)
        }
      }

      console.log('Audit database: Closing...')
      auditDb.close()
      auditDb = null
      console.log('Audit database closed successfully')
    } catch (err) {
      console.error('Error closing audit database:', err)
      // Still try to nullify the reference
      try { auditDb?.close() } catch { /* ignore */ }
      auditDb = null
    }
  }

  // Only try to delete WAL files if explicitly requested (app shutdown)
  if (forceDeleteWal) {
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
          // Log but don't fail - these will be cleaned up on next proper shutdown
          console.warn(`Could not delete WAL/SHM file ${walFile} (may be in use)`)
        }
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
