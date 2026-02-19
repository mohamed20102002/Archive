import { randomUUID } from 'crypto'
import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'
import { format, parseISO, startOfDay, getWeek, getWeekOfMonth, isToday, isBefore, startOfToday } from 'date-fns'
import { ar, enUS } from 'date-fns/locale'

// Arabic day names
const ARABIC_DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

// Arabic month names
const ARABIC_MONTH_NAMES = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
]

// Arabic ordinal numbers for week in month
const ARABIC_ORDINALS = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس']

// English ordinal suffixes
function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export interface EmailSchedule {
  id: string
  name: string
  description: string | null
  to_emails: string
  cc_emails: string | null
  subject_template: string
  body_template: string
  frequency_type: 'daily' | 'weekly' | 'monthly'
  frequency_days: string | null // JSON array of day numbers
  send_time: string
  language: 'en' | 'ar'
  is_active: boolean
  last_generated_date: string | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  // Joined fields
  created_by_name?: string
}

export interface EmailScheduleInstance {
  id: string
  schedule_id: string
  scheduled_date: string
  scheduled_time: string
  status: 'pending' | 'sent' | 'dismissed' | 'overdue'
  sent_at: string | null
  dismissed_at: string | null
  dismissed_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Joined fields
  schedule_name?: string
  to_emails?: string
  cc_emails?: string | null
  subject_template?: string
  body_template?: string
  language?: string
  dismissed_by_name?: string
}

export interface CreateEmailScheduleInput {
  name: string
  description?: string
  to_emails: string
  cc_emails?: string
  subject_template: string
  body_template: string
  frequency_type: 'daily' | 'weekly' | 'monthly'
  frequency_days?: number[]
  send_time: string
  language: 'en' | 'ar'
}

export interface UpdateEmailScheduleInput {
  name?: string
  description?: string
  to_emails?: string
  cc_emails?: string
  subject_template?: string
  body_template?: string
  frequency_type?: 'daily' | 'weekly' | 'monthly'
  frequency_days?: number[]
  send_time?: string
  language?: 'en' | 'ar'
  is_active?: boolean
}

// Get settings from database
function getSettings(): { department_name: string; department_name_arabic: string; date_format: string } {
  const db = getDatabase()
  const settings: Record<string, string> = {}
  const rows = db.prepare('SELECT key, value FROM app_settings').all() as { key: string; value: string }[]
  for (const row of rows) {
    settings[row.key] = row.value
  }
  return {
    department_name: settings['department_name'] || '',
    department_name_arabic: settings['department_name_arabic'] || '',
    date_format: settings['date_format'] || 'DD/MM/YYYY'
  }
}

// Get current user info
function getUserInfo(userId: string): { display_name: string; arabic_name: string | null } {
  const db = getDatabase()
  const user = db.prepare('SELECT display_name, arabic_name FROM users WHERE id = ?').get(userId) as { display_name: string; arabic_name: string | null } | undefined
  return user || { display_name: '', arabic_name: null }
}

// Convert date format setting to date-fns format
function convertDateFormat(settingFormat: string): string {
  const formatMap: Record<string, string> = {
    'DD/MM/YYYY': 'dd/MM/yyyy',
    'MM/DD/YYYY': 'MM/dd/yyyy',
    'YYYY-MM-DD': 'yyyy-MM-dd'
  }
  return formatMap[settingFormat] || 'dd/MM/yyyy'
}

