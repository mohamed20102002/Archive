import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { AppSettings, LoginBackgroundStyle } from '../types'

const DEFAULT_SETTINGS: AppSettings = {
  department_name: '',
  theme: 'light',
  default_view: '/topics',
  default_view_mode: 'card',
  date_format: 'DD/MM/YYYY',
  login_animation_speed: 4, // 4x speed
  login_background_style: 'atom' // Default background style
}

interface SettingsContextType {
  settings: AppSettings
  loading: boolean
  refreshSettings: () => void
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
      const merged: AppSettings = {
        department_name: raw.department_name ?? DEFAULT_SETTINGS.department_name,
        theme: (raw.theme as 'light' | 'dark') ?? DEFAULT_SETTINGS.theme,
        default_view: raw.default_view ?? DEFAULT_SETTINGS.default_view,
        default_view_mode: (raw.default_view_mode as 'card' | 'table') ?? DEFAULT_SETTINGS.default_view_mode,
        date_format: raw.date_format ?? DEFAULT_SETTINGS.date_format,
        login_animation_speed: raw.login_animation_speed !== undefined ? Number(raw.login_animation_speed) : DEFAULT_SETTINGS.login_animation_speed,
        login_background_style: (raw.login_background_style as LoginBackgroundStyle) ?? DEFAULT_SETTINGS.login_background_style
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

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings }}>
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
