import { getDatabase, getEmailsPath } from '../database/connection'
import { logAudit, verifyAuditIntegrity, runBackgroundIntegrityCheck } from '../database/audit'
import * as fs from 'fs'
import * as path from 'path'

export interface IntegrityCheckResult {
  valid: boolean
  checks: IntegrityCheck[]
  totalChecks: number
  passedChecks: number
  failedChecks: number
  timestamp: string
}

export interface IntegrityCheck {
  name: string
  description: string
  passed: boolean
  details?: string
  repairAvailable?: boolean
}

export interface RepairResult {
  success: boolean
  repaired: number
  errors: string[]
}

/**
 * Run all database integrity checks
 */
export function checkDatabaseIntegrity(): IntegrityCheckResult {
  const checks: IntegrityCheck[] = []
  const timestamp = new Date().toISOString()

  // 1. SQLite integrity check
  checks.push(checkSqliteIntegrity())

  // 2. Foreign key violations
  checks.push(checkForeignKeys())

  // 3. Orphaned records
  checks.push(checkOrphanedRecords())

  // 4. Orphaned emails
  checks.push(checkOrphanedEmails())

  // 5. Orphaned attachments
  checks.push(checkOrphanedAttachments())

  // 6. Duplicate entries
  checks.push(checkDuplicates())

  // 7. FTS index sync
  checks.push(checkFtsIndexSync())

  // 8. Invalid dates
  checks.push(checkInvalidDates())

  // Calculate summary
  const passedChecks = checks.filter(c => c.passed).length
  const failedChecks = checks.filter(c => !c.passed).length

  return {
    valid: failedChecks === 0,
    checks,
    totalChecks: checks.length,
    passedChecks,
    failedChecks,
    timestamp
  }
}

/**
 * SQLite internal integrity check
 */
function checkSqliteIntegrity(): IntegrityCheck {
  const db = getDatabase()

  try {
    const result = db.pragma('integrity_check') as { integrity_check: string }[]

    if (result.length === 1 && result[0].integrity_check === 'ok') {
      return {
        name: 'SQLite Integrity',
        description: 'Database file structure integrity',
        passed: true
      }
    }

    return {
      name: 'SQLite Integrity',
      description: 'Database file structure integrity',
      passed: false,
      details: result.map(r => r.integrity_check).join(', '),
      repairAvailable: false
    }
  } catch (e) {
    return {
      name: 'SQLite Integrity',
      description: 'Database file structure integrity',
      passed: false,
      details: `Check failed: ${e}`,
      repairAvailable: false
    }
  }
}

/**
 * Check for foreign key violations
 */
function checkForeignKeys(): IntegrityCheck {
  const db = getDatabase()

  try {
    const violations = db.pragma('foreign_key_check') as {
      table: string
      rowid: number
      parent: string
      fkid: number
    }[]

    if (violations.length === 0) {
      return {
        name: 'Foreign Key Integrity',
        description: 'All foreign key references are valid',
        passed: true
      }
    }

    return {
      name: 'Foreign Key Integrity',
      description: 'All foreign key references are valid',
      passed: false,
      details: `${violations.length} foreign key violations found`,
      repairAvailable: true
    }
  } catch (e) {
    return {
      name: 'Foreign Key Integrity',
      description: 'All foreign key references are valid',
      passed: false,
      details: `Check failed: ${e}`,
      repairAvailable: false
    }
  }
}

/**
 * Check for orphaned records (records without topics)
 */
function checkOrphanedRecords(): IntegrityCheck {
  const db = getDatabase()

  try {
    const orphaned = db.prepare(`
      SELECT COUNT(*) as count FROM records r
      WHERE r.deleted_at IS NULL
        AND r.topic_id NOT IN (SELECT id FROM topics WHERE deleted_at IS NULL)
    `).get() as { count: number }

    if (orphaned.count === 0) {
      return {
        name: 'Orphaned Records',
        description: 'All records have valid parent topics',
        passed: true
      }
    }

    return {
      name: 'Orphaned Records',
      description: 'All records have valid parent topics',
      passed: false,
      details: `${orphaned.count} orphaned records found`,
      repairAvailable: true
    }
  } catch (e) {
    return {
      name: 'Orphaned Records',
      description: 'All records have valid parent topics',
      passed: false,
      details: `Check failed: ${e}`,
      repairAvailable: false
    }
  }
}

/**
 * Check for orphaned emails (emails not linked to any record)
 */
