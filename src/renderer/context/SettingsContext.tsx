import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { AppSettings } from '../types'

const DEFAULT_SETTINGS: AppSettings = {
  department_name: '',
  theme: 'light',
  default_view: '/topics',
  default_view_mode: 'card',
  date_format: 'DD/MM/YYYY',
  handover_start_day: 1 // Monday
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
        handover_start_day: raw.handover_start_day !== undefined ? Number(raw.handover_start_day) : DEFAULT_SETTINGS.handover_start_day
      }
      setSettings(merged)
      applyTheme(merged.theme)
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
