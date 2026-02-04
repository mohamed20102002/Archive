import { logAudit } from '../database/audit'
import { getUsername } from './auth.service'
import * as attendanceService from './attendance.service'
import { BrowserWindow } from 'electron'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildCalendarHtml(
  entries: attendanceService.AttendanceEntry[],
  conditions: attendanceService.AttendanceCondition[],
  year: number
): string {
  const entryMap = new Map<string, attendanceService.AttendanceEntry>()
  for (const entry of entries) {
    entryMap.set(`${entry.month}-${entry.day}`, entry)
  }

  const now = new Date()
  const todayYear = now.getFullYear()
  const todayMonth = now.getMonth() + 1
  const todayDay = now.getDate()

  let html = '<table class="calendar"><thead><tr><th class="month-col">Month</th>'
  for (let d = 1; d <= 31; d++) {
    html += `<th>${d}</th>`
  }
  html += '</tr></thead><tbody>'

  for (let m = 1; m <= 12; m++) {
    const daysInMonth = getDaysInMonth(year, m)
    html += `<tr><td class="month-label">${MONTH_NAMES[m - 1].substring(0, 3)}</td>`

    for (let d = 1; d <= 31; d++) {
      if (d > daysInMonth) {
        html += '<td class="na"></td>'
        continue
      }

      const isToday = year === todayYear && m === todayMonth && d === todayDay
      const entry = entryMap.get(`${m}-${d}`)
      const todayClass = isToday ? ' today' : ''

      if (entry && entry.conditions.length > 0) {
        const primaryColor = entry.conditions[0].color
        const condNumbers = entry.conditions.map(c => c.display_number).join('')
        html += `<td class="entry${todayClass}" style="background-color:${primaryColor}40">${condNumbers}</td>`
      } else {
        html += `<td class="${todayClass.trim()}"></td>`
      }
    }
    html += '</tr>'
  }

  html += '</tbody></table>'
  return html
}

function buildSummaryHtml(
  summary: attendanceService.AttendanceSummary,
  conditions: attendanceService.AttendanceCondition[],
  shifts: attendanceService.Shift[]
): string {
  let html = '<table class="summary"><thead><tr><th>Condition</th><th>Days</th></tr></thead><tbody>'

  for (const cond of conditions) {
    const count = summary.condition_totals[cond.id] || 0
    html += `<tr><td><span class="color-dot" style="background:${cond.color}"></span>${escapeHtml(cond.name)}</td><td class="center">${count}</td></tr>`
  }

  html += `<tr class="total"><td>Total Entries</td><td class="center">${summary.total_entries}</td></tr>`

  // Dynamic shift breakdown
  for (const shift of shifts) {
    const count = summary.shift_totals[shift.id] || 0
    html += `<tr><td>${escapeHtml(shift.name)}</td><td class="center">${count}</td></tr>`
  }

  html += '</tbody></table>'
  return html
}