function checkOrphanedEmails(): IntegrityCheck {
  const db = getDatabase()

  try {
    // Emails are linked FROM records via records.email_id
    // An orphaned email is one that no record references
    const orphaned = db.prepare(`
      SELECT COUNT(*) as count FROM emails e
      WHERE e.id NOT IN (
        SELECT email_id FROM records
        WHERE email_id IS NOT NULL AND deleted_at IS NULL
      )
    `).get() as { count: number }

    if (orphaned.count === 0) {
      return {
        name: 'Orphaned Emails',
        description: 'All emails are linked to valid records',
        passed: true
      }
    }

    return {
      name: 'Orphaned Emails',
      description: 'All emails are linked to valid records',
      passed: false,
      details: `${orphaned.count} orphaned emails found (not linked to any record)`,
      repairAvailable: true
    }
  } catch (e) {
    return {
      name: 'Orphaned Emails',
      description: 'All emails are linked to valid records',
      passed: false,
      details: `Check failed: ${e}`,
      repairAvailable: false
    }
  }
}

/**
 * Check for orphaned attachments
 */
function checkOrphanedAttachments(): IntegrityCheck {
  const db = getDatabase()

  try {
    const orphanedRecordAttachments = db.prepare(`
      SELECT COUNT(*) as count FROM record_attachments ra
      WHERE ra.record_id NOT IN (SELECT id FROM records WHERE deleted_at IS NULL)
    `).get() as { count: number }

    const orphanedLetterAttachments = db.prepare(`
      SELECT COUNT(*) as count FROM letter_attachments la
      WHERE la.deleted_at IS NULL
        AND la.letter_id NOT IN (SELECT id FROM letters WHERE deleted_at IS NULL)
    `).get() as { count: number }

    const total = orphanedRecordAttachments.count + orphanedLetterAttachments.count

    if (total === 0) {
      return {
        name: 'Orphaned Attachments',
        description: 'All attachments have valid parent entities',
        passed: true
      }
    }

    return {
      name: 'Orphaned Attachments',
      description: 'All attachments have valid parent entities',
      passed: false,
      details: `${total} orphaned attachments found (${orphanedRecordAttachments.count} record, ${orphanedLetterAttachments.count} letter)`,
      repairAvailable: true
    }
  } catch (e) {
    return {
      name: 'Orphaned Attachments',
      description: 'All attachments have valid parent entities',
      passed: false,
      details: `Check failed: ${e}`,
      repairAvailable: false
    }
  }
}

/**
 * Check for duplicate entries
 */
function checkDuplicates(): IntegrityCheck {
  const db = getDatabase()

  try {
    // Check for duplicate usernames
    const duplicateUsers = db.prepare(`
      SELECT username, COUNT(*) as count FROM users
      WHERE deleted_at IS NULL
      GROUP BY username
      HAVING count > 1
    `).all() as { username: string; count: number }[]

    if (duplicateUsers.length > 0) {
      return {
        name: 'Duplicate Entries',
        description: 'No duplicate entries exist',
        passed: false,
        details: `${duplicateUsers.length} duplicate usernames found`,
        repairAvailable: false
      }
    }

    return {
      name: 'Duplicate Entries',
      description: 'No duplicate entries exist',
      passed: true
    }
  } catch (e) {
    return {
      name: 'Duplicate Entries',
      description: 'No duplicate entries exist',
      passed: false,
      details: `Check failed: ${e}`,
      repairAvailable: false
    }
  }
}

/**
 * Check FTS index synchronization
 */
function checkFtsIndexSync(): IntegrityCheck {
  const db = getDatabase()

  try {
    // Check topics FTS sync
    const topicsMismatch = db.prepare(`
      SELECT COUNT(*) as count FROM topics t
      WHERE t.deleted_at IS NULL
        AND t.rowid NOT IN (SELECT rowid FROM topics_fts)
    `).get() as { count: number }

    // Check records FTS sync
    const recordsMismatch = db.prepare(`
      SELECT COUNT(*) as count FROM records r
      WHERE r.deleted_at IS NULL
        AND r.rowid NOT IN (SELECT rowid FROM records_fts)
    `).get() as { count: number }

    const total = topicsMismatch.count + recordsMismatch.count

    if (total === 0) {
      return {
        name: 'FTS Index Sync',
        description: 'Full-text search indexes are synchronized',
        passed: true
      }
    }

    return {
      name: 'FTS Index Sync',
      description: 'Full-text search indexes are synchronized',
      passed: false,
      details: `${total} entries not indexed (${topicsMismatch.count} topics, ${recordsMismatch.count} records)`,
      repairAvailable: true
    }
  } catch (e) {
    return {
      name: 'FTS Index Sync',
      description: 'Full-text search indexes are synchronized',
      passed: false,
      details: `Check failed: ${e}`,
      repairAvailable: false
    }
  }
}

