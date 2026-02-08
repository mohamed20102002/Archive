import { getDatabase, getAuditDatabase, getDataPath } from '../database/connection'
import { logAudit } from '../database/audit'
import { generateId } from '../utils/crypto'
import { getUsername } from './auth.service'
import { getSetting } from './settings.service'
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType, HeadingLevel, ExternalHyperlink } from 'docx'
import { getEmailsPath } from '../database/connection'
import * as fs from 'fs'
import * as path from 'path'
import { shell } from 'electron'

export interface HandoverRecord {
  record_id: string
  editor: string
  action: string
  timestamp: string
  title: string
  content: string | null
  type: string
  email_id: string | null
  topic_title: string
  topic_id: string
  email_path: string | null
  subcategory_id: string | null
  subcategory_title: string | null
}

export interface Handover {
  id: string
  week_number: number
  year: number
  start_date: string
  end_date: string
  file_path: string
  record_count: number
  created_by: string
  created_at: string
  creator_name?: string
}

export interface WeekInfo {
  weekNumber: number
  year: number
  startDate: string
  endDate: string
  displayText: string
}

// Get the configured week start day (0 = Sunday, 1 = Monday, etc.)
function getConfiguredStartDay(): number {
  const setting = getSetting('handover_start_day')
  return setting !== null ? Number(setting) : 1 // Default to Monday
}

// Get the week number for a given date based on configured start day
function getShiftNumber(date: Date): number {
  const startDay = getConfiguredStartDay()
  const startOfYear = new Date(date.getFullYear(), 0, 1)
  let weekCount = 0
  const current = new Date(startOfYear)

  while (current <= date) {
    if (current.getDay() === startDay) weekCount++
    current.setDate(current.getDate() + 1)
  }
  return weekCount
}

// Get the start day of the week containing the given date (based on configured start day)
function getWeekStart(date: Date): Date {
  const startDay = getConfiguredStartDay()
  const d = new Date(date)
  const currentDay = d.getDay()

  // Calculate days to go back to reach the start day
  let daysToGoBack = currentDay - startDay
  if (daysToGoBack < 0) daysToGoBack += 7

  d.setDate(d.getDate() - daysToGoBack)
  d.setHours(0, 0, 0, 0)
  return d
}

// Get the end day of the week containing the given date (day before the next week start)
function getWeekEnd(date: Date): Date {
  const weekStart = getWeekStart(date)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  return weekEnd
}

