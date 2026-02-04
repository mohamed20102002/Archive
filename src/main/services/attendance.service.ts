import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'
import { generateId } from '../utils/crypto'
import { getUsername } from './auth.service'

// ===== Types =====

export interface Shift {
  id: string
  name: string
  sort_order: number
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CreateShiftData {
  name: string
  sort_order?: number
}

export interface UpdateShiftData {
  name?: string
  sort_order?: number
}

export interface AttendanceCondition {
  id: string
  name: string
  color: string
  sort_order: number
  display_number: number
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CreateConditionData {
  name: string
  color: string
  sort_order?: number
  display_number?: number
}

export interface UpdateConditionData {
  name?: string
  color?: string
  sort_order?: number
  display_number?: number
}

export interface AttendanceEntry {
  id: string
  user_id: string
  entry_date: string
  year: number
  month: number
  day: number
  shift_id: string | null
  shift_name: string | null
  note: string | null
  created_by: string
  created_at: string
  updated_at: string
  conditions: AttendanceCondition[]
  user_display_name?: string
}

export interface SaveEntryData {
  user_id: string
  entry_date: string
  shift_id: string
  condition_ids: string[]
  note?: string
}

export interface AttendanceFilters {
  user_id?: string
  year: number
  month?: number
  shift_id?: string
  condition_id?: string
}

export interface AttendanceSummary {
  user_id: string
  user_display_name: string
  year: number
  condition_totals: Record<string, number>
  total_entries: number
  shift_totals: Record<string, number>
}

// ===== Shift CRUD =====

export function createShift(
  data: CreateShiftData,
  userId: string
): { success: boolean; shift?: Shift; error?: string } {
  try {
    const db = getDatabase()
    const id = generateId()
    const username = getUsername(userId)

    const sortOrder = data.sort_order ?? (() => {
      const row = db.prepare(
        'SELECT MAX(sort_order) as max_order FROM shifts WHERE deleted_at IS NULL'
      ).get() as { max_order: number | null }
      return (row.max_order ?? -1) + 1
    })()

    db.prepare(`
      INSERT INTO shifts (id, name, sort_order, created_by)
      VALUES (?, ?, ?, ?)
    `).run(id, data.name, sortOrder, userId)

    const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(id) as Shift

    logAudit('SHIFT_CREATE', userId, username, 'shift', id, { name: data.name })

    return { success: true, shift }
  } catch (error: any) {
    console.error('Error creating shift:', error)
    return { success: false, error: error.message }
  }
}

export function updateShift(
  id: string,
  data: UpdateShiftData,
  userId: string
): { success: boolean; error?: string } {
  try {
    const db = getDatabase()
    const username = getUsername(userId)

    const sets: string[] = []
    const params: unknown[] = []

    if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name) }
    if (data.sort_order !== undefined) { sets.push('sort_order = ?'); params.push(data.sort_order) }

    if (sets.length === 0) return { success: true }

    sets.push("updated_at = datetime('now')")
    params.push(id)

    db.prepare(`UPDATE shifts SET ${sets.join(', ')} WHERE id = ?`).run(...params)

    logAudit('SHIFT_UPDATE', userId, username, 'shift', id, data)

    return { success: true }
  } catch (error: any) {
    console.error('Error updating shift:', error)
    return { success: false, error: error.message }
  }
}

export function deleteShift(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  try {
    const db = getDatabase()
    const username = getUsername(userId)

    // Check if users are still assigned to this shift
    const assignedCount = db.prepare(
      'SELECT COUNT(*) as cnt FROM users WHERE shift_id = ? AND is_active = 1'
    ).get(id) as { cnt: number }

    if (assignedCount.cnt > 0) {
      return { success: false, error: `Cannot delete shift: ${assignedCount.cnt} user(s) are still assigned to it` }
    }

    // Soft delete
    db.prepare(
      "UPDATE shifts SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
    ).run(id)

    logAudit('SHIFT_DELETE', userId, username, 'shift', id, null)

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting shift:', error)
    return { success: false, error: error.message }
  }
}