/**
 * Check for invalid dates
 */
function checkInvalidDates(): IntegrityCheck {
  const db = getDatabase()

  try {
    // Check for future created_at dates
    const now = new Date().toISOString()
    const futureDates = db.prepare(`
      SELECT COUNT(*) as count FROM (
        SELECT created_at FROM topics WHERE created_at > ?
        UNION ALL
        SELECT created_at FROM records WHERE created_at > ?
        UNION ALL
        SELECT created_at FROM letters WHERE created_at > ?
      )
    `).get(now, now, now) as { count: number }

    if (futureDates.count > 0) {
      return {
        name: 'Date Validity',
        description: 'All dates are valid',
        passed: false,
        details: `${futureDates.count} entries have future dates`,
        repairAvailable: true
      }
    }

    return {
      name: 'Date Validity',
      description: 'All dates are valid',
      passed: true
    }
  } catch (e) {
    return {
      name: 'Date Validity',
      description: 'All dates are valid',
      passed: false,
      details: `Check failed: ${e}`,
      repairAvailable: false
    }
  }
}

/**
 * Repair orphaned records by soft-deleting them
 */
export function repairOrphanedRecords(): RepairResult {
  const db = getDatabase()
  const errors: string[] = []
  let repaired = 0

  try {
    const now = new Date().toISOString()

    const result = db.prepare(`
      UPDATE records SET deleted_at = ?
      WHERE deleted_at IS NULL
        AND topic_id NOT IN (SELECT id FROM topics WHERE deleted_at IS NULL)
    `).run(now)

    repaired = result.changes

    logAudit('SYSTEM_STARTUP', null, 'SYSTEM', 'integrity', null, {
      action: 'repair_orphaned_records',
      repaired
    })

    return { success: true, repaired, errors }
  } catch (e) {
    errors.push(`Failed to repair: ${e}`)
    return { success: false, repaired, errors }
  }
}

/**
 * Repair foreign key violations by deleting invalid rows
 */
export function repairForeignKeyViolations(): RepairResult {
  const db = getDatabase()
  const errors: string[] = []
  let repaired = 0

  try {
    // Get all FK violations
    const violations = db.pragma('foreign_key_check') as {
      table: string
      rowid: number
      parent: string
      fkid: number
    }[]

    // Group by table for efficient deletion
    const byTable: { [table: string]: number[] } = {}
    for (const v of violations) {
      if (!byTable[v.table]) byTable[v.table] = []
      byTable[v.table].push(v.rowid)
    }

    // Delete invalid rows from each table
    for (const [table, rowids] of Object.entries(byTable)) {
      try {
        // Use a transaction for each table
        const placeholders = rowids.map(() => '?').join(',')
        const stmt = db.prepare(`DELETE FROM "${table}" WHERE rowid IN (${placeholders})`)
        const result = stmt.run(...rowids)
        repaired += result.changes
        console.log(`[integrity] Deleted ${result.changes} invalid rows from ${table}`)
      } catch (tableErr) {
        errors.push(`Failed to repair ${table}: ${tableErr}`)
      }
    }

    logAudit('SYSTEM_STARTUP', null, 'SYSTEM', 'integrity', null, {
      action: 'repair_foreign_key_violations',
      repaired,
      tables: Object.keys(byTable)
    })

    return { success: errors.length === 0, repaired, errors }
  } catch (e) {
    errors.push(`Failed to repair: ${e}`)
    return { success: false, repaired, errors }
  }
}

/**
 * Repair orphaned emails by deleting them and their files
 */
export function repairOrphanedEmails(): RepairResult {
  const db = getDatabase()
  const errors: string[] = []
  let repaired = 0

  try {
    // Get orphaned emails with their storage paths
    const orphaned = db.prepare(`
      SELECT e.id, e.storage_path FROM emails e
      WHERE e.id NOT IN (
        SELECT email_id FROM records
        WHERE email_id IS NOT NULL AND deleted_at IS NULL
      )
    `).all() as { id: string; storage_path: string | null }[]

    for (const email of orphaned) {
      try {
        // Delete the email file if it exists
        if (email.storage_path) {
          const fullPath = path.join(getEmailsPath(), email.storage_path)
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath)
            console.log(`[integrity] Deleted orphaned email file: ${email.storage_path}`)
          }
        }

        // Delete from database
        db.prepare('DELETE FROM emails WHERE id = ?').run(email.id)
        repaired++
      } catch (emailErr) {
        errors.push(`Failed to delete email ${email.id}: ${emailErr}`)
      }
    }

    logAudit('SYSTEM_STARTUP', null, 'SYSTEM', 'integrity', null, {
      action: 'repair_orphaned_emails',
      repaired
    })

    return { success: errors.length === 0, repaired, errors }
  } catch (e) {
    errors.push(`Failed to repair: ${e}`)
    return { success: false, repaired, errors }
  }
}

