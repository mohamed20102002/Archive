import { getDatabase, getDataPath } from '../database/connection'
import * as childProcess from 'child_process'
import * as path from 'path'

// Disk space warning threshold: 1GB
const LOW_DISK_SPACE_THRESHOLD_BYTES = 1 * 1024 * 1024 * 1024

export interface DashboardStats {
  topics: {
    total: number
    active: number
    archived: number
  }
  issues: {
    open: number
    overdue: number
    closedThisMonth: number
  }
  reminders: {
    pending: number
    overdue: number
    upcoming: number
  }
  letters: {
    total: number
    pending: number
    overdue: number
  }
  moms: {
    total: number
    open: number
    closed: number
  }
  records: {
    total: number
    thisWeek: number
    thisMonth: number
  }
  secureResources: {
    credentials: number
    references: number
  }
  attendance: {
    presentToday: number
    totalUsers: number
  }
}

export interface RecentActivity {
  id: string
  type: 'record' | 'issue' | 'letter' | 'mom' | 'reminder'
  title: string
  action: string
  created_at: string
  created_by: string
  creator_name?: string
  entity_id?: string
  topic_id?: string
}

export function getDashboardStats(): DashboardStats {
  const db = getDatabase()
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  // Topics stats
  const topicsTotal = (db.prepare('SELECT COUNT(*) as count FROM topics WHERE deleted_at IS NULL').get() as { count: number }).count
  const topicsArchived = (db.prepare("SELECT COUNT(*) as count FROM topics WHERE deleted_at IS NULL AND status = 'archived'").get() as { count: number }).count

  // Issues stats
  const issuesOpen = (db.prepare("SELECT COUNT(*) as count FROM issues WHERE status = 'open'").get() as { count: number }).count
  const issuesOverdue = (db.prepare(`
    SELECT COUNT(*) as count FROM issues
    WHERE status = 'open' AND reminder_date IS NOT NULL AND reminder_date < ?
  `).get(today) as { count: number }).count
  const issuesClosedThisMonth = (db.prepare(`
    SELECT COUNT(*) as count FROM issues
    WHERE status = 'completed' AND completed_at >= ?
  `).get(monthStart) as { count: number }).count

  // Reminders stats
  const remindersPending = (db.prepare("SELECT COUNT(*) as count FROM reminders WHERE completed_at IS NULL").get() as { count: number }).count
  const remindersOverdue = (db.prepare(`
    SELECT COUNT(*) as count FROM reminders
    WHERE completed_at IS NULL AND due_date < ?
  `).get(today) as { count: number }).count
  const remindersUpcoming = (db.prepare(`
    SELECT COUNT(*) as count FROM reminders
    WHERE completed_at IS NULL AND due_date >= ? AND due_date <= date(?, '+7 days')
  `).get(today, today) as { count: number }).count

  // Letters stats
  const lettersTotal = (db.prepare('SELECT COUNT(*) as count FROM letters WHERE deleted_at IS NULL').get() as { count: number }).count
  const lettersPending = (db.prepare("SELECT COUNT(*) as count FROM letters WHERE deleted_at IS NULL AND status = 'pending'").get() as { count: number }).count
  const lettersOverdue = (db.prepare(`
    SELECT COUNT(*) as count FROM letters
    WHERE deleted_at IS NULL AND status = 'pending' AND due_date IS NOT NULL AND due_date < ?
  `).get(today) as { count: number }).count

  // MOMs stats
  const momsTotal = (db.prepare('SELECT COUNT(*) as count FROM moms WHERE deleted_at IS NULL').get() as { count: number }).count
  const momsOpen = (db.prepare("SELECT COUNT(*) as count FROM moms WHERE deleted_at IS NULL AND status = 'open'").get() as { count: number }).count

  // Records stats
  const recordsTotal = (db.prepare('SELECT COUNT(*) as count FROM records WHERE deleted_at IS NULL').get() as { count: number }).count
  const recordsThisWeek = (db.prepare(`
    SELECT COUNT(*) as count FROM records
    WHERE deleted_at IS NULL AND date(created_at) >= ?
  `).get(weekAgo) as { count: number }).count
  const recordsThisMonth = (db.prepare(`
    SELECT COUNT(*) as count FROM records
    WHERE deleted_at IS NULL AND date(created_at) >= ?
  `).get(monthStart) as { count: number }).count

  // Secure Resources stats
  const credentialsCount = (db.prepare('SELECT COUNT(*) as count FROM credentials WHERE deleted_at IS NULL').get() as { count: number }).count
  const referencesCount = (db.prepare('SELECT COUNT(*) as count FROM secure_references WHERE deleted_at IS NULL').get() as { count: number }).count

  // Attendance stats
  const totalUsers = (db.prepare("SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL AND role != 'system'").get() as { count: number }).count
  const presentToday = (db.prepare(`
    SELECT COUNT(DISTINCT user_id) as count FROM attendance_entries
    WHERE entry_date = ?
  `).get(today) as { count: number }).count

  return {
    topics: {
      total: topicsTotal,
      active: topicsTotal - topicsArchived,
      archived: topicsArchived
    },
    issues: {
      open: issuesOpen,
      overdue: issuesOverdue,
      closedThisMonth: issuesClosedThisMonth
    },
    reminders: {
      pending: remindersPending,
      overdue: remindersOverdue,
      upcoming: remindersUpcoming
    },
    letters: {
      total: lettersTotal,
      pending: lettersPending,
      overdue: lettersOverdue
    },
    moms: {
      total: momsTotal,
      open: momsOpen,
      closed: momsTotal - momsOpen
    },
    records: {
      total: recordsTotal,
      thisWeek: recordsThisWeek,
      thisMonth: recordsThisMonth
    },
    secureResources: {
      credentials: credentialsCount,
      references: referencesCount
    },
    attendance: {
      presentToday,
      totalUsers
    }
  }
}

