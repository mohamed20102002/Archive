import { getDatabase, getAuditDatabase, getDataPath } from '../database/connection'
import { logAudit } from '../database/audit'
import { generateId } from '../utils/crypto'
import { getUsername } from './auth.service'
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

// Get ISO week number (Monday-based, standard week numbering)
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  // Set to nearest Thursday (ISO week starts Monday)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  // Get first day of the year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  // Calculate week number
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return weekNumber
}

// Format date for display
function formatDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[date.getMonth()]} ${date.getDate()}`
}

// Get default date range info (current week Monday-Sunday)
export function getWeekInfo(): WeekInfo {
  const now = new Date()

  // Get Monday of current week
  const monday = new Date(now)
  const day = monday.getDay()
  const diff = day === 0 ? -6 : 1 - day // Adjust for Sunday
  monday.setDate(monday.getDate() + diff)
  monday.setHours(0, 0, 0, 0)

  // Get Sunday of current week
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const weekNumber = getWeekNumber(monday)
  const year = monday.getFullYear()

  return {
    weekNumber,
    year,
    startDate: monday.toISOString(),
    endDate: sunday.toISOString(),
    displayText: `Week ${weekNumber}: ${formatDate(monday)} - ${formatDate(sunday)}, ${year}`
  }
}

export function getHandoverRecords(startDate: string, endDate: string): HandoverRecord[] {
  const auditDb = getAuditDatabase()
  const mainDb = getDatabase()

  // Query records directly from the records table for the date range
  // This ensures we get ALL records including email-type records
  // Filter by record_date (the date the record is associated with)
  // Filter out deleted records and records from deleted topics
  const startDateOnly = startDate.split('T')[0]
  const endDateOnly = endDate.split('T')[0]

  const records = mainDb.prepare(`
    SELECT
      r.id,
      r.title,
      r.content,
      r.type,
      r.email_id,
      r.subcategory_id,
      r.record_date,
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
        COALESCE(r.record_date, date(r.created_at)) BETWEEN ? AND ?
      )
    ORDER BY COALESCE(r.record_date, date(r.created_at)) DESC, r.updated_at DESC
  `).all(startDateOnly, endDateOnly) as Array<{
    id: string
    title: string
    content: string | null
    type: string
    email_id: string | null
    subcategory_id: string | null
    record_date: string | null
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
      try {
        fs.unlinkSync(existing.file_path)
      } catch (err: any) {
        if (err.code === 'EBUSY') {
          return {
            success: false,
            error: 'The existing handover file is open in another program. Please close it and try again.'
          }
        }
        throw err
      }
    }
    // Delete from database
    db.prepare('DELETE FROM handovers WHERE id = ?').run(existing.id)
  }

  try {
    const handoversDir = ensureHandoversDirectory()
    // Format dates for filename: YYMMDD_YYMMDD
    const startDate = new Date(weekInfo.startDate)
    const endDate = new Date(weekInfo.endDate)
    const formatDateForFilename = (d: Date) => {
      const yy = String(d.getFullYear()).slice(-2)
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${yy}${mm}${dd}`
    }
    const fileName = `shift_handover_${formatDateForFilename(startDate)}_${formatDateForFilename(endDate)}.docx`
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
            text: 'Shift Handover Report',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER
          }),
          new Paragraph({
            text: `${formatDate(startDate)} - ${formatDate(endDate)}, ${startDate.getFullYear()}`,
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