/**
 * Repair orphaned attachments by deleting them
 */
export function repairOrphanedAttachments(): RepairResult {
  const db = getDatabase()
  const errors: string[] = []
  let repaired = 0

  try {
    // Delete orphaned record attachments
    const recordResult = db.prepare(`
      DELETE FROM record_attachments
      WHERE record_id NOT IN (SELECT id FROM records WHERE deleted_at IS NULL)
    `).run()
    repaired += recordResult.changes

    // Soft-delete orphaned letter attachments
    const now = new Date().toISOString()
    const letterResult = db.prepare(`
      UPDATE letter_attachments SET deleted_at = ?
      WHERE deleted_at IS NULL
        AND letter_id NOT IN (SELECT id FROM letters WHERE deleted_at IS NULL)
    `).run(now)
    repaired += letterResult.changes

    logAudit('SYSTEM_STARTUP', null, 'SYSTEM', 'integrity', null, {
      action: 'repair_orphaned_attachments',
      repaired
    })

    return { success: true, repaired, errors }
  } catch (e) {
    errors.push(`Failed to repair: ${e}`)
    return { success: false, repaired, errors }
  }
}

/**
 * Rebuild FTS indexes
 */
export function rebuildFtsIndexes(): RepairResult {
  const db = getDatabase()
  const errors: string[] = []
  let repaired = 0

  try {
    // Rebuild topics FTS
    db.exec(`
      INSERT INTO topics_fts(topics_fts) VALUES('rebuild')
    `)
    repaired++

    // Rebuild records FTS
    db.exec(`
      INSERT INTO records_fts(records_fts) VALUES('rebuild')
    `)
    repaired++

    // Rebuild emails FTS
    db.exec(`
      INSERT INTO emails_fts(emails_fts) VALUES('rebuild')
    `)
    repaired++

    // Rebuild letters FTS
    db.exec(`
      INSERT INTO letters_fts(letters_fts) VALUES('rebuild')
    `)
    repaired++

    // Rebuild moms FTS
    db.exec(`
      INSERT INTO moms_fts(moms_fts) VALUES('rebuild')
    `)
    repaired++

    logAudit('SYSTEM_STARTUP', null, 'SYSTEM', 'integrity', null, {
      action: 'rebuild_fts_indexes',
      repaired
    })

    return { success: true, repaired, errors }
  } catch (e) {
    errors.push(`Failed to rebuild: ${e}`)
    return { success: false, repaired, errors }
  }
}

/**
 * Run integrity check on startup (background)
 */
let startupCheckComplete = false
let startupCheckResult: IntegrityCheckResult | null = null

export async function runStartupIntegrityCheck(): Promise<IntegrityCheckResult> {
  if (startupCheckComplete && startupCheckResult) {
    return startupCheckResult
  }

  return new Promise((resolve) => {
    // Run in next tick to not block startup
    setTimeout(() => {
      try {
        const result = checkDatabaseIntegrity()
        startupCheckResult = result
        startupCheckComplete = true

        // Log the check
        logAudit('SYSTEM_STARTUP', null, 'SYSTEM', 'integrity', null, {
          valid: result.valid,
          passed: result.passedChecks,
          failed: result.failedChecks
        })

        // Also run audit integrity check
        runBackgroundIntegrityCheck()

        resolve(result)
      } catch (e) {
        console.error('Startup integrity check failed:', e)
        const errorResult: IntegrityCheckResult = {
          valid: false,
          checks: [{
            name: 'Startup Check',
            description: 'Initial integrity check',
            passed: false,
            details: `Check failed: ${e}`
          }],
          totalChecks: 1,
          passedChecks: 0,
          failedChecks: 1,
          timestamp: new Date().toISOString()
        }
        startupCheckResult = errorResult
        startupCheckComplete = true
        resolve(errorResult)
      }
    }, 1000) // Delay 1 second after startup
  })
}

export function getStartupCheckResult(): IntegrityCheckResult | null {
  return startupCheckResult
}

export function isStartupCheckComplete(): boolean {
  return startupCheckComplete
}
