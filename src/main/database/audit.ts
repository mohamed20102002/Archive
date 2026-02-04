import { getAuditDatabase, getDataPath } from './connection'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

export interface AuditEntry {
  id: number
  timestamp: string
  user_id: string
  username: string
  action: string
  entity_type: string
  entity_id: string
  details: string
  previous_checksum: string
  checksum: string
}

export type AuditAction =
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'USER_LOGIN_FAILED'
  | 'TOPIC_CREATE'
  | 'TOPIC_UPDATE'
  | 'TOPIC_DELETE'
  | 'RECORD_CREATE'
  | 'RECORD_UPDATE'
  | 'RECORD_DELETE'
  | 'EMAIL_ARCHIVE'
  | 'EMAIL_DELETE'
  | 'REMINDER_CREATE'
  | 'REMINDER_UPDATE'
  | 'REMINDER_COMPLETE'
  | 'REMINDER_DELETE'
  | 'ISSUE_CREATE'
  | 'ISSUE_UPDATE'
  | 'ISSUE_CLOSE'
  | 'ISSUE_REOPEN'
  | 'ISSUE_COMMENT'
  | 'CREDENTIAL_CREATE'
  | 'CREDENTIAL_UPDATE'
  | 'CREDENTIAL_DELETE'
  | 'CREDENTIAL_VIEW_PASSWORD'
  | 'SECURE_REFERENCE_CREATE'
  | 'SECURE_REFERENCE_UPDATE'
  | 'SECURE_REFERENCE_DELETE'
  | 'SECURE_REFERENCE_FILE_ADD'
  | 'SECURE_REFERENCE_FILE_DELETE'
  | 'ATTENDANCE_CONDITION_CREATE'
  | 'ATTENDANCE_CONDITION_UPDATE'
  | 'ATTENDANCE_CONDITION_DELETE'
  | 'ATTENDANCE_ENTRY_SAVE'
  | 'ATTENDANCE_ENTRY_DELETE'
  | 'ATTENDANCE_PDF_EXPORT'
  | 'SHIFT_CREATE'
  | 'SHIFT_UPDATE'
  | 'SHIFT_DELETE'
  | 'SETTINGS_UPDATE'
  | 'MOM_CREATE'
  | 'MOM_UPDATE'
  | 'MOM_DELETE'
  | 'MOM_CLOSE'
  | 'MOM_REOPEN'
  | 'MOM_FILE_UPLOAD'
  | 'MOM_ACTION_CREATE'
  | 'MOM_ACTION_UPDATE'
  | 'MOM_ACTION_RESOLVE'
  | 'MOM_ACTION_REOPEN'
  | 'MOM_DRAFT_CREATE'
  | 'MOM_DRAFT_DELETE'
  | 'MOM_DRAFT_FILE_UPLOAD'
  | 'MOM_TOPIC_LINK'
  | 'MOM_TOPIC_UNLINK'
  | 'MOM_RECORD_LINK'
  | 'MOM_RECORD_UNLINK'
  | 'MOM_LOCATION_CREATE'
  | 'MOM_LOCATION_UPDATE'
  | 'MOM_LOCATION_DELETE'
  | 'SYSTEM_STARTUP'
  | 'SYSTEM_SHUTDOWN'

export function initializeAuditSchema(): void {
  const db = getAuditDatabase()

  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      user_id TEXT,
      username TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      previous_checksum TEXT NOT NULL,
      checksum TEXT NOT NULL
    )
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
  `)

  console.log('Audit schema initialized')
}

function computeChecksum(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

function getLastChecksum(): string {
  const db = getAuditDatabase()
  const result = db.prepare(
    'SELECT checksum FROM audit_log ORDER BY id DESC LIMIT 1'
  ).get() as { checksum: string } | undefined

  if (result) {
    return result.checksum
  }

  // Initial checksum from seed file or generate new one
  const checksumFile = path.join(getDataPath(), 'audit.checksum')
  if (fs.existsSync(checksumFile)) {
    return fs.readFileSync(checksumFile, 'utf-8').trim()
  }

  // Generate initial seed checksum
  const seedChecksum = computeChecksum(`AUDIT_SEED_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`)
  fs.writeFileSync(checksumFile, seedChecksum)
  return seedChecksum
}

export function logAudit(
  action: AuditAction,
  userId: string | null,
  username: string | null,
  entityType: string | null,
  entityId: string | null,
  details: Record<string, unknown> | null
): void {
  const db = getAuditDatabase()
  const timestamp = new Date().toISOString()
  const previousChecksum = getLastChecksum()

  // Create checksum from entry data + previous checksum (blockchain-like chain)
  const entryData = JSON.stringify({
    timestamp,
    user_id: userId,
    username,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
    previous_checksum: previousChecksum
  })

  const checksum = computeChecksum(entryData)

  const stmt = db.prepare(`
    INSERT INTO audit_log (
      timestamp, user_id, username, action, entity_type,
      entity_id, details, previous_checksum, checksum
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    timestamp,
    userId,
    username,
    action,
    entityType,
    entityId,
    details ? JSON.stringify(details) : null,
    previousChecksum,
    checksum
  )
}

