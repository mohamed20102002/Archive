import { getDatabase } from '../database/connection'
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import { app, dialog, BrowserWindow } from 'electron'

export interface ExportOptions {
  format: 'xlsx' | 'csv'
  filename?: string
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_')
}

async function saveWorkbook(workbook: XLSX.WorkBook, defaultFilename: string): Promise<{ success: boolean; filePath?: string; error?: string }> {
  const win = BrowserWindow.getFocusedWindow()
  if (!win) {
    return { success: false, error: 'No active window' }
  }

  const dialogResult = await dialog.showSaveDialog(win, {
    title: 'Export to Excel',
    defaultPath: defaultFilename,
    filters: [
      { name: 'Excel Files', extensions: ['xlsx'] },
      { name: 'CSV Files', extensions: ['csv'] }
    ]
  })

  if (dialogResult.canceled || !dialogResult.filePath) {
    return { success: false, error: 'Export canceled' }
  }

  const filePath = dialogResult.filePath
  const ext = path.extname(filePath).toLowerCase()

  if (ext === '.csv') {
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]])
    fs.writeFileSync(filePath, csv, 'utf8')
  } else {
    XLSX.writeFile(workbook, filePath)
  }

  return { success: true, filePath }
}

export async function exportTopics(): Promise<{ success: boolean; filePath?: string; error?: string }> {
  const db = getDatabase()

  const topics = db.prepare(`
    SELECT
      t.id,
      t.title,
      t.description,
      t.status,
      u.display_name as created_by,
      t.created_at,
      (SELECT COUNT(*) FROM records r WHERE r.topic_id = t.id AND r.deleted_at IS NULL) as record_count,
      (SELECT COUNT(*) FROM subcategories s WHERE s.topic_id = t.id AND s.deleted_at IS NULL) as subcategory_count
    FROM topics t
    LEFT JOIN users u ON u.id = t.created_by
    WHERE t.deleted_at IS NULL
    ORDER BY t.title
  `).all()

  const worksheet = XLSX.utils.json_to_sheet(topics.map((t: any) => ({
    'Title': t.title,
    'Description': t.description || '',
    'Status': t.status || 'active',
    'Records': t.record_count,
    'Subcategories': t.subcategory_count,
    'Created By': t.created_by || '',
    'Created At': t.created_at
  })))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Topics')

  return saveWorkbook(workbook, `Topics_${new Date().toISOString().split('T')[0]}.xlsx`)
}

export async function exportLetters(): Promise<{ success: boolean; filePath?: string; error?: string }> {
  const db = getDatabase()

  const letters = db.prepare(`
    SELECT
      l.letter_id,
      l.letter_type,
      l.subject,
      l.status,
      l.priority,
      l.incoming_number,
      l.outgoing_number,
      l.reference_number,
      a.name as authority_name,
      t.title as topic_title,
      l.letter_date,
      l.due_date,
      u.display_name as created_by,
      l.created_at
    FROM letters l
    LEFT JOIN authorities a ON a.id = l.authority_id
    LEFT JOIN topics t ON t.id = l.topic_id
    LEFT JOIN users u ON u.id = l.created_by
    WHERE l.deleted_at IS NULL
    ORDER BY l.created_at DESC
  `).all()

  const worksheet = XLSX.utils.json_to_sheet(letters.map((l: any) => ({
    'Letter ID': l.letter_id || '',
    'Type': l.letter_type,
    'Subject': l.subject,
    'Status': l.status,
    'Priority': l.priority || 'normal',
    'Incoming #': l.incoming_number || '',
    'Outgoing #': l.outgoing_number || '',
    'Reference #': l.reference_number || '',
    'Authority': l.authority_name || '',
    'Topic': l.topic_title || '',
    'Letter Date': l.letter_date || '',
    'Due Date': l.due_date || '',
    'Created By': l.created_by || '',
    'Created At': l.created_at
  })))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Letters')

  return saveWorkbook(workbook, `Letters_${new Date().toISOString().split('T')[0]}.xlsx`)
}

export async function exportMOMs(): Promise<{ success: boolean; filePath?: string; error?: string }> {
  const db = getDatabase()

  const moms = db.prepare(`
    SELECT
      m.mom_id,
      m.title,
      m.subject,
      m.status,
      m.meeting_date,
      ml.name as location_name,
      u.display_name as created_by,
      m.created_at,
      (SELECT COUNT(*) FROM mom_actions a WHERE a.mom_internal_id = m.id) as action_count,
      (SELECT COUNT(*) FROM mom_actions a WHERE a.mom_internal_id = m.id AND a.status = 'resolved') as resolved_count
    FROM moms m
    LEFT JOIN mom_locations ml ON ml.id = m.location_id
    LEFT JOIN users u ON u.id = m.created_by
    WHERE m.deleted_at IS NULL
    ORDER BY m.meeting_date DESC
  `).all()

  const worksheet = XLSX.utils.json_to_sheet(moms.map((m: any) => ({
    'MOM ID': m.mom_id || '',
    'Title': m.title,
    'Subject': m.subject || '',
    'Status': m.status,
    'Meeting Date': m.meeting_date || '',
    'Location': m.location_name || '',
    'Actions': m.action_count,
    'Resolved': m.resolved_count,
    'Created By': m.created_by || '',
    'Created At': m.created_at
  })))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'MOMs')

  return saveWorkbook(workbook, `MOMs_${new Date().toISOString().split('T')[0]}.xlsx`)
}

