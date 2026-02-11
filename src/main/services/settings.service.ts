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

    // Use INSERT OR REPLACE to handle both new and existing settings
    db.prepare(
      "INSERT OR REPLACE INTO app_settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, datetime('now'))"
    ).run(key, value, userId)

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

    // Use INSERT OR REPLACE to handle both new and existing settings
    const upsert = db.prepare(
      "INSERT OR REPLACE INTO app_settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, datetime('now'))"
    )

    db.transaction(() => {
      for (const [key, value] of Object.entries(settings)) {
        upsert.run(key, value, userId)
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
