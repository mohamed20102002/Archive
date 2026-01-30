import Database from 'better-sqlite3'
import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

let db: Database.Database | null = null
let auditDb: Database.Database | null = null

export function getDataPath(): string {
  // Use portable path relative to executable in production
  // In development, use project root
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
  if (db) {
    db.close()
    db = null
    console.log('Main database closed')
  }

  if (auditDb) {
    auditDb.close()
    auditDb = null
    console.log('Audit database closed')
  }
}

export function isDatabaseInitialized(): boolean {
  const dbPath = path.join(getDataPath(), 'archive.db')
  return fs.existsSync(dbPath)
}