// Replace placeholders in text
export function replacePlaceholders(
  text: string,
  date: Date,
  language: 'en' | 'ar',
  userId: string
): string {
  const settings = getSettings()
  const userInfo = getUserInfo(userId)
  const dateFnsFormat = convertDateFormat(settings.date_format)
  const locale = language === 'ar' ? ar : enUS

  const dayOfWeek = date.getDay() // 0 = Sunday
  const month = date.getMonth() // 0 = January
  const weekInYear = getWeek(date, { weekStartsOn: 0 })
  const weekInMonth = getWeekOfMonth(date, { weekStartsOn: 0 })

  const replacements: Record<string, string> = {
    // Date formatted per settings
    '{{date}}': format(date, dateFnsFormat),

    // Arabic date with Arabic numerals
    '{{date_arabic}}': toArabicNumerals(format(date, dateFnsFormat)),

    // Day names
    '{{day_name}}': format(date, 'EEEE', { locale: enUS }),
    '{{day_name_arabic}}': ARABIC_DAY_NAMES[dayOfWeek],

    // Week numbers
    '{{week_number}}': String(weekInYear),
    '{{week_number_arabic}}': toArabicNumerals(String(weekInYear)),
    '{{week_in_month}}': String(weekInMonth),
    '{{week_in_month_arabic}}': toArabicNumerals(String(weekInMonth)),
    '{{week_in_month_ordinal}}': getOrdinalSuffix(weekInMonth),
    '{{week_in_month_ordinal_arabic}}': ARABIC_ORDINALS[weekInMonth] || ARABIC_ORDINALS[5],

    // Month names
    '{{month_name}}': format(date, 'MMMM', { locale: enUS }),
    '{{month_name_arabic}}': ARABIC_MONTH_NAMES[month],

    // Year
    '{{year}}': format(date, 'yyyy'),
    '{{year_arabic}}': toArabicNumerals(format(date, 'yyyy')),

    // Department names
    '{{department_name}}': settings.department_name,
    '{{department_name_arabic}}': settings.department_name_arabic,

    // User names
    '{{user_name}}': userInfo.display_name,
    '{{user_name_arabic}}': userInfo.arabic_name || userInfo.display_name
  }

  let result = text
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(escapeRegExp(placeholder), 'g'), value)
  }

  return result
}

// Convert to Arabic numerals
function toArabicNumerals(str: string): string {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
  return str.replace(/\d/g, (d) => arabicNumerals[parseInt(d)])
}

// Escape special regex characters
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Check if a schedule should run on a given date
function shouldScheduleRunOnDate(schedule: EmailSchedule, date: Date): boolean {
  const dayOfWeek = date.getDay()
  const dayOfMonth = date.getDate()

  switch (schedule.frequency_type) {
    case 'daily':
      return true
    case 'weekly':
      if (!schedule.frequency_days) return false
      const weeklyDays = JSON.parse(schedule.frequency_days) as number[]
      return weeklyDays.includes(dayOfWeek)
    case 'monthly':
      if (!schedule.frequency_days) return false
      const monthlyDays = JSON.parse(schedule.frequency_days) as number[]
      return monthlyDays.includes(dayOfMonth)
    default:
      return false
  }
}

