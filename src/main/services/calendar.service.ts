import { getDatabase } from '../database/connection'

export interface CalendarEvent {
  id: string
  type: 'reminder' | 'issue' | 'mom' | 'letter' | 'action'
  title: string
  date: string
  time?: string
  status?: string
  priority?: string
  entity_id: string
  topic_id?: string
  topic_title?: string
  color: string
}

export interface CalendarMonth {
  year: number
  month: number
  events: CalendarEvent[]
}

const EVENT_COLORS = {
  reminder: '#3B82F6', // Blue
  issue: '#EF4444',    // Red
  mom: '#8B5CF6',      // Purple
  letter: '#10B981',   // Green
  action: '#F59E0B'    // Amber
}

export function getCalendarEvents(year: number, month: number): CalendarEvent[] {
  const db = getDatabase()
  const events: CalendarEvent[] = []

  // Calculate date range for the month
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`

  // Get reminders
  const reminders = db.prepare(`
    SELECT
      r.id,
      r.title,
      r.due_date as date,
      r.completed_at,
      r.record_id,
      rec.topic_id,
      t.title as topic_title
    FROM reminders r
    LEFT JOIN records rec ON rec.id = r.record_id
    LEFT JOIN topics t ON t.id = rec.topic_id
    WHERE r.due_date >= ? AND r.due_date < ?
    ORDER BY r.due_date
  `).all(startDate, endDate) as any[]

  for (const r of reminders) {
    events.push({
      id: r.id,
      type: 'reminder',
      title: r.title,
      date: r.date.split('T')[0],
      status: r.completed_at ? 'completed' : 'pending',
      entity_id: r.id,
      topic_id: r.topic_id,
      topic_title: r.topic_title,
      color: EVENT_COLORS.reminder
    })
  }

  // Get issues with reminder dates
  const issues = db.prepare(`
    SELECT
      i.id,
      i.title,
      i.reminder_date as date,
      i.status,
      i.importance as priority,
      i.topic_id,
      t.title as topic_title
    FROM issues i
    LEFT JOIN topics t ON t.id = i.topic_id
    WHERE i.reminder_date >= ? AND i.reminder_date < ?
    ORDER BY i.reminder_date
  `).all(startDate, endDate) as any[]

  for (const i of issues) {
    events.push({
      id: i.id,
      type: 'issue',
      title: i.title,
      date: i.date.split('T')[0],
      status: i.status,
      priority: i.priority,
      entity_id: i.id,
      topic_id: i.topic_id,
      topic_title: i.topic_title,
      color: EVENT_COLORS.issue
    })
  }

  // Get MOMs (meeting dates)
  const moms = db.prepare(`
    SELECT
      m.id,
      m.title,
      m.meeting_date as date,
      m.status,
      ml.name as location_name
    FROM moms m
    LEFT JOIN mom_locations ml ON ml.id = m.location_id
    WHERE m.deleted_at IS NULL
      AND m.meeting_date >= ? AND m.meeting_date < ?
    ORDER BY m.meeting_date
  `).all(startDate, endDate) as any[]

  for (const m of moms) {
    events.push({
      id: m.id,
      type: 'mom',
      title: m.title,
      date: m.date.split('T')[0],
      status: m.status,
      entity_id: m.id,
      color: EVENT_COLORS.mom
    })
  }

  // Get letters with due dates
  const letters = db.prepare(`
    SELECT
      l.id,
      l.subject as title,
      l.due_date as date,
      l.status,
      l.priority,
      l.topic_id,
      t.title as topic_title
    FROM letters l
    LEFT JOIN topics t ON t.id = l.topic_id
    WHERE l.deleted_at IS NULL
      AND l.due_date >= ? AND l.due_date < ?
    ORDER BY l.due_date
  `).all(startDate, endDate) as any[]

  for (const l of letters) {
    events.push({
      id: l.id,
      type: 'letter',
      title: l.title,
      date: l.date.split('T')[0],
      status: l.status,
      priority: l.priority,
      entity_id: l.id,
      topic_id: l.topic_id,
      topic_title: l.topic_title,
      color: EVENT_COLORS.letter
    })
  }

  // Get MOM actions with deadlines
  const actions = db.prepare(`
    SELECT
      a.id,
      a.description as title,
      a.deadline as date,
      a.status,
      m.title as mom_title,
      m.id as mom_id
    FROM mom_actions a
    JOIN moms m ON m.id = a.mom_internal_id
    WHERE m.deleted_at IS NULL
      AND a.deadline >= ? AND a.deadline < ?
    ORDER BY a.deadline
  `).all(startDate, endDate) as any[]

  for (const a of actions) {
    events.push({
      id: a.id,
      type: 'action',
      title: `${a.mom_title}: ${a.title}`,
      date: a.date.split('T')[0],
      status: a.status,
      entity_id: a.id,
      color: EVENT_COLORS.action
    })
  }

  // Sort all events by date
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return events
}

export function getEventsForDate(date: string): CalendarEvent[] {
  const db = getDatabase()
  const events: CalendarEvent[] = []
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + 1)
  const endDate = nextDate.toISOString().split('T')[0]

  // Get reminders for this date
  const reminders = db.prepare(`
    SELECT
      r.id,
      r.title,
      r.due_date as date,
      r.completed_at,
      r.record_id,
      rec.topic_id,
      t.title as topic_title
    FROM reminders r
    LEFT JOIN records rec ON rec.id = r.record_id
    LEFT JOIN topics t ON t.id = rec.topic_id
    WHERE date(r.due_date) = ?
    ORDER BY r.due_date
  `).all(date) as any[]

  for (const r of reminders) {
    events.push({
      id: r.id,
      type: 'reminder',
      title: r.title,
      date: r.date.split('T')[0],
      status: r.completed_at ? 'completed' : 'pending',
      entity_id: r.id,
      topic_id: r.topic_id,
      topic_title: r.topic_title,
      color: EVENT_COLORS.reminder
    })
  }

  // Get issues with reminder dates for this date
  const issues = db.prepare(`
    SELECT
      i.id,
      i.title,
      i.reminder_date as date,
      i.status,
      i.importance as priority,
      i.topic_id,
      t.title as topic_title
    FROM issues i
    LEFT JOIN topics t ON t.id = i.topic_id
    WHERE date(i.reminder_date) = ?
  `).all(date) as any[]

  for (const i of issues) {
    events.push({
      id: i.id,
      type: 'issue',
      title: i.title,
      date: i.date.split('T')[0],
      status: i.status,
      priority: i.priority,
      entity_id: i.id,
      topic_id: i.topic_id,
      topic_title: i.topic_title,
      color: EVENT_COLORS.issue
    })
  }

  // Get MOMs for this date
  const moms = db.prepare(`
    SELECT
      m.id,
      m.title,
      m.meeting_date as date,
      m.status,
      ml.name as location_name
    FROM moms m
    LEFT JOIN mom_locations ml ON ml.id = m.location_id
    WHERE m.deleted_at IS NULL AND date(m.meeting_date) = ?
  `).all(date) as any[]

  for (const m of moms) {
    events.push({
      id: m.id,
      type: 'mom',
      title: m.title,
      date: m.date.split('T')[0],
      status: m.status,
      entity_id: m.id,
      color: EVENT_COLORS.mom
    })
  }

  // Get letters due on this date
  const letters = db.prepare(`
    SELECT
      l.id,
      l.subject as title,
      l.due_date as date,
      l.status,
      l.priority,
      l.topic_id,
      t.title as topic_title
    FROM letters l
    LEFT JOIN topics t ON t.id = l.topic_id
    WHERE l.deleted_at IS NULL AND date(l.due_date) = ?
  `).all(date) as any[]

  for (const l of letters) {
    events.push({
      id: l.id,
      type: 'letter',
      title: l.title,
      date: l.date.split('T')[0],
      status: l.status,
      priority: l.priority,
      entity_id: l.id,
      topic_id: l.topic_id,
      topic_title: l.topic_title,
      color: EVENT_COLORS.letter
    })
  }

  // Get MOM actions due on this date
  const actions = db.prepare(`
    SELECT
      a.id,
      a.description as title,
      a.deadline as date,
      a.status,
      m.title as mom_title,
      m.id as mom_id
    FROM mom_actions a
    JOIN moms m ON m.id = a.mom_internal_id
    WHERE m.deleted_at IS NULL AND date(a.deadline) = ?
  `).all(date) as any[]

  for (const a of actions) {
    events.push({
      id: a.id,
      type: 'action',
      title: `${a.mom_title}: ${a.title}`,
      date: a.date.split('T')[0],
      status: a.status,
      entity_id: a.id,
      color: EVENT_COLORS.action
    })
  }

  return events
}

export function getUpcomingEvents(days: number = 7): CalendarEvent[] {
  const db = getDatabase()
  const today = new Date().toISOString().split('T')[0]
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + days)
  const endDate = futureDate.toISOString().split('T')[0]

  const events: CalendarEvent[] = []

  // Get all events in the date range
  const reminders = db.prepare(`
    SELECT
      r.id,
      r.title,
      r.due_date as date,
      r.completed_at
    FROM reminders r
    WHERE r.completed_at IS NULL
      AND date(r.due_date) >= ? AND date(r.due_date) <= ?
    ORDER BY r.due_date
    LIMIT 20
  `).all(today, endDate) as any[]

  for (const r of reminders) {
    events.push({
      id: r.id,
      type: 'reminder',
      title: r.title,
      date: r.date.split('T')[0],
      status: 'pending',
      entity_id: r.id,
      color: EVENT_COLORS.reminder
    })
  }

  const issues = db.prepare(`
    SELECT i.id, i.title, i.reminder_date as date, i.status, i.importance as priority
    FROM issues i
    WHERE i.status = 'open'
      AND date(i.reminder_date) >= ? AND date(i.reminder_date) <= ?
    ORDER BY i.reminder_date
    LIMIT 20
  `).all(today, endDate) as any[]

  for (const i of issues) {
    events.push({
      id: i.id,
      type: 'issue',
      title: i.title,
      date: i.date.split('T')[0],
      status: i.status,
      priority: i.priority,
      entity_id: i.id,
      color: EVENT_COLORS.issue
    })
  }

  const letters = db.prepare(`
    SELECT l.id, l.subject as title, l.due_date as date, l.status, l.priority
    FROM letters l
    WHERE l.deleted_at IS NULL AND l.status = 'pending'
      AND date(l.due_date) >= ? AND date(l.due_date) <= ?
    ORDER BY l.due_date
    LIMIT 20
  `).all(today, endDate) as any[]

  for (const l of letters) {
    events.push({
      id: l.id,
      type: 'letter',
      title: l.title,
      date: l.date.split('T')[0],
      status: l.status,
      priority: l.priority,
      entity_id: l.id,
      color: EVENT_COLORS.letter
    })
  }

  // Sort by date
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return events.slice(0, 20)
}