// Format date for display
function formatDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[date.getMonth()]} ${date.getDate()}`
}

export function getWeekInfo(offsetWeeks: number = 0): WeekInfo {
  const now = new Date()
  now.setDate(now.getDate() + (offsetWeeks * 7))

  const weekStart = getWeekStart(now)
  const weekEnd = getWeekEnd(now)
  const weekNumber = getShiftNumber(weekStart)
  const year = weekStart.getFullYear()

  return {
    weekNumber,
    year,
    startDate: weekStart.toISOString(),
    endDate: weekEnd.toISOString(),
    displayText: `Week ${weekNumber}: ${formatDate(weekStart)} - ${formatDate(weekEnd)}, ${year}`
  }
}

export function getHandoverRecords(startDate: string, endDate: string): HandoverRecord[] {
  const auditDb = getAuditDatabase()
  const mainDb = getDatabase()

  // Query records directly from the records table for the date range
  // This ensures we get ALL records including email-type records
  // Filter out deleted records and records from deleted topics
  const records = mainDb.prepare(`
    SELECT
      r.id,
      r.title,
      r.content,
      r.type,
      r.email_id,
      r.subcategory_id,
      r.created_by,
      r.created_at,
      r.updated_at,
      t.title as topic_title,
      t.id as topic_id,
      e.storage_path as email_path,
      u.display_name as creator_name,
      s.title as subcategory_title
    FROM records r
    LEFT JOIN topics t ON r.topic_id = t.id
    LEFT JOIN emails e ON r.email_id = e.id
    LEFT JOIN users u ON r.created_by = u.id
    LEFT JOIN subcategories s ON r.subcategory_id = s.id
    WHERE r.deleted_at IS NULL
      AND (t.deleted_at IS NULL)
      AND (
        (r.created_at BETWEEN ? AND ?)
        OR (r.updated_at BETWEEN ? AND ? AND r.updated_at != r.created_at)
      )
    ORDER BY r.updated_at DESC
  `).all(startDate, endDate, startDate, endDate) as Array<{
    id: string
    title: string
    content: string | null
    type: string
    email_id: string | null
    subcategory_id: string | null
    created_by: string
    created_at: string
    updated_at: string
    topic_title: string | null
    topic_id: string
    email_path: string | null
    creator_name: string | null
    subcategory_title: string | null
  }>

  if (records.length === 0) {
    return []
  }

  // Get editor info from audit log for each record (most recent action)
  const recordIds = records.map(r => r.id)
  const placeholders = recordIds.map(() => '?').join(',')

  const auditEntries = auditDb.prepare(`
    SELECT
      entity_id as record_id,
      username as editor,
      user_id,
      action,
      timestamp
    FROM audit_log
    WHERE entity_type = 'record'
      AND entity_id IN (${placeholders})
      AND action IN ('RECORD_CREATE', 'RECORD_UPDATE')
    ORDER BY timestamp DESC
  `).all(...recordIds) as Array<{
    record_id: string
    editor: string
    user_id: string
    action: string
    timestamp: string
  }>

  // Get display names by user_id (not username) to handle username changes
  const userIds = [...new Set(auditEntries.map(e => e.user_id).filter(Boolean))]
  const userIdToDisplayName = new Map<string, string>()

  if (userIds.length > 0) {
    const userPlaceholders = userIds.map(() => '?').join(',')
    const users = mainDb.prepare(`
      SELECT id, display_name FROM users WHERE id IN (${userPlaceholders})
    `).all(...userIds) as Array<{ id: string; display_name: string }>

    for (const user of users) {
      userIdToDisplayName.set(user.id, user.display_name)
    }
  }

  // Create a map of record_id to most recent editor info
  const editorMap = new Map<string, { userId: string; displayName: string; action: string; timestamp: string }>()
  for (const entry of auditEntries) {
    if (!editorMap.has(entry.record_id)) {
      // Look up by user_id to get current display_name
      const displayName = userIdToDisplayName.get(entry.user_id) || entry.editor || 'Unknown'
      editorMap.set(entry.record_id, {
        userId: entry.user_id,
        displayName,
        action: entry.action,
        timestamp: entry.timestamp
      })
    }
  }

  // Build the result - always use current display_name for editor
  return records.map(record => {
    const auditInfo = editorMap.get(record.id)

    return {
      record_id: record.id,
      editor: auditInfo?.displayName || record.creator_name || 'Unknown',
      action: auditInfo?.action || 'RECORD_CREATE',
      timestamp: auditInfo?.timestamp || record.updated_at,
      title: record.title,
      content: record.content,
      type: record.type,
      email_id: record.email_id,
      topic_title: record.topic_title || 'Unknown Topic',
      topic_id: record.topic_id,
      email_path: record.email_path,
      subcategory_id: record.subcategory_id,
      subcategory_title: record.subcategory_title
    }
  })
}

export function getHandoverSummary(records: HandoverRecord[]): {
  recordCount: number
  editors: string[]
  topics: Array<{ id: string; title: string }>
} {
  const editors = [...new Set(records.map(r => r.editor))]
  const topicMap = new Map<string, string>()

  for (const record of records) {
    if (!topicMap.has(record.topic_id)) {
      topicMap.set(record.topic_id, record.topic_title)
    }
  }

  const topics = Array.from(topicMap.entries()).map(([id, title]) => ({ id, title }))

  return {
    recordCount: records.length,
    editors,
    topics
  }
}

function ensureHandoversDirectory(): string {
  const handoversPath = path.join(getDataPath(), 'handovers')
  if (!fs.existsSync(handoversPath)) {
    fs.mkdirSync(handoversPath, { recursive: true })
  }
  return handoversPath
}

// Check if a handover already exists for the given week/year
export function checkExistingHandover(weekNumber: number, year: number): Handover | null {
  const db = getDatabase()
  const existing = db.prepare(`
    SELECT h.*, u.display_name as creator_name
    FROM handovers h
    LEFT JOIN users u ON h.created_by = u.id
    WHERE h.week_number = ? AND h.year = ?
  `).get(weekNumber, year) as Handover | undefined

  return existing || null
}

export async function exportToWord(
  records: HandoverRecord[],
  weekInfo: WeekInfo,
  userId: string,
  replaceExisting: boolean = false
): Promise<{ success: boolean; handover?: Handover; error?: string; existingHandover?: Handover }> {
  const db = getDatabase()

  // Check for existing handover
  const existing = checkExistingHandover(weekInfo.weekNumber, weekInfo.year)
  if (existing && !replaceExisting) {
    return {
      success: false,
      error: 'HANDOVER_EXISTS',
      existingHandover: existing
    }
  }

  // If replacing, delete the old one first
  if (existing && replaceExisting) {
    // Delete old file
    if (fs.existsSync(existing.file_path)) {
      fs.unlinkSync(existing.file_path)
    }
    // Delete from database
    db.prepare('DELETE FROM handovers WHERE id = ?').run(existing.id)
  }

  try {
    const handoversDir = ensureHandoversDirectory()
    const fileName = `Shift ${weekInfo.weekNumber} - ${weekInfo.year}.docx`
    const filePath = path.join(handoversDir, fileName)

    // Create table rows
    const headerRow = new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Title', bold: true })] })],
          width: { size: 20, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Description', bold: true })] })],
          width: { size: 35, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Topic', bold: true })] })],
          width: { size: 15, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Editor', bold: true })] })],
          width: { size: 15, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: 'Hyperlink', bold: true })] })],
          width: { size: 15, type: WidthType.PERCENTAGE }
        })
      ],
      tableHeader: true
    })

    const dataRows = records.map(record => {
      // Build the full email file path for hyperlink
      let hyperlinkCell: Paragraph
      if (record.email_path) {
        const fullEmailPath = path.join(getEmailsPath(), record.email_path, 'email.msg')
        const fileUrl = `file:///${fullEmailPath.replace(/\\/g, '/')}`

        hyperlinkCell = new Paragraph({
          children: [
            new ExternalHyperlink({
              children: [
                new TextRun({
                  text: 'Open Email',
                  style: 'Hyperlink'
                })
              ],
              link: fileUrl
            })
          ]
        })
      } else {
        hyperlinkCell = new Paragraph({ text: '' })
      }

      return new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: record.title })]
          }),
          new TableCell({
            children: [new Paragraph({ text: record.content || '' })]
          }),
          new TableCell({
            children: [new Paragraph({ text: record.topic_title })]
          }),
          new TableCell({
            children: [new Paragraph({ text: record.editor })]
          }),
          new TableCell({
            children: [hyperlinkCell]
          })
        ]
      })
    })

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: `Shift Handover - Shift ${weekInfo.weekNumber}`,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER
          }),
          new Paragraph({
            text: weekInfo.displayText,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),
          new Paragraph({
            text: `Total Records: ${records.length}`,
            spacing: { after: 200 }
          }),
          new Table({
            rows: [headerRow, ...dataRows],
            width: { size: 100, type: WidthType.PERCENTAGE }
          })
        ]
      }]
    })

    const buffer = await Packer.toBuffer(doc)
    fs.writeFileSync(filePath, buffer)

    // Save handover metadata to database
    const id = generateId()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO handovers (
        id, week_number, year, start_date, end_date,
        file_path, record_count, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      weekInfo.weekNumber,
      weekInfo.year,
      weekInfo.startDate,
      weekInfo.endDate,
      filePath,
      records.length,
      userId,
      now
    )

    const handover: Handover = {
      id,
      week_number: weekInfo.weekNumber,
      year: weekInfo.year,
      start_date: weekInfo.startDate,
      end_date: weekInfo.endDate,
      file_path: filePath,
      record_count: records.length,
      created_by: userId,
      created_at: now
    }

    logAudit(
      'HANDOVER_EXPORT' as any,
      userId,
      getUsername(userId),
      'handover',
      id,
      { week_number: weekInfo.weekNumber, year: weekInfo.year, record_count: records.length }
    )

    return { success: true, handover }
  } catch (error) {
    console.error('Error exporting handover:', error)
    return { success: false, error: 'Failed to export handover to Word' }
  }
}