export function getAllShifts(includeDeleted = false): Shift[] {
  const db = getDatabase()
  const where = includeDeleted ? '' : 'WHERE deleted_at IS NULL'
  return db.prepare(
    `SELECT * FROM shifts ${where} ORDER BY sort_order ASC, name ASC`
  ).all() as Shift[]
}

// ===== Conditions CRUD =====

export function createCondition(
  data: CreateConditionData,
  userId: string
): { success: boolean; condition?: AttendanceCondition; error?: string } {
  try {
    const db = getDatabase()
    const id = generateId()
    const username = getUsername(userId)

    // Get max sort_order if not provided
    const sortOrder = data.sort_order ?? (() => {
      const row = db.prepare(
        'SELECT MAX(sort_order) as max_order FROM attendance_conditions WHERE deleted_at IS NULL'
      ).get() as { max_order: number | null }
      return (row.max_order ?? -1) + 1
    })()

    // Auto-assign display_number = max(display_number) + 1
    const displayNumber = data.display_number ?? (() => {
      const row = db.prepare(
        'SELECT MAX(display_number) as max_num FROM attendance_conditions WHERE deleted_at IS NULL'
      ).get() as { max_num: number | null }
      return (row.max_num ?? 0) + 1
    })()

    db.prepare(`
      INSERT INTO attendance_conditions (id, name, color, sort_order, display_number, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.name, data.color, sortOrder, displayNumber, userId)

    const condition = db.prepare(
      'SELECT * FROM attendance_conditions WHERE id = ?'
    ).get(id) as AttendanceCondition

    logAudit('ATTENDANCE_CONDITION_CREATE', userId, username, 'attendance_condition', id, {
      name: data.name,
      color: data.color
    })

    return { success: true, condition }
  } catch (error: any) {
    console.error('Error creating attendance condition:', error)
    return { success: false, error: error.message }
  }
}

export function updateCondition(
  id: string,
  data: UpdateConditionData,
  userId: string
): { success: boolean; error?: string } {
  try {
    const db = getDatabase()
    const username = getUsername(userId)

    const sets: string[] = []
    const params: unknown[] = []

    if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name) }
    if (data.color !== undefined) { sets.push('color = ?'); params.push(data.color) }
    if (data.sort_order !== undefined) { sets.push('sort_order = ?'); params.push(data.sort_order) }
    if (data.display_number !== undefined) { sets.push('display_number = ?'); params.push(data.display_number) }

    if (sets.length === 0) return { success: true }

    sets.push("updated_at = datetime('now')")
    params.push(id)

    db.prepare(`UPDATE attendance_conditions SET ${sets.join(', ')} WHERE id = ?`).run(...params)

    logAudit('ATTENDANCE_CONDITION_UPDATE', userId, username, 'attendance_condition', id, data)

    return { success: true }
  } catch (error: any) {
    console.error('Error updating attendance condition:', error)
    return { success: false, error: error.message }
  }
}

export function deleteCondition(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  try {
    const db = getDatabase()
    const username = getUsername(userId)

    // Soft delete
    db.prepare(
      "UPDATE attendance_conditions SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
    ).run(id)

    logAudit('ATTENDANCE_CONDITION_DELETE', userId, username, 'attendance_condition', id, null)

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting attendance condition:', error)
    return { success: false, error: error.message }
  }
}

export function getAllConditions(includeDeleted = false): AttendanceCondition[] {
  const db = getDatabase()
  const where = includeDeleted ? '' : 'WHERE deleted_at IS NULL'
  return db.prepare(
    `SELECT * FROM attendance_conditions ${where} ORDER BY sort_order ASC, name ASC`
  ).all() as AttendanceCondition[]
}

export function getConditionById(id: string): AttendanceCondition | null {
  const db = getDatabase()
  return (db.prepare('SELECT * FROM attendance_conditions WHERE id = ?').get(id) as AttendanceCondition) || null
}

// ===== Entry CRUD =====

export function saveEntry(
  data: SaveEntryData,
  userId: string
): { success: boolean; entry?: AttendanceEntry; error?: string } {
  try {
    const db = getDatabase()
    const username = getUsername(userId)

    // Parse date parts
    const dateParts = data.entry_date.split('-')
    const year = parseInt(dateParts[0])
    const month = parseInt(dateParts[1])
    const day = parseInt(dateParts[2])

    // Check year editability
    if (!isYearEditable(year)) {
      return { success: false, error: 'Past year data is read-only' }
    }

    db.transaction(() => {
      // Check if entry exists
      const existing = db.prepare(
        'SELECT id FROM attendance_entries WHERE user_id = ? AND entry_date = ?'
      ).get(data.user_id, data.entry_date) as { id: string } | undefined

      let entryId: string

      if (existing) {
        entryId = existing.id
        // Update existing entry
        db.prepare(`
          UPDATE attendance_entries
          SET shift_id = ?, note = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(data.shift_id, data.note || null, entryId)

        // Remove old conditions
        db.prepare('DELETE FROM attendance_entry_conditions WHERE entry_id = ?').run(entryId)
      } else {
        entryId = generateId()
        db.prepare(`
          INSERT INTO attendance_entries (id, user_id, entry_date, year, month, day, shift_id, note, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(entryId, data.user_id, data.entry_date, year, month, day, data.shift_id, data.note || null, userId)
      }

      // Insert conditions
      const insertCondition = db.prepare(
        'INSERT INTO attendance_entry_conditions (entry_id, condition_id) VALUES (?, ?)'
      )
      for (const conditionId of data.condition_ids) {
        insertCondition.run(entryId, conditionId)
      }
    })()

    const entry = getEntry(data.user_id, data.entry_date)

    logAudit('ATTENDANCE_ENTRY_SAVE', userId, username, 'attendance_entry', entry?.id || null, {
      user_id: data.user_id,
      entry_date: data.entry_date,
      shift_id: data.shift_id,
      conditions: data.condition_ids
    })

    return { success: true, entry: entry || undefined }
  } catch (error: any) {
    console.error('Error saving attendance entry:', error)
    return { success: false, error: error.message }
  }
}

export interface BulkSaveEntryData {
  shift_id: string
  entry_date: string
  condition_ids: string[]
  note?: string
  exclude_user_ids?: string[]
}

export function saveBulkEntries(
  data: BulkSaveEntryData,
  userId: string
): { success: boolean; count?: number; error?: string } {
  try {
    const db = getDatabase()
    const username = getUsername(userId)

    // Parse date parts
    const dateParts = data.entry_date.split('-')
    const year = parseInt(dateParts[0])
    const month = parseInt(dateParts[1])
    const day = parseInt(dateParts[2])

    if (!isYearEditable(year)) {
      return { success: false, error: 'Past year data is read-only' }
    }

    // Get all active users in this shift
    const usersInShift = db.prepare(
      'SELECT id FROM users WHERE shift_id = ? AND is_active = 1'
    ).all(data.shift_id) as { id: string }[]

    const excludeSet = new Set(data.exclude_user_ids || [])
    const targetUsers = usersInShift.filter(u => !excludeSet.has(u.id))

    let count = 0

    db.transaction(() => {
      for (const targetUser of targetUsers) {
        // Check if entry exists
        const existing = db.prepare(
          'SELECT id FROM attendance_entries WHERE user_id = ? AND entry_date = ?'
        ).get(targetUser.id, data.entry_date) as { id: string } | undefined

        let entryId: string

        if (existing) {
          entryId = existing.id
          db.prepare(`
            UPDATE attendance_entries
            SET shift_id = ?, note = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(data.shift_id, data.note || null, entryId)

          db.prepare('DELETE FROM attendance_entry_conditions WHERE entry_id = ?').run(entryId)
        } else {
          entryId = generateId()
          db.prepare(`
            INSERT INTO attendance_entries (id, user_id, entry_date, year, month, day, shift_id, note, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(entryId, targetUser.id, data.entry_date, year, month, day, data.shift_id, data.note || null, userId)
        }

        const insertCondition = db.prepare(
          'INSERT INTO attendance_entry_conditions (entry_id, condition_id) VALUES (?, ?)'
        )
        for (const conditionId of data.condition_ids) {
          insertCondition.run(entryId, conditionId)
        }

        count++
      }
    })()

    logAudit('ATTENDANCE_ENTRY_SAVE', userId, username, 'attendance_entry', null, {
      type: 'bulk',
      shift_id: data.shift_id,
      entry_date: data.entry_date,
      conditions: data.condition_ids,
      user_count: count
    })

    return { success: true, count }
  } catch (error: any) {
    console.error('Error saving bulk attendance entries:', error)
    return { success: false, error: error.message }
  }
}

export function deleteEntry(
  entryId: string,
  userId: string
): { success: boolean; error?: string } {
  try {
    const db = getDatabase()
    const username = getUsername(userId)

    // Get entry to check year
    const entry = db.prepare('SELECT * FROM attendance_entries WHERE id = ?').get(entryId) as any | undefined
    if (!entry) return { success: false, error: 'Entry not found' }

    if (!isYearEditable(entry.year)) {
      return { success: false, error: 'Past year data is read-only' }
    }

    // Junction rows cascade delete
    db.prepare('DELETE FROM attendance_entries WHERE id = ?').run(entryId)

    logAudit('ATTENDANCE_ENTRY_DELETE', userId, username, 'attendance_entry', entryId, {
      user_id: entry.user_id,
      entry_date: entry.entry_date
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting attendance entry:', error)
    return { success: false, error: error.message }
  }
}

export function getEntry(userId: string, entryDate: string): AttendanceEntry | null {
  const db = getDatabase()
  const entry = db.prepare(`
    SELECT ae.*, u.display_name as user_display_name, s.name as shift_name
    FROM attendance_entries ae
    LEFT JOIN users u ON u.id = ae.user_id
    LEFT JOIN shifts s ON s.id = ae.shift_id
    WHERE ae.user_id = ? AND ae.entry_date = ?
  `).get(userId, entryDate) as (AttendanceEntry & { user_display_name: string }) | undefined

  if (!entry) return null

  // Load conditions
  const conditions = db.prepare(`
    SELECT ac.* FROM attendance_conditions ac
    INNER JOIN attendance_entry_conditions aec ON aec.condition_id = ac.id
    WHERE aec.entry_id = ?
    ORDER BY ac.sort_order ASC
  `).all(entry.id) as AttendanceCondition[]

  return { ...entry, conditions }
}

export function getEntriesForYear(filters: AttendanceFilters): AttendanceEntry[] {
  const db = getDatabase()

  const conditions: string[] = ['ae.year = ?']
  const params: unknown[] = [filters.year]

  if (filters.user_id) {
    conditions.push('ae.user_id = ?')
    params.push(filters.user_id)
  }
  if (filters.month) {
    conditions.push('ae.month = ?')
    params.push(filters.month)
  }
  if (filters.shift_id) {
    conditions.push('ae.shift_id = ?')
    params.push(filters.shift_id)
  }

  let query = `
    SELECT ae.*, u.display_name as user_display_name, s.name as shift_name
    FROM attendance_entries ae
    LEFT JOIN users u ON u.id = ae.user_id
    LEFT JOIN shifts s ON s.id = ae.shift_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY ae.entry_date ASC
  `

  // If filtering by condition, join through junction table
  if (filters.condition_id) {
    query = `
      SELECT DISTINCT ae.*, u.display_name as user_display_name, s.name as shift_name
      FROM attendance_entries ae
      LEFT JOIN users u ON u.id = ae.user_id
      LEFT JOIN shifts s ON s.id = ae.shift_id
      INNER JOIN attendance_entry_conditions aec ON aec.entry_id = ae.id
      WHERE ${conditions.join(' AND ')} AND aec.condition_id = ?
      ORDER BY ae.entry_date ASC
    `
    params.push(filters.condition_id)
  }

  const entries = db.prepare(query).all(...params) as AttendanceEntry[]

  // Batch load conditions for all entries
  if (entries.length > 0) {
    const entryIds = entries.map(e => e.id)
    const placeholders = entryIds.map(() => '?').join(',')
    const allConditions = db.prepare(`
      SELECT aec.entry_id, ac.*
      FROM attendance_entry_conditions aec
      INNER JOIN attendance_conditions ac ON ac.id = aec.condition_id
      WHERE aec.entry_id IN (${placeholders})
      ORDER BY ac.sort_order ASC
    `).all(...entryIds) as (AttendanceCondition & { entry_id: string })[]

    const conditionMap = new Map<string, AttendanceCondition[]>()
    for (const c of allConditions) {
      const list = conditionMap.get(c.entry_id) || []
      list.push(c)
      conditionMap.set(c.entry_id, list)
    }

    for (const entry of entries) {
      entry.conditions = conditionMap.get(entry.id) || []
    }
  }

  return entries
}

export function getEntriesForMonth(userId: string, year: number, month: number): AttendanceEntry[] {
  return getEntriesForYear({ user_id: userId, year, month })
}

// ===== Summary =====

export function getSummaryForYear(userId: string, year: number): AttendanceSummary {
  const db = getDatabase()

  const user = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId) as { display_name: string } | undefined

  const entries = db.prepare(`
    SELECT ae.id, ae.shift_id, s.name as shift_name
    FROM attendance_entries ae
    LEFT JOIN shifts s ON s.id = ae.shift_id
    WHERE ae.user_id = ? AND ae.year = ?
  `).all(userId, year) as { id: string; shift_id: string | null; shift_name: string | null }[]

  // Condition totals
  const conditionTotals: Record<string, number> = {}
  if (entries.length > 0) {
    const entryIds = entries.map(e => e.id)
    const placeholders = entryIds.map(() => '?').join(',')
    const condCounts = db.prepare(`
      SELECT aec.condition_id, COUNT(*) as cnt
      FROM attendance_entry_conditions aec
      WHERE aec.entry_id IN (${placeholders})
      GROUP BY aec.condition_id
    `).all(...entryIds) as { condition_id: string; cnt: number }[]

    for (const cc of condCounts) {
      conditionTotals[cc.condition_id] = cc.cnt
    }
  }

  // Shift totals — keyed by shift_id
  const shiftTotals: Record<string, number> = {}
  for (const e of entries) {
    const key = e.shift_id || 'unassigned'
    shiftTotals[key] = (shiftTotals[key] || 0) + 1
  }

  return {
    user_id: userId,
    user_display_name: user?.display_name || 'Unknown',
    year,
    condition_totals: conditionTotals,
    total_entries: entries.length,
    shift_totals: shiftTotals
  }
}

export function getAllSummariesForYear(year: number): AttendanceSummary[] {
  const db = getDatabase()
  const users = db.prepare(
    'SELECT id FROM users WHERE is_active = 1 ORDER BY display_name ASC'
  ).all() as { id: string }[]

  return users.map(u => getSummaryForYear(u.id, year))
}

// ===== Year management =====

export function getAvailableYears(): number[] {
  const db = getDatabase()
  const rows = db.prepare(
    'SELECT DISTINCT year FROM attendance_entries ORDER BY year DESC'
  ).all() as { year: number }[]

  const years = rows.map(r => r.year)
  const currentYear = new Date().getFullYear()
  if (!years.includes(currentYear)) {
    years.unshift(currentYear)
  }
  return years.sort((a, b) => b - a)
}

export function isYearEditable(year: number): boolean {
  return year === new Date().getFullYear()
}