export function getRecentActivity(limit: number = 20): RecentActivity[] {
  const db = getDatabase()

  // Get recent records
  const records = db.prepare(`
    SELECT
      r.id,
      'record' as type,
      r.title,
      'Created record' as action,
      r.created_at,
      r.created_by,
      u.display_name as creator_name,
      r.id as entity_id,
      r.topic_id
    FROM records r
    LEFT JOIN users u ON u.id = r.created_by
    WHERE r.deleted_at IS NULL
    ORDER BY r.created_at DESC
    LIMIT ?
  `).all(limit) as RecentActivity[]

  // Get recent issues
  const issues = db.prepare(`
    SELECT
      i.id,
      'issue' as type,
      i.title,
      CASE WHEN i.status = 'completed' THEN 'Closed issue' ELSE 'Created issue' END as action,
      i.created_at,
      i.created_by,
      u.display_name as creator_name,
      i.id as entity_id,
      i.topic_id
    FROM issues i
    LEFT JOIN users u ON u.id = i.created_by
    ORDER BY i.created_at DESC
    LIMIT ?
  `).all(limit) as RecentActivity[]

  // Get recent letters
  const letters = db.prepare(`
    SELECT
      l.id,
      'letter' as type,
      l.subject as title,
      'Created letter' as action,
      l.created_at,
      l.created_by,
      u.display_name as creator_name,
      l.id as entity_id,
      l.topic_id
    FROM letters l
    LEFT JOIN users u ON u.id = l.created_by
    WHERE l.deleted_at IS NULL
    ORDER BY l.created_at DESC
    LIMIT ?
  `).all(limit) as RecentActivity[]

  // Get recent MOMs
  const moms = db.prepare(`
    SELECT
      m.id,
      'mom' as type,
      m.title,
      'Created MOM' as action,
      m.created_at,
      m.created_by,
      u.display_name as creator_name,
      m.id as entity_id,
      NULL as topic_id
    FROM moms m
    LEFT JOIN users u ON u.id = m.created_by
    WHERE m.deleted_at IS NULL
    ORDER BY m.created_at DESC
    LIMIT ?
  `).all(limit) as RecentActivity[]

  // Combine and sort all activities
  const allActivities = [...records, ...issues, ...letters, ...moms]
  allActivities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return allActivities.slice(0, limit)
}