export function getHandoverArchives(): Handover[] {
  const db = getDatabase()

  const handovers = db.prepare(`
    SELECT
      h.*,
      u.display_name as creator_name
    FROM handovers h
    LEFT JOIN users u ON h.created_by = u.id
    ORDER BY h.created_at DESC
  `).all() as Handover[]

  return handovers
}

export function deleteHandoverArchive(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  const db = getDatabase()

  const handover = db.prepare('SELECT * FROM handovers WHERE id = ?').get(id) as Handover | undefined

  if (!handover) {
    return { success: false, error: 'Handover not found' }
  }

  try {
    // Delete the file if it exists
    if (fs.existsSync(handover.file_path)) {
      fs.unlinkSync(handover.file_path)
    }

    // Delete from database
    db.prepare('DELETE FROM handovers WHERE id = ?').run(id)

    logAudit(
      'HANDOVER_DELETE' as any,
      userId,
      getUsername(userId),
      'handover',
      id,
      { week_number: handover.week_number, year: handover.year }
    )

    return { success: true }
  } catch (error) {
    console.error('Error deleting handover:', error)
    return { success: false, error: 'Failed to delete handover' }
  }
}

export async function openHandoverFile(id: string): Promise<{ success: boolean; error?: string }> {
  const db = getDatabase()

  const handover = db.prepare('SELECT file_path FROM handovers WHERE id = ?').get(id) as { file_path: string } | undefined

  if (!handover) {
    return { success: false, error: 'Handover not found' }
  }

  if (!fs.existsSync(handover.file_path)) {
    return { success: false, error: 'File not found' }
  }

  try {
    await shell.openPath(handover.file_path)
    return { success: true }
  } catch (error) {
    console.error('Error opening handover file:', error)
    return { success: false, error: 'Failed to open file' }
  }
}
