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

// Darken a hex color for better text visibility
function darkenColor(hex: string, percent: number = 40): string {
  // Remove # if present
  hex = hex.replace('#', '')

  // Parse RGB
  let r = parseInt(hex.substring(0, 2), 16)
  let g = parseInt(hex.substring(2, 4), 16)
  let b = parseInt(hex.substring(4, 6), 16)

  // Darken
  r = Math.floor(r * (100 - percent) / 100)
  g = Math.floor(g * (100 - percent) / 100)
  b = Math.floor(b * (100 - percent) / 100)

  // Convert back to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function buildCalendarHtml(
  entries: attendanceService.AttendanceEntry[],
  conditions: attendanceService.AttendanceCondition[],
  year: number
): string {
  // Don't filter ignored conditions from calendar - show all conditions in cells
  const entryMap = new Map<string, attendanceService.AttendanceEntry>()
  for (const entry of entries) {
    if (entry.conditions.length > 0) {
      entryMap.set(`${entry.month}-${entry.day}`, entry)
    }
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
        // Build stacked numbers with darkened colors for visibility
        const numbersHtml = entry.conditions.map(c =>
          `<span style="color:${darkenColor(c.color, 50)};font-weight:bold;">${c.display_number}</span>`
        ).join('<br>')

        let bgStyle: string
        if (entry.conditions.length === 1) {
          bgStyle = `background-color:${entry.conditions[0].color}40`
        } else {
          // Create gradient for multiple conditions
          const stops = entry.conditions.map((c, i) => {
            const start = (i / entry.conditions.length) * 100
            const end = ((i + 1) / entry.conditions.length) * 100
            return `${c.color}40 ${start}%, ${c.color}40 ${end}%`
          }).join(', ')
          bgStyle = `background:linear-gradient(to bottom, ${stops})`
        }
        html += `<td class="entry${todayClass}" style="${bgStyle}">${numbersHtml}</td>`
      } else {
        html += `<td class="${todayClass.trim()}"></td>`
      }
    }
    html += '</tr>'
  }

  html += '</tbody></table>'
  return html
}

function buildLegendHtml(conditions: attendanceService.AttendanceCondition[]): string {
  // Filter out ignored conditions for legend
  const visibleConditions = conditions.filter(c => !c.is_ignored)

  let html = '<div class="legend"><div class="legend-title">Legend</div><div class="legend-items">'

  for (const cond of visibleConditions) {
    html += `<div class="legend-item"><span class="legend-color" style="background:${cond.color}"></span><span class="legend-label">${cond.display_number} - ${escapeHtml(cond.name)}</span></div>`
  }

  // Add N/A and Today indicators
  html += `<div class="legend-item"><span class="legend-color" style="background:#E5E7EB"></span><span class="legend-label">N/A</span></div>`
  html += `<div class="legend-item"><span class="legend-color today-indicator"></span><span class="legend-label">Today</span></div>`

  html += '</div></div>'
  return html
}