function buildFullHtml(pages: string[]): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Tahoma, sans-serif; font-size: 7pt; color: #111; }
  .page { page-break-after: always; padding: 12px; }
  .page:last-child { page-break-after: auto; }
  h1 { font-size: 13pt; margin-bottom: 8px; }
  h2 { font-size: 10pt; margin: 8px 0 4px; }
  .shift-info { font-size: 8pt; color: #555; margin-bottom: 6px; }

  .calendar { border-collapse: collapse; width: 100%; }
  .calendar th, .calendar td {
    border: 1px solid #D1D5DB;
    text-align: center;
    padding: 1px;
    width: 24px;
    min-width: 24px;
    height: 22px;
    font-size: 6.5pt;
  }
  .calendar th {
    background: #F3F4F6;
    font-weight: bold;
    font-size: 6.5pt;
  }
  .calendar .month-col { width: 36px; min-width: 36px; }
  .calendar .month-label { font-weight: bold; text-align: center; background: #fff; }
  .calendar .na { background: #E5E7EB; }
  .calendar .entry { font-size: 6.5pt; position: relative; }
  .calendar .today {
    border: 2px solid #3B82F6;
  }

  .summary { border-collapse: collapse; margin-top: 4px; }
  .summary th, .summary td {
    border: 1px solid #E5E7EB;
    padding: 3px 8px;
    font-size: 7.5pt;
    text-align: left;
  }
  .summary th { background: #F3F4F6; font-weight: bold; }
  .summary .center { text-align: center; }
  .summary .total td { font-weight: bold; }
  .color-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 2px;
    margin-right: 4px;
    vertical-align: middle;
  }
</style>
</head>
<body>${pages.join('')}</body>
</html>`
}

async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const win = new BrowserWindow({
    show: false,
    width: 1123,  // A4 landscape ~297mm
    height: 794,  // A4 landscape ~210mm
    webPreferences: {
      offscreen: true
    }
  })

  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    // Small delay to ensure fonts load and rendering completes
    await new Promise(r => setTimeout(r, 500))
    const buffer = await win.webContents.printToPDF({
      landscape: true,
      pageSize: 'A4',
      margins: { top: 0.3, bottom: 0.3, left: 0.3, right: 0.3 },
      printBackground: true
    })
    return Buffer.from(buffer)
  } finally {
    win.destroy()
  }
}

export async function exportYearPdf(
  year: number,
  userId: string
): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
  try {
    const username = getUsername(userId)
    const conditions = attendanceService.getAllConditions()
    const shifts = attendanceService.getAllShifts()
    const summaries = attendanceService.getAllSummariesForYear(year)

    const pages: string[] = []

    for (const summary of summaries) {
      const entries = attendanceService.getEntriesForYear({ user_id: summary.user_id, year })
      const calendarHtml = buildCalendarHtml(entries, conditions, year)
      const summaryHtml = buildSummaryHtml(summary, conditions, shifts)

      // Find user's shift name
      const userShiftId = entries.length > 0 ? entries[0].shift_id : null
      const userShift = userShiftId ? shifts.find(s => s.id === userShiftId) : null
      const shiftInfo = userShift ? `<div class="shift-info">Shift: ${escapeHtml(userShift.name)}</div>` : ''

      pages.push(`<div class="page">
        <h1>${escapeHtml(summary.user_display_name)} - Attendance ${year}</h1>
        ${shiftInfo}
        ${calendarHtml}
        <h2>Summary</h2>
        ${summaryHtml}
      </div>`)
    }

    if (pages.length === 0) {
      pages.push(`<div class="page"><h1>No attendance data for ${year}</h1></div>`)
    }

    const html = buildFullHtml(pages)
    const buffer = await renderHtmlToPdf(html)

    logAudit('ATTENDANCE_PDF_EXPORT', userId, username, 'attendance', null, {
      year,
      type: 'all_users'
    })

    return { success: true, buffer }
  } catch (error: any) {
    console.error('Error exporting attendance PDF:', error)
    return { success: false, error: error.message }
  }
}

export async function exportUserPdf(
  targetUserId: string,
  year: number,
  requestingUserId: string
): Promise<{ success: boolean; buffer?: Buffer; error?: string }> {
  try {
    const username = getUsername(requestingUserId)
    const conditions = attendanceService.getAllConditions()
    const shifts = attendanceService.getAllShifts()
    const summary = attendanceService.getSummaryForYear(targetUserId, year)
    const entries = attendanceService.getEntriesForYear({ user_id: targetUserId, year })

    const calendarHtml = buildCalendarHtml(entries, conditions, year)
    const summaryHtml = buildSummaryHtml(summary, conditions, shifts)

    // Find user's shift name
    const userShiftId = entries.length > 0 ? entries[0].shift_id : null
    const userShift = userShiftId ? shifts.find(s => s.id === userShiftId) : null
    const shiftInfo = userShift ? `<div class="shift-info">Shift: ${escapeHtml(userShift.name)}</div>` : ''

    const page = `<div class="page">
      <h1>${escapeHtml(summary.user_display_name)} - Attendance ${year}</h1>
      ${shiftInfo}
      ${calendarHtml}
      <h2>Summary</h2>
      ${summaryHtml}
    </div>`

    const html = buildFullHtml([page])
    const buffer = await renderHtmlToPdf(html)

    logAudit('ATTENDANCE_PDF_EXPORT', requestingUserId, username, 'attendance', targetUserId, {
      year,
      targetUserId
    })

    return { success: true, buffer }
  } catch (error: any) {
    console.error('Error exporting user attendance PDF:', error)
    return { success: false, error: error.message }
  }
}