// Create a new email schedule
export function createSchedule(
  data: CreateEmailScheduleInput,
  userId: string
): { success: boolean; schedule?: EmailSchedule; error?: string } {
  try {
    const db = getDatabase()
    const id = randomUUID()
    const now = new Date().toISOString()

    const frequencyDays = data.frequency_days ? JSON.stringify(data.frequency_days) : null

    db.prepare(`
      INSERT INTO email_schedules (
        id, name, description, to_emails, cc_emails, subject_template, body_template,
        frequency_type, frequency_days, send_time, language, is_active, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(
      id,
      data.name,
      data.description || null,
      data.to_emails,
      data.cc_emails || null,
      data.subject_template,
      data.body_template,
      data.frequency_type,
      frequencyDays,
      data.send_time,
      data.language,
      userId,
      now,
      now
    )

    const schedule = getScheduleById(id)

    logAudit('CREATE', userId, '', 'EMAIL_SCHEDULE', id, { name: data.name })

    // Generate today's instance if applicable
    generateInstancesForDate(new Date())

    return { success: true, schedule: schedule || undefined }
  } catch (error) {
    console.error('Error creating email schedule:', error)
    return { success: false, error: String(error) }
  }
}

// Get a schedule by ID
export function getScheduleById(id: string): EmailSchedule | null {
  const db = getDatabase()

  const schedule = db.prepare(`
    SELECT s.*, u.display_name as created_by_name
    FROM email_schedules s
    LEFT JOIN users u ON s.created_by = u.id
    WHERE s.id = ? AND s.deleted_at IS NULL
  `).get(id) as (EmailSchedule & { is_active: number }) | undefined

  if (!schedule) return null

  return {
    ...schedule,
    is_active: Boolean(schedule.is_active)
  }
}

// Get all schedules
export function getAllSchedules(includeInactive = false): EmailSchedule[] {
  const db = getDatabase()

  let query = `
    SELECT s.*, u.display_name as created_by_name
    FROM email_schedules s
    LEFT JOIN users u ON s.created_by = u.id
    WHERE s.deleted_at IS NULL
  `

  if (!includeInactive) {
    query += ' AND s.is_active = 1'
  }

  query += ' ORDER BY s.name ASC'

  const schedules = db.prepare(query).all() as (EmailSchedule & { is_active: number })[]

  return schedules.map(s => ({
    ...s,
    is_active: Boolean(s.is_active)
  }))
}

// Update a schedule
export function updateSchedule(
  id: string,
  data: UpdateEmailScheduleInput,
  userId: string
): { success: boolean; error?: string } {
  try {
    const db = getDatabase()
    const now = new Date().toISOString()

    const existing = getScheduleById(id)
    if (!existing) {
      return { success: false, error: 'Schedule not found' }
    }

    const updates: string[] = []
    const values: any[] = []

    if (data.name !== undefined) {
      updates.push('name = ?')
      values.push(data.name)
    }
    if (data.description !== undefined) {
      updates.push('description = ?')
      values.push(data.description || null)
    }
    if (data.to_emails !== undefined) {
      updates.push('to_emails = ?')
      values.push(data.to_emails)
    }
    if (data.cc_emails !== undefined) {
      updates.push('cc_emails = ?')
      values.push(data.cc_emails || null)
    }
    if (data.subject_template !== undefined) {
      updates.push('subject_template = ?')
      values.push(data.subject_template)
    }
    if (data.body_template !== undefined) {
      updates.push('body_template = ?')
      values.push(data.body_template)
    }
    if (data.frequency_type !== undefined) {
      updates.push('frequency_type = ?')
      values.push(data.frequency_type)
    }
    if (data.frequency_days !== undefined) {
      updates.push('frequency_days = ?')
      values.push(JSON.stringify(data.frequency_days))
    }
    if (data.send_time !== undefined) {
      updates.push('send_time = ?')
      values.push(data.send_time)
    }
    if (data.language !== undefined) {
      updates.push('language = ?')
      values.push(data.language)
    }
    if (data.is_active !== undefined) {
      updates.push('is_active = ?')
      values.push(data.is_active ? 1 : 0)
    }

    updates.push('updated_at = ?')
    values.push(now)
    values.push(id)

    db.prepare(`
      UPDATE email_schedules SET ${updates.join(', ')} WHERE id = ?
    `).run(...values)

    logAudit('UPDATE', userId, '', 'EMAIL_SCHEDULE', id, data)

    // Regenerate today's instance if frequency changed
    if (data.frequency_type !== undefined || data.frequency_days !== undefined || data.is_active !== undefined) {
      generateInstancesForDate(new Date())
    }

    return { success: true }
  } catch (error) {
    console.error('Error updating email schedule:', error)
    return { success: false, error: String(error) }
  }
}

// Delete a schedule (soft delete)
export function deleteSchedule(id: string, userId: string): { success: boolean; error?: string } {
  try {
    const db = getDatabase()
    const now = new Date().toISOString()

    db.prepare(`
      UPDATE email_schedules SET deleted_at = ?, updated_at = ? WHERE id = ?
    `).run(now, now, id)

    logAudit('DELETE', userId, '', 'EMAIL_SCHEDULE', id, {})

    return { success: true }
  } catch (error) {
    console.error('Error deleting email schedule:', error)
    return { success: false, error: String(error) }
  }
}

// Generate instances for a given date
export function generateInstancesForDate(date: Date): number {
  const db = getDatabase()
  const dateStr = format(date, 'yyyy-MM-dd')
  let generated = 0

  // Get all active schedules
  const schedules = getAllSchedules(false)

  for (const schedule of schedules) {
    if (!shouldScheduleRunOnDate(schedule, date)) continue

    // Check if instance already exists
    const existing = db.prepare(`
      SELECT id FROM email_schedule_instances
      WHERE schedule_id = ? AND scheduled_date = ?
    `).get(schedule.id, dateStr)

    if (existing) continue

    // Create instance
    const instanceId = randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO email_schedule_instances (
        id, schedule_id, scheduled_date, scheduled_time, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?)
    `).run(instanceId, schedule.id, dateStr, schedule.send_time, now, now)

    // Update last_generated_date on schedule
    db.prepare(`
      UPDATE email_schedules SET last_generated_date = ?, updated_at = ? WHERE id = ?
    `).run(dateStr, now, schedule.id)

    generated++
  }

  return generated
}

// Update overdue instances
export function updateOverdueInstances(): number {
  const db = getDatabase()
  const today = format(startOfToday(), 'yyyy-MM-dd')
  const now = new Date().toISOString()

  const result = db.prepare(`
    UPDATE email_schedule_instances
    SET status = 'overdue', updated_at = ?
    WHERE status = 'pending' AND scheduled_date < ?
  `).run(now, today)

  return result.changes
}