function buildSummaryHtml(
  summary: attendanceService.AttendanceSummary,
  conditions: attendanceService.AttendanceCondition[],
  shifts: attendanceService.Shift[]
): string {
  // Filter out ignored conditions
  const visibleConditions = conditions.filter(c => !c.is_ignored)

  let html = '<table class="summary"><thead><tr><th>Condition</th><th>Days</th></tr></thead><tbody>'

  for (const cond of visibleConditions) {
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
  @page { margin: 10mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Arial, Tahoma, sans-serif;
    font-size: 8pt;
    color: #1f2937;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    page-break-after: always;
    padding: 16px;
  }
  .page:last-child { page-break-after: auto; }

  /* Header styling */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 2px solid #e5e7eb;
  }
  .header-left h1 {
    font-size: 16pt;
    font-weight: 700;
    color: #111827;
    margin-bottom: 4px;
  }
  .shift-info {
    font-size: 9pt;
    color: #6b7280;
  }
  .export-date {
    font-size: 8pt;
    color: #9ca3af;
    text-align: right;
  }

  /* Calendar styling */
  .calendar {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  .calendar th, .calendar td {
    border: 1px solid #d1d5db;
    text-align: center;
    vertical-align: middle;
    padding: 2px;
    width: 26px;
    min-width: 26px;
    height: 26px;
    font-size: 7pt;
    line-height: 1.1;
  }
  .calendar th {
    background: linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%);
    font-weight: 600;
    font-size: 7pt;
    color: #374151;
  }
  .calendar .month-col { width: 40px; min-width: 40px; }
  .calendar .month-label {
    font-weight: 600;
    text-align: center;
    background: #fff;
    color: #1f2937;
  }
  .calendar .na { background: #f3f4f6; }
  .calendar .entry {
    font-size: 6.5pt;
    position: relative;
    line-height: 1.2;
  }
  .calendar .entry span {
    display: block;
    font-size: 6pt;
    font-weight: 700;
  }
  .calendar .today {
    border: 2px solid #3b82f6;
    box-shadow: inset 0 0 0 1px #93c5fd;
  }

  /* Legend styling */
  .legend {
    margin: 10px 0;
    padding: 10px;
    background: #f9fafb;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
  }
  .legend-title {
    font-size: 9pt;
    font-weight: 600;
    color: #374151;
    margin-bottom: 8px;
  }
  .legend-items {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 8pt;
    color: #4b5563;
  }
  .legend-color {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .today-indicator {
    background: #fff;
    border: 2px solid #3b82f6;
  }

  /* Bottom section with summary */
  .bottom-section {
    display: flex;
    gap: 20px;
    margin-top: 12px;
  }
  .summary-section {
    flex: 0 0 auto;
  }
  .summary-section h2 {
    font-size: 11pt;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 6px;
  }
  .summary {
    border-collapse: collapse;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  .summary th, .summary td {
    border: 1px solid #e5e7eb;
    padding: 5px 10px;
    font-size: 8pt;
    text-align: left;
  }
  .summary th {
    background: linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%);
    font-weight: 600;
    color: #374151;
  }
  .summary .center { text-align: center; }
  .summary .total td {
    font-weight: 600;
    background: #f9fafb;
  }
  .color-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 3px;
    margin-right: 6px;
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
    const legendHtml = buildLegendHtml(conditions)

    const exportDate = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    for (const summary of summaries) {
      const entries = attendanceService.getEntriesForYear({ user_id: summary.user_id, year })
      const calendarHtml = buildCalendarHtml(entries, conditions, year)
      const summaryHtml = buildSummaryHtml(summary, conditions, shifts)

      // Find user's shift name
      const userShiftId = entries.length > 0 ? entries[0].shift_id : null
      const userShift = userShiftId ? shifts.find(s => s.id === userShiftId) : null
      const shiftInfo = userShift ? `<div class="shift-info">Shift: ${escapeHtml(userShift.name)}</div>` : ''

      pages.push(`<div class="page">
        <div class="header">
          <div class="header-left">
            <h1>${escapeHtml(summary.user_display_name)} - Attendance ${year}</h1>
            ${shiftInfo}
          </div>
          <div class="export-date">Exported: ${exportDate}</div>
        </div>
        ${calendarHtml}
        ${legendHtml}
        <div class="bottom-section">
          <div class="summary-section">
            <h2>Summary</h2>
            ${summaryHtml}
          </div>
        </div>
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
): Promise<{ success: boolean; buffer?: Buffer; userDisplayName?: string; error?: string }> {
  try {
    const username = getUsername(requestingUserId)
    const conditions = attendanceService.getAllConditions()
    const shifts = attendanceService.getAllShifts()
    const summary = attendanceService.getSummaryForYear(targetUserId, year)
    const entries = attendanceService.getEntriesForYear({ user_id: targetUserId, year })

    const calendarHtml = buildCalendarHtml(entries, conditions, year)
    const legendHtml = buildLegendHtml(conditions)
    const summaryHtml = buildSummaryHtml(summary, conditions, shifts)

    // Find user's shift name
    const userShiftId = entries.length > 0 ? entries[0].shift_id : null
    const userShift = userShiftId ? shifts.find(s => s.id === userShiftId) : null
    const shiftInfo = userShift ? `<div class="shift-info">Shift: ${escapeHtml(userShift.name)}</div>` : ''

    const exportDate = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    const page = `<div class="page">
      <div class="header">
        <div class="header-left">
          <h1>${escapeHtml(summary.user_display_name)} - Attendance ${year}</h1>
          ${shiftInfo}
        </div>
        <div class="export-date">Exported: ${exportDate}</div>
      </div>
      ${calendarHtml}
      ${legendHtml}
      <div class="bottom-section">
        <div class="summary-section">
          <h2>Summary</h2>
          ${summaryHtml}
        </div>
      </div>
    </div>`

    const html = buildFullHtml([page])
    const buffer = await renderHtmlToPdf(html)

    logAudit('ATTENDANCE_PDF_EXPORT', requestingUserId, username, 'attendance', targetUserId, {
      year,
      targetUserId
    })

    return { success: true, buffer, userDisplayName: summary.user_display_name }
  } catch (error: any) {
    console.error('Error exporting user attendance PDF:', error)
    return { success: false, error: error.message }
  }
}
