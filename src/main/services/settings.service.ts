import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'

export function getSetting(key: string): string | null {
  const db = getDatabase()
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined

  return row ? row.value : null
}

export function getAllSettings(): Record<string, string> {
  const db = getDatabase()
  const rows = db.prepare('SELECT key, value FROM app_settings').all() as {
    key: string
    value: string
  }[]

  const settings: Record<string, string> = {}
  for (const row of rows) {
    settings[row.key] = row.value
  }
  return settings
}

export function updateSetting(
  key: string,
  value: string,
  userId: string
): { success: boolean; error?: string } {
  try {
    const db = getDatabase()

    db.prepare(
      "UPDATE app_settings SET value = ?, updated_by = ?, updated_at = datetime('now') WHERE key = ?"
    ).run(value, userId, key)

    // Get username for audit
    const user = db
      .prepare('SELECT username FROM users WHERE id = ?')
      .get(userId) as { username: string } | undefined

    logAudit('SETTINGS_UPDATE', userId, user?.username || null, 'setting', key, {
      key,
      value
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error updating setting:', error)
    return { success: false, error: error.message }
  }
}

export function updateSettings(
  settings: Record<string, string>,
  userId: string
): { success: boolean; error?: string } {
  try {
    const db = getDatabase()

    // Get username for audit
    const user = db
      .prepare('SELECT username FROM users WHERE id = ?')
      .get(userId) as { username: string } | undefined

    const update = db.prepare(
      "UPDATE app_settings SET value = ?, updated_by = ?, updated_at = datetime('now') WHERE key = ?"
    )

    db.transaction(() => {
      for (const [key, value] of Object.entries(settings)) {
        update.run(value, userId, key)
      }
    })()

    logAudit('SETTINGS_UPDATE', userId, user?.username || null, 'setting', null, {
      settings
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error updating settings:', error)
    return { success: false, error: error.message }
  }
}