export function getAuditLog(
  options: {
    limit?: number
    offset?: number
    action?: string
    userId?: string
    entityType?: string
    entityId?: string
    startDate?: string
    endDate?: string
  } = {}
): { entries: AuditEntry[]; total: number } {
  const db = getAuditDatabase()

  const conditions: string[] = []
  const params: unknown[] = []

  if (options.action) {
    conditions.push('action = ?')
    params.push(options.action)
  }

  if (options.userId) {
    conditions.push('user_id = ?')
    params.push(options.userId)
  }

  if (options.entityType) {
    conditions.push('entity_type = ?')
    params.push(options.entityType)
  }

  if (options.entityId) {
    conditions.push('entity_id = ?')
    params.push(options.entityId)
  }

  if (options.startDate) {
    conditions.push('timestamp >= ?')
    params.push(options.startDate)
  }

  if (options.endDate) {
    conditions.push('timestamp <= ?')
    params.push(options.endDate)
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : ''

  // Get total count
  const countResult = db.prepare(
    `SELECT COUNT(*) as total FROM audit_log ${whereClause}`
  ).get(...params) as { total: number }

  // Get entries
  const limit = options.limit || 50
  const offset = options.offset || 0

  const entries = db.prepare(`
    SELECT * FROM audit_log
    ${whereClause}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as AuditEntry[]

  return {
    entries,
    total: countResult.total
  }
}

export function verifyAuditIntegrity(): {
  valid: boolean
  errors: string[]
  checkedCount: number
} {
  const db = getAuditDatabase()
  const errors: string[] = []

  const entries = db.prepare(
    'SELECT * FROM audit_log ORDER BY id ASC'
  ).all() as AuditEntry[]

  if (entries.length === 0) {
    return { valid: true, errors: [], checkedCount: 0 }
  }

  // Get initial seed checksum
  const checksumFile = path.join(getDataPath(), 'audit.checksum')
  let expectedPreviousChecksum = fs.existsSync(checksumFile)
    ? fs.readFileSync(checksumFile, 'utf-8').trim()
    : null

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]

    // Verify previous checksum chain
    if (i === 0) {
      if (expectedPreviousChecksum && entry.previous_checksum !== expectedPreviousChecksum) {
        errors.push(`Entry ${entry.id}: First entry previous_checksum mismatch`)
      }
    } else {
      const prevEntry = entries[i - 1]
      if (entry.previous_checksum !== prevEntry.checksum) {
        errors.push(`Entry ${entry.id}: Previous checksum chain broken`)
      }
    }

    // Verify entry checksum
    const entryData = JSON.stringify({
      timestamp: entry.timestamp,
      user_id: entry.user_id,
      username: entry.username,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      details: entry.details ? JSON.parse(entry.details) : null,
      previous_checksum: entry.previous_checksum
    })

    const computedChecksum = computeChecksum(entryData)
    if (computedChecksum !== entry.checksum) {
      errors.push(`Entry ${entry.id}: Checksum verification failed (data may have been tampered)`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    checkedCount: entries.length
  }
}

export function getAuditStats(): {
  totalEntries: number
  entriesByAction: Record<string, number>
  entriesByUser: Record<string, number>
  recentActivity: AuditEntry[]
} {
  const db = getAuditDatabase()

  const totalResult = db.prepare(
    'SELECT COUNT(*) as total FROM audit_log'
  ).get() as { total: number }

  const actionStats = db.prepare(
    'SELECT action, COUNT(*) as count FROM audit_log GROUP BY action'
  ).all() as { action: string; count: number }[]

  const userStats = db.prepare(
    'SELECT username, COUNT(*) as count FROM audit_log WHERE username IS NOT NULL GROUP BY username'
  ).all() as { username: string; count: number }[]

  const recentActivity = db.prepare(
    'SELECT * FROM audit_log ORDER BY id DESC LIMIT 10'
  ).all() as AuditEntry[]

  return {
    totalEntries: totalResult.total,
    entriesByAction: Object.fromEntries(actionStats.map(s => [s.action, s.count])),
    entriesByUser: Object.fromEntries(userStats.map(s => [s.username, s.count])),
    recentActivity
  }
}