// Get instances for a date range
export function getInstances(
  startDate?: string,
  endDate?: string,
  status?: string
): EmailScheduleInstance[] {
  const db = getDatabase()

  let query = `
    SELECT i.*, s.name as schedule_name, s.to_emails, s.cc_emails,
           s.subject_template, s.body_template, s.language,
           u.display_name as dismissed_by_name
    FROM email_schedule_instances i
    JOIN email_schedules s ON i.schedule_id = s.id
    LEFT JOIN users u ON i.dismissed_by = u.id
    WHERE s.deleted_at IS NULL
  `

  const params: any[] = []

  if (startDate) {
    query += ' AND i.scheduled_date >= ?'
    params.push(startDate)
  }
  if (endDate) {
    query += ' AND i.scheduled_date <= ?'
    params.push(endDate)
  }
  if (status) {
    query += ' AND i.status = ?'
    params.push(status)
  }

  query += ' ORDER BY i.scheduled_date DESC, i.scheduled_time ASC'

  return db.prepare(query).all(...params) as EmailScheduleInstance[]
}

// Get today's pending and overdue instances
export function getTodayInstances(): EmailScheduleInstance[] {
  const today = format(new Date(), 'yyyy-MM-dd')
  return getInstances(undefined, today).filter(
    i => i.status === 'pending' || i.status === 'overdue'
  )
}

// Get pending count for badge
export function getPendingCounts(): { pending: number; overdue: number; total: number } {
  const db = getDatabase()
  const today = format(new Date(), 'yyyy-MM-dd')

  // First update any overdue instances
  updateOverdueInstances()

  const pendingResult = db.prepare(`
    SELECT COUNT(*) as count FROM email_schedule_instances i
    JOIN email_schedules s ON i.schedule_id = s.id
    WHERE s.deleted_at IS NULL AND i.status = 'pending' AND i.scheduled_date = ?
  `).get(today) as { count: number }

  const overdueResult = db.prepare(`
    SELECT COUNT(*) as count FROM email_schedule_instances i
    JOIN email_schedules s ON i.schedule_id = s.id
    WHERE s.deleted_at IS NULL AND i.status = 'overdue'
  `).get() as { count: number }

  return {
    pending: pendingResult.count,
    overdue: overdueResult.count,
    total: pendingResult.count + overdueResult.count
  }
}

// Mark instance as sent
export function markInstanceSent(
  instanceId: string,
  userId: string
): { success: boolean; error?: string } {
  try {
    const db = getDatabase()
    const now = new Date().toISOString()

    db.prepare(`
      UPDATE email_schedule_instances
      SET status = 'sent', sent_at = ?, updated_at = ?
      WHERE id = ?
    `).run(now, now, instanceId)

    logAudit('UPDATE', userId, '', 'EMAIL_SCHEDULE_INSTANCE', instanceId, { action: 'sent' })

    return { success: true }
  } catch (error) {
    console.error('Error marking instance as sent:', error)
    return { success: false, error: String(error) }
  }
}

