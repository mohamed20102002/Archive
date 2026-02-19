import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react'
import { AppSettings, LoginBackgroundStyle } from '../types'
import { formatDateWithSetting, DateFormatStyle } from '../utils/dateFormat'

const DEFAULT_SETTINGS: AppSettings = {
  department_name: '',
  department_name_arabic: '',
  theme: 'light',
  default_view: '/topics',
  default_view_mode: 'card',
  date_format: 'DD/MM/YYYY',
  login_animation_speed: 4, // 4x speed
  login_background_style: 'atom', // Default background style
  show_floating_console: true, // Show floating console for admins by default
  backup_reminder_days: 7, // Remind to backup every 7 days by default
  visible_tabs: [] // Empty = all tabs visible
}

interface SettingsContextType {
  settings: AppSettings
  loading: boolean
  refreshSettings: () => void
  formatDate: (date: string | Date | null | undefined, style?: DateFormatStyle) => string
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

function applyTheme(theme: 'light' | 'dark') {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  const loadSettings = useCallback(async () => {
    try {
      const raw = await window.electronAPI.settings.getAll()
      // Parse visible_tabs from JSON string
      let visibleTabs: string[] = DEFAULT_SETTINGS.visible_tabs
      if (raw.visible_tabs) {
        try {
          visibleTabs = JSON.parse(raw.visible_tabs)
        } catch {
          visibleTabs = DEFAULT_SETTINGS.visible_tabs
        }
      }
      const merged: AppSettings = {
        department_name: raw.department_name ?? DEFAULT_SETTINGS.department_name,
        department_name_arabic: raw.department_name_arabic ?? DEFAULT_SETTINGS.department_name_arabic,
        theme: (raw.theme as 'light' | 'dark') ?? DEFAULT_SETTINGS.theme,
        default_view: raw.default_view ?? DEFAULT_SETTINGS.default_view,
        default_view_mode: (raw.default_view_mode as 'card' | 'table') ?? DEFAULT_SETTINGS.default_view_mode,
        date_format: raw.date_format ?? DEFAULT_SETTINGS.date_format,
        login_animation_speed: raw.login_animation_speed !== undefined ? Number(raw.login_animation_speed) : DEFAULT_SETTINGS.login_animation_speed,
        login_background_style: (raw.login_background_style as LoginBackgroundStyle) ?? DEFAULT_SETTINGS.login_background_style,
        show_floating_console: raw.show_floating_console !== undefined ? raw.show_floating_console === 'true' || raw.show_floating_console === true : DEFAULT_SETTINGS.show_floating_console,
        backup_reminder_days: raw.backup_reminder_days !== undefined ? Number(raw.backup_reminder_days) : DEFAULT_SETTINGS.backup_reminder_days,
        visible_tabs: visibleTabs
      }
      setSettings(merged)
      applyTheme(merged.theme)
      // Update window title with department name
      window.electronAPI.app.setWindowTitle(merged.department_name?.trim() || 'Database')
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const refreshSettings = useCallback(() => {
    loadSettings()
  }, [loadSettings])

  // Memoized formatDate function that uses current settings
  const formatDate = useCallback((date: string | Date | null | undefined, style?: DateFormatStyle) => {
    return formatDateWithSetting(date, settings.date_format, style)
  }, [settings.date_format])

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings, formatDate }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