export function getActivityByMonth(year: number): { month: number; records: number; issues: number; letters: number; moms: number }[] {
  const db = getDatabase()
  const result: { month: number; records: number; issues: number; letters: number; moms: number }[] = []

  for (let month = 1; month <= 12; month++) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`

    const records = (db.prepare(`
      SELECT COUNT(*) as count FROM records
      WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ?
    `).get(startDate, endDate) as { count: number }).count

    const issues = (db.prepare(`
      SELECT COUNT(*) as count FROM issues
      WHERE created_at >= ? AND created_at < ?
    `).get(startDate, endDate) as { count: number }).count

    const letters = (db.prepare(`
      SELECT COUNT(*) as count FROM letters
      WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ?
    `).get(startDate, endDate) as { count: number }).count

    const moms = (db.prepare(`
      SELECT COUNT(*) as count FROM moms
      WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ?
    `).get(startDate, endDate) as { count: number }).count

    result.push({ month, records, issues, letters, moms })
  }

  return result
}

export function getTopTopics(limit: number = 5): { id: string; title: string; recordCount: number }[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT
      t.id,
      t.title,
      COUNT(r.id) as recordCount
    FROM topics t
    LEFT JOIN records r ON r.topic_id = t.id AND r.deleted_at IS NULL
    WHERE t.deleted_at IS NULL
    GROUP BY t.id
    ORDER BY recordCount DESC
    LIMIT ?
  `).all(limit) as { id: string; title: string; recordCount: number }[]
}

export interface DiskSpaceInfo {
  available: number // bytes
  total: number // bytes
  used: number // bytes
  percentUsed: number
  isLow: boolean // true if available < threshold
  drive: string
}

export function getDiskSpaceInfo(): DiskSpaceInfo | null {
  try {
    const dataPath = getDataPath()
    const drive = path.parse(dataPath).root || 'C:\\'
    const driveLetter = drive.replace(/[:\\\/]/g, '')

    if (process.platform === 'win32') {
      // Windows: use PowerShell (wmic is deprecated)
      const psCommand = `(Get-PSDrive ${driveLetter}).Free,(Get-PSDrive ${driveLetter}).Used`
      const result = childProcess.execSync(
        `powershell -NoProfile -Command "${psCommand}"`,
        { encoding: 'utf-8', windowsHide: true }
      )

      const lines = result.trim().split(/\r?\n/)
      if (lines.length >= 2) {
        const available = parseInt(lines[0].trim(), 10)
        const used = parseInt(lines[1].trim(), 10)
        const total = available + used
        const percentUsed = total > 0 ? Math.round((used / total) * 100) : 0

        return {
          available,
          total,
          used,
          percentUsed,
          isLow: available < LOW_DISK_SPACE_THRESHOLD_BYTES,
          drive: driveLetter
        }
      }
    } else {
      // Unix-like: use df command
      const result = childProcess.execSync(`df -B1 "${dataPath}"`, { encoding: 'utf-8' })
      const lines = result.trim().split('\n')
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/)
        if (parts.length >= 4) {
          const total = parseInt(parts[1], 10)
          const used = parseInt(parts[2], 10)
          const available = parseInt(parts[3], 10)
          const percentUsed = Math.round((used / total) * 100)

          return {
            available,
            total,
            used,
            percentUsed,
            isLow: available < LOW_DISK_SPACE_THRESHOLD_BYTES,
            drive: parts[0]
          }
        }
      }
    }

    return null
  } catch (error) {
    console.error('Error getting disk space info:', error)
    return null
  }
}