export async function exportIssues(): Promise<{ success: boolean; filePath?: string; error?: string }> {
  const db = getDatabase()

  const issues = db.prepare(`
    SELECT
      i.id,
      i.title,
      i.description,
      i.status,
      i.importance,
      i.reminder_date,
      i.closure_note,
      i.completed_at,
      t.title as topic_title,
      u.display_name as created_by,
      uc.display_name as completed_by_name,
      i.created_at
    FROM issues i
    LEFT JOIN topics t ON t.id = i.topic_id
    LEFT JOIN users u ON u.id = i.created_by
    LEFT JOIN users uc ON uc.id = i.completed_by
    ORDER BY i.created_at DESC
  `).all()

  const worksheet = XLSX.utils.json_to_sheet(issues.map((i: any) => ({
    'Title': i.title,
    'Description': i.description || '',
    'Status': i.status,
    'Importance': i.importance,
    'Topic': i.topic_title || '',
    'Reminder Date': i.reminder_date || '',
    'Created By': i.created_by || '',
    'Created At': i.created_at,
    'Closed By': i.completed_by_name || '',
    'Closed At': i.completed_at || '',
    'Closure Note': i.closure_note || ''
  })))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Issues')

  return saveWorkbook(workbook, `Issues_${new Date().toISOString().split('T')[0]}.xlsx`)
}

export async function exportAttendance(year: number, month?: number): Promise<{ success: boolean; filePath?: string; error?: string }> {
  const db = getDatabase()

  let query = `
    SELECT
      u.display_name as employee_name,
      u.employee_number,
      s.name as shift_name,
      ae.entry_date,
      ae.sign_in_time,
      ae.sign_out_time,
      ae.note,
      GROUP_CONCAT(ac.name, ', ') as conditions
    FROM attendance_entries ae
    JOIN users u ON u.id = ae.user_id
    LEFT JOIN shifts s ON s.id = ae.shift_id
    LEFT JOIN attendance_entry_conditions aec ON aec.entry_id = ae.id
    LEFT JOIN attendance_conditions ac ON ac.id = aec.condition_id
    WHERE ae.year = ?
  `

  const params: any[] = [year]

  if (month !== undefined) {
    query += ' AND ae.month = ?'
    params.push(month)
  }

  query += ' GROUP BY ae.id ORDER BY u.display_name, ae.entry_date'

  const entries = db.prepare(query).all(...params)

  const worksheet = XLSX.utils.json_to_sheet(entries.map((e: any) => ({
    'Employee': e.employee_name,
    'Employee #': e.employee_number || '',
    'Shift': e.shift_name || '',
    'Date': e.entry_date,
    'Sign In': e.sign_in_time || '',
    'Sign Out': e.sign_out_time || '',
    'Conditions': e.conditions || '',
    'Notes': e.note || ''
  })))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance')

  const filename = month !== undefined
    ? `Attendance_${year}_${String(month).padStart(2, '0')}.xlsx`
    : `Attendance_${year}.xlsx`

  return saveWorkbook(workbook, filename)
}

export async function exportSearchResults(results: any[]): Promise<{ success: boolean; filePath?: string; error?: string }> {
  if (!results || results.length === 0) {
    return { success: false, error: 'No results to export' }
  }

  const worksheet = XLSX.utils.json_to_sheet(results.map((r: any) => ({
    'Type': r.type,
    'Title': r.title || r.subject || r.name || '',
    'Description': r.description || r.summary || '',
    'Status': r.status || '',
    'Created At': r.created_at || ''
  })))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Search Results')

  return saveWorkbook(workbook, `SearchResults_${new Date().toISOString().split('T')[0]}.xlsx`)
}

export async function exportRecordsByTopic(topicId: string): Promise<{ success: boolean; filePath?: string; error?: string }> {
  const db = getDatabase()

  const topic = db.prepare('SELECT title FROM topics WHERE id = ?').get(topicId) as { title: string } | undefined
  if (!topic) {
    return { success: false, error: 'Topic not found' }
  }

  const records = db.prepare(`
    SELECT
      r.id,
      r.title,
      r.content,
      r.type,
      r.record_date,
      s.title as subcategory_title,
      u.display_name as created_by,
      r.created_at
    FROM records r
    LEFT JOIN subcategories s ON s.id = r.subcategory_id
    LEFT JOIN users u ON u.id = r.created_by
    WHERE r.topic_id = ? AND r.deleted_at IS NULL
    ORDER BY r.record_date DESC, r.created_at DESC
  `).all(topicId)

  const worksheet = XLSX.utils.json_to_sheet(records.map((r: any) => ({
    'Title': r.title,
    'Content': r.content || '',
    'Type': r.type || 'note',
    'Date': r.record_date || '',
    'Subcategory': r.subcategory_title || '',
    'Created By': r.created_by || '',
    'Created At': r.created_at
  })))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Records')

  return saveWorkbook(workbook, `Records_${sanitizeFilename(topic.title)}_${new Date().toISOString().split('T')[0]}.xlsx`)
}

export async function exportCustomData(data: any[], sheetName: string, filename: string): Promise<{ success: boolean; filePath?: string; error?: string }> {
  if (!data || data.length === 0) {
    return { success: false, error: 'No data to export' }
  }

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  return saveWorkbook(workbook, `${sanitizeFilename(filename)}.xlsx`)
}