// Dismiss instance
export function dismissInstance(
  instanceId: string,
  userId: string,
  notes?: string
): { success: boolean; error?: string } {
  try {
    const db = getDatabase()
    const now = new Date().toISOString()

    db.prepare(`
      UPDATE email_schedule_instances
      SET status = 'dismissed', dismissed_at = ?, dismissed_by = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(now, userId, notes || null, now, instanceId)

    logAudit('UPDATE', userId, '', 'EMAIL_SCHEDULE_INSTANCE', instanceId, { action: 'dismissed', notes })

    return { success: true }
  } catch (error) {
    console.error('Error dismissing instance:', error)
    return { success: false, error: String(error) }
  }
}

// Reset instance to pending
export function resetInstance(
  instanceId: string,
  userId: string
): { success: boolean; error?: string } {
  try {
    const db = getDatabase()
    const now = new Date().toISOString()

    db.prepare(`
      UPDATE email_schedule_instances
      SET status = 'pending', sent_at = NULL, dismissed_at = NULL, dismissed_by = NULL, notes = NULL, updated_at = ?
      WHERE id = ?
    `).run(now, instanceId)

    logAudit('UPDATE', userId, '', 'EMAIL_SCHEDULE_INSTANCE', instanceId, { action: 'reset' })

    return { success: true }
  } catch (error) {
    console.error('Error resetting instance:', error)
    return { success: false, error: String(error) }
  }
}

// Get instance by ID with full details
export function getInstanceById(instanceId: string): EmailScheduleInstance | null {
  const db = getDatabase()

  const instance = db.prepare(`
    SELECT i.*, s.name as schedule_name, s.to_emails, s.cc_emails,
           s.subject_template, s.body_template, s.language,
           u.display_name as dismissed_by_name
    FROM email_schedule_instances i
    JOIN email_schedules s ON i.schedule_id = s.id
    LEFT JOIN users u ON i.dismissed_by = u.id
    WHERE i.id = ?
  `).get(instanceId) as EmailScheduleInstance | undefined

  return instance || null
}

// Compose email in Outlook for an instance
export function composeEmailForInstance(
  instanceId: string,
  userId: string
): { success: boolean; subject?: string; body?: string; to?: string; cc?: string; error?: string } {
  const instance = getInstanceById(instanceId)
  if (!instance) {
    return { success: false, error: 'Instance not found' }
  }

  const scheduleDate = parseISO(instance.scheduled_date)
  const language = (instance.language || 'en') as 'en' | 'ar'

  const subject = replacePlaceholders(instance.subject_template || '', scheduleDate, language, userId)
  const body = replacePlaceholders(instance.body_template || '', scheduleDate, language, userId)

  return {
    success: true,
    subject,
    body,
    to: instance.to_emails,
    cc: instance.cc_emails || undefined
  }
}

// Get all history for a schedule
export function getScheduleHistory(scheduleId: string): EmailScheduleInstance[] {
  const db = getDatabase()

  return db.prepare(`
    SELECT i.*, s.name as schedule_name, u.display_name as dismissed_by_name
    FROM email_schedule_instances i
    JOIN email_schedules s ON i.schedule_id = s.id
    LEFT JOIN users u ON i.dismissed_by = u.id
    WHERE i.schedule_id = ?
    ORDER BY i.scheduled_date DESC, i.scheduled_time ASC
  `).all(scheduleId) as EmailScheduleInstance[]
}

// Preview placeholders
export function previewPlaceholders(
  text: string,
  date: string,
  language: 'en' | 'ar',
  userId: string
): string {
  const dateObj = parseISO(date)
  return replacePlaceholders(text, dateObj, language, userId)
}

// Generate missed instances for all dates since last_generated_date up to today
// Called on app startup to recover from days when the app was closed
export function generateMissedInstances(): { generated: number; missedDates: string[] } {
  const db = getDatabase()
  const today = startOfToday()
  const todayStr = format(today, 'yyyy-MM-dd')
  let totalGenerated = 0
  const missedDates: string[] = []

  // Get all active schedules
  const schedules = getAllSchedules(false)

  for (const schedule of schedules) {
    // Determine start date: day after last_generated_date, or schedule creation date
    let startDate: Date

    if (schedule.last_generated_date) {
      // Start from the day after last_generated_date
      const lastGenerated = parseISO(schedule.last_generated_date)
      startDate = new Date(lastGenerated)
      startDate.setDate(startDate.getDate() + 1)
    } else {
      // No instances generated yet - start from creation date
      startDate = startOfDay(parseISO(schedule.created_at))
    }

    // Generate instances for each day from startDate to today (inclusive)
    const currentDate = new Date(startDate)

    while (isBefore(currentDate, today) || format(currentDate, 'yyyy-MM-dd') === todayStr) {
      const dateStr = format(currentDate, 'yyyy-MM-dd')

      // Check if schedule should run on this date
      if (shouldScheduleRunOnDate(schedule, currentDate)) {
        // Check if instance already exists
        const existing = db.prepare(`
          SELECT id FROM email_schedule_instances
          WHERE schedule_id = ? AND scheduled_date = ?
        `).get(schedule.id, dateStr)

        if (!existing) {
          // Create instance
          const instanceId = randomUUID()
          const now = new Date().toISOString()

          // Determine status: if date is before today, it's overdue
          const status = dateStr < todayStr ? 'overdue' : 'pending'

          db.prepare(`
            INSERT INTO email_schedule_instances (
              id, schedule_id, scheduled_date, scheduled_time, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(instanceId, schedule.id, dateStr, schedule.send_time, status, now, now)

          totalGenerated++

          if (status === 'overdue' && !missedDates.includes(dateStr)) {
            missedDates.push(dateStr)
          }
        }
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Update last_generated_date to today
    const now = new Date().toISOString()
    db.prepare(`
      UPDATE email_schedules SET last_generated_date = ?, updated_at = ? WHERE id = ?
    `).run(todayStr, now, schedule.id)
  }

  // Sort missed dates
  missedDates.sort()

  return { generated: totalGenerated, missedDates }
}
