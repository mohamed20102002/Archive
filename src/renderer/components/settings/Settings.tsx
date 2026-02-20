import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../common/ConfirmDialog'
import { LoginBackgroundStyle, SIDEBAR_TABS } from '../../types'
import { BACKGROUND_OPTIONS } from '../auth/backgrounds'
import { CustomFieldEditor } from '../custom-fields/CustomFieldEditor'
import { ImportWizard } from '../import/ImportWizard'
import { TagManager } from '../tags/TagManager'
import { Modal } from '../common/Modal'
import { supportedLanguages, changeLanguage, getCurrentLanguage, type SupportedLanguage } from '../../i18n'

const DATE_FORMAT_OPTIONS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' }
]

const DEFAULT_VIEW_OPTIONS = [
  { value: '/topics', label: 'Topics' },
  { value: '/letters', label: 'Letters' },
  { value: '/outlook', label: 'Outlook' },
  { value: '/reminders', label: 'Reminders' },
  { value: '/issues', label: 'Open Issues' },
  { value: '/handover', label: 'Shift Handover' },
  { value: '/attendance', label: 'Attendance' },
  { value: '/secure-resources', label: 'Secure Resources' }
]

export function Settings() {
  const { user } = useAuth()
  const { settings, refreshSettings } = useSettings()
  const { success, error } = useToast()
  const confirm = useConfirm()
  const { t } = useTranslation()
  const isAdmin = user?.role === 'admin'

  // Language state
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>(getCurrentLanguage())
  const [showCustomFields, setShowCustomFields] = useState(false)
  const [showImportWizard, setShowImportWizard] = useState(false)
  const [showTagManager, setShowTagManager] = useState(false)

  const [departmentName, setDepartmentName] = useState('')
  const [departmentNameArabic, setDepartmentNameArabic] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [defaultView, setDefaultView] = useState('/topics')
  const [defaultViewMode, setDefaultViewMode] = useState<'card' | 'table'>('card')
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY')
  const [loginAnimationSpeed, setLoginAnimationSpeed] = useState(4)
  const [loginBackgroundStyle, setLoginBackgroundStyle] = useState<LoginBackgroundStyle>('atom')
  const [showFloatingConsole, setShowFloatingConsole] = useState(true)
  const [backupReminderDays, setBackupReminderDays] = useState(7)
  const [zoomFactor, setZoomFactor] = useState(0.85)
  const [visibleTabs, setVisibleTabs] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // Seed state
  const [seeding, setSeeding] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [seedResult, setSeedResult] = useState<{ success: boolean; message: string; counts?: Record<string, number> } | null>(null)

  // Console state
  const [logs, setLogs] = useState<{ timestamp: string; level: string; message: string }[]>([])
  const [logStats, setLogStats] = useState<{ total: number; errors: number; warnings: number } | null>(null)
  const [logFilter, setLogFilter] = useState<string>('all')
  const [showConsole, setShowConsole] = useState(false)
  const [loadingLogs, setLoadingLogs] = useState(false)

  // App info
  const [appInfo, setAppInfo] = useState<{ version: string; platform: string; isPackaged: boolean } | null>(null)

  useEffect(() => {
    setDepartmentName(settings.department_name)
    setDepartmentNameArabic(settings.department_name_arabic)
    setTheme(settings.theme)
    setDefaultView(settings.default_view)
    setDefaultViewMode(settings.default_view_mode)
    setDateFormat(settings.date_format)
    setLoginAnimationSpeed(settings.login_animation_speed)
    setLoginBackgroundStyle(settings.login_background_style)
    setShowFloatingConsole(settings.show_floating_console)
    setBackupReminderDays(settings.backup_reminder_days)
    setVisibleTabs(settings.visible_tabs)
  }, [settings])

  // Load zoom factor on mount
  useEffect(() => {
    window.electronAPI.app.getZoomFactor().then(setZoomFactor)
  }, [])

  // Load app info on mount
  useEffect(() => {
    window.electronAPI.app.getInfo().then(setAppInfo)
  }, [])

  const handleZoomChange = async (newZoom: number) => {
    setZoomFactor(newZoom)
    await window.electronAPI.app.setZoomFactor(newZoom)
  }

  const handleSeedDatabase = async () => {
    if (!user) return
    const confirmed = await confirm({
      title: 'Seed Database',
      message: 'This will populate the database with test data. This may affect existing data. Continue?',
      confirmText: 'Continue'
    })
    if (!confirmed) return

    setSeeding(true)
    setSeedResult(null)
    try {
      const result = await window.electronAPI.seed.run(user.id, {
        users: 10,
        topics: 15,
        recordsPerTopic: 20,
        letters: 60,
        moms: 25,
        issues: 30,
        attendanceMonths: 3,
        reminders: 20,
        credentials: 12,
        references: 10
      })
      setSeedResult(result)
      if (result.success) {
        success('Database seeded', result.message)
      } else {
        error('Seeding failed', result.error || 'Unknown error')
      }
    } catch (err: any) {
      error('Seeding failed', err.message)
      setSeedResult({ success: false, message: err.message })
    } finally {
      setSeeding(false)
    }
  }

  const handleClearAllData = async () => {
    if (!user) return
    const confirmed1 = await confirm({
      title: 'Clear All Data',
      message: 'This will DELETE ALL DATA except admin users. This cannot be undone. Are you sure?',
      confirmText: 'Continue',
      danger: true
    })
    if (!confirmed1) return
    const confirmed2 = await confirm({
      title: 'Final Warning',
      message: 'All topics, records, letters, MOMs, issues, attendance, etc. will be permanently deleted. Continue?',
      confirmText: 'Delete All Data',
      danger: true
    })
    if (!confirmed2) return

    setClearing(true)
    setSeedResult(null)
    try {
      const result = await window.electronAPI.seed.clear(user.id)
      if (result.success) {
        success('Data cleared', result.message)
        setSeedResult({ success: true, message: result.message })
      } else {
        error('Clear failed', result.error || 'Unknown error')
        setSeedResult({ success: false, message: result.error || 'Unknown error' })
      }
    } catch (err: any) {
      error('Clear failed', err.message)
      setSeedResult({ success: false, message: err.message })
    } finally {
      setClearing(false)
    }
  }

  const loadLogs = async () => {
    setLoadingLogs(true)
    try {
      const filter = logFilter === 'all' ? undefined : { level: logFilter }
      const [logsResult, statsResult] = await Promise.all([
        window.electronAPI.logger.getLogs({ ...filter, limit: 500 }),
        window.electronAPI.logger.getStats()
      ])
      setLogs(logsResult)
      setLogStats(statsResult)
    } catch (err) {
      console.error('Failed to load logs:', err)
    } finally {
      setLoadingLogs(false)
    }
  }

  const handleClearLogs = async () => {
    try {
      await window.electronAPI.logger.clearLogs()
      setLogs([])
      setLogStats({ total: 0, errors: 0, warnings: 0 })
      success('Logs cleared', 'Application logs have been cleared')
    } catch (err) {
      console.error('Failed to clear logs:', err)
    }
  }

  // Load logs when console is opened or filter changes
  useEffect(() => {
    if (showConsole) {
      loadLogs()
    }
  }, [showConsole, logFilter])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      const result = await window.electronAPI.settings.updateAll(
        {
          department_name: departmentName,
          department_name_arabic: departmentNameArabic,
          theme,
          default_view: defaultView,
          default_view_mode: defaultViewMode,
          date_format: dateFormat,
          login_animation_speed: String(loginAnimationSpeed),
          login_background_style: loginBackgroundStyle,
          show_floating_console: String(showFloatingConsole),
          backup_reminder_days: String(backupReminderDays),
          visible_tabs: JSON.stringify(visibleTabs)
        },
        user.id
      )

      if (result.success) {
        refreshSettings()
        success('Settings saved', 'Your settings have been updated successfully.')
      } else {
        error('Save failed', result.error || 'Could not save settings.')
      }
    } catch (err: any) {
      error('Save failed', err.message || 'An unexpected error occurred.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {isAdmin
            ? 'Manage application settings and preferences.'
            : 'View application settings. Contact an administrator to make changes.'}
        </p>
      </div>

      {/* General Section */}
      <section className="card dark:bg-gray-800 dark:border-gray-700">
        <div className="px-2 pb-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">General</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Basic application configuration</p>
        </div>
        <div className="px-2 pt-4 space-y-5">
          {/* Department Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label dark:text-gray-300">Department Name</label>
              <input
                type="text"
                value={departmentName}
                onChange={(e) => setDepartmentName(e.target.value)}
                disabled={!isAdmin}
                placeholder="e.g. IT Department"
                className="input dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Displayed in the sidebar header
              </p>
            </div>
            <div>
              <label className="label dark:text-gray-300">Department Name (Arabic)</label>
              <input
                type="text"
                value={departmentNameArabic}
                onChange={(e) => setDepartmentNameArabic(e.target.value)}
                disabled={!isAdmin}
                placeholder="مثال: قسم تقنية المعلومات"
                dir="rtl"
                className="input dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400 text-right"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Used in Arabic attendance reports
              </p>
            </div>
          </div>

          {/* Date Format */}
          <div>
            <label className="label dark:text-gray-300">Date Format</label>
            <select
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              disabled={!isAdmin}
              className="input dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            >
              {DATE_FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Appearance Section */}
      <section className="card dark:bg-gray-800 dark:border-gray-700">
        <div className="px-2 pb-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Appearance</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Customize the application look and feel</p>
        </div>
        <div className="px-2 pt-4 space-y-5">
          <div>
          <label className="label dark:text-gray-300">Theme</label>
          <div className="grid grid-cols-2 gap-4 mt-1">
            {/* Light */}
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => setTheme('light')}
              className={`relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-colors ${
                theme === 'light'
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              } ${!isAdmin ? 'opacity-60' : ''}`}
            >
              {/* Light icon */}
              <div className="w-12 h-12 rounded-lg bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Light</span>
              {theme === 'light' && (
                <div className="absolute top-2 right-2">
                  <svg className="w-5 h-5 text-primary-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
            </button>

            {/* Dark */}
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => setTheme('dark')}
              className={`relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-colors ${
                theme === 'dark'
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              } ${!isAdmin ? 'opacity-60' : ''}`}
            >
              {/* Dark icon */}
              <div className="w-12 h-12 rounded-lg bg-gray-800 border border-gray-600 flex items-center justify-center shadow-sm">
                <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Dark</span>
              {theme === 'dark' && (
                <div className="absolute top-2 right-2">
                  <svg className="w-5 h-5 text-primary-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
            </button>
          </div>
          </div>

          {/* Login Background Style */}
          <div>
            <label className="label dark:text-gray-300">Login Background Style</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-1">
              {BACKGROUND_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => setLoginBackgroundStyle(option.value)}
                  className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-colors ${
                    loginBackgroundStyle === option.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  } ${!isAdmin ? 'opacity-60' : ''}`}
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-700 to-indigo-900 flex items-center justify-center">
                    {option.value === 'atom' && (
                      <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="3" />
                        <ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" strokeWidth="1" />
                        <ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" strokeWidth="1" transform="rotate(60 12 12)" />
                        <ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" strokeWidth="1" transform="rotate(-60 12 12)" />
                      </svg>
                    )}
                    {option.value === 'particles' && (
                      <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="6" cy="6" r="2" />
                        <circle cx="18" cy="8" r="1.5" />
                        <circle cx="12" cy="12" r="2.5" />
                        <circle cx="8" cy="18" r="1.5" />
                        <circle cx="17" cy="16" r="2" />
                      </svg>
                    )}
                    {option.value === 'dna' && (
                      <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                        <path d="M6 3c0 4 6 4 6 8s-6 4-6 8M18 3c0 4-6 4-6 8s6 4 6 8M9 6h6M9 12h6M9 18h6" />
                      </svg>
                    )}
                    {option.value === 'wave' && (
                      <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                        <path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
                        <path d="M3 16c2-3 4-3 6 0s4 3 6 0 4-3 6 0" opacity="0.5" />
                        <path d="M3 8c2-3 4-3 6 0s4 3 6 0 4-3 6 0" opacity="0.5" />
                      </svg>
                    )}
                    {option.value === 'galaxy' && (
                      <svg className="w-5 h-5 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="2" />
                        <path d="M12 2C8 2 5 5 5 8c0 2 1 3 3 4s4 2 4 6c0-4 2-5 4-6s3-2 3-4c0-3-3-6-7-6z" opacity="0.6" />
                        <circle cx="6" cy="6" r="0.5" />
                        <circle cx="18" cy="8" r="0.5" />
                        <circle cx="8" cy="18" r="0.5" />
                        <circle cx="16" cy="16" r="0.5" />
                      </svg>
                    )}
                    {option.value === 'fission' && (
                      <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="4" opacity="0.8" />
                        <circle cx="6" cy="8" r="2" opacity="0.6" />
                        <circle cx="18" cy="16" r="2" opacity="0.6" />
                        <path d="M12 12L6 8M12 12L18 16" stroke="currentColor" strokeWidth="0.5" fill="none" />
                        <circle cx="4" cy="4" r="1" opacity="0.4" />
                        <circle cx="20" cy="6" r="1" opacity="0.4" />
                        <circle cx="18" cy="20" r="1" opacity="0.4" />
                      </svg>
                    )}
                    {option.value === 'neural' && (
                      <svg className="w-5 h-5 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="4" cy="8" r="1.5" />
                        <circle cx="4" cy="16" r="1.5" />
                        <circle cx="12" cy="6" r="1.5" />
                        <circle cx="12" cy="12" r="1.5" />
                        <circle cx="12" cy="18" r="1.5" />
                        <circle cx="20" cy="8" r="1.5" />
                        <circle cx="20" cy="16" r="1.5" />
                        <path d="M5.5 8L10.5 6M5.5 8L10.5 12M5.5 16L10.5 12M5.5 16L10.5 18M13.5 6L18.5 8M13.5 12L18.5 8M13.5 12L18.5 16M13.5 18L18.5 16" stroke="currentColor" strokeWidth="0.5" fill="none" opacity="0.5" />
                      </svg>
                    )}
                    {option.value === 'matrix' && (
                      <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                        <text x="2" y="8" fontSize="6" fontFamily="monospace">01</text>
                        <text x="12" y="8" fontSize="6" fontFamily="monospace">10</text>
                        <text x="6" y="14" fontSize="6" fontFamily="monospace">11</text>
                        <text x="14" y="14" fontSize="6" fontFamily="monospace">00</text>
                        <text x="4" y="20" fontSize="6" fontFamily="monospace">10</text>
                        <text x="12" y="20" fontSize="6" fontFamily="monospace">01</text>
                      </svg>
                    )}
                    {option.value === 'none' && (
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                        <path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{option.label}</span>
                  {loginBackgroundStyle === option.value && (
                    <div className="absolute top-1 right-1">
                      <svg className="w-4 h-4 text-primary-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              Choose the 3D animated background style for the login screen.
            </p>
          </div>

          {/* Login Animation Speed */}
          <div>
            <label className="label dark:text-gray-300">Login Animation Speed</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.5"
                value={loginAnimationSpeed}
                onChange={(e) => setLoginAnimationSpeed(Number(e.target.value))}
                disabled={!isAdmin || loginBackgroundStyle === 'none'}
                className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-primary-500 disabled:opacity-50"
              />
              <span className="w-16 text-sm font-medium text-gray-700 dark:text-gray-300 text-right">
                {loginAnimationSpeed}x
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Speed of the animation on the login screen. Set to 0.5 for slow, 10 for very fast.
            </p>
          </div>

          {/* Display Zoom */}
          <div>
            <label className="label dark:text-gray-300">Display Zoom</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={zoomFactor}
                onChange={(e) => handleZoomChange(Number(e.target.value))}
                disabled={!isAdmin}
                className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-primary-500 disabled:opacity-50"
              />
              <span className="w-16 text-sm font-medium text-gray-700 dark:text-gray-300 text-right">
                {Math.round(zoomFactor * 100)}%
              </span>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => handleZoomChange(0.85)}
                disabled={!isAdmin}
                className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
              >
                85% (Default)
              </button>
              <button
                type="button"
                onClick={() => handleZoomChange(1.0)}
                disabled={!isAdmin}
                className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
              >
                100%
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Adjust the application display size. Changes apply immediately and persist across restarts.
            </p>
          </div>
        </div>
      </section>

      {/* Navigation Section */}
      <section className="card dark:bg-gray-800 dark:border-gray-700">
        <div className="px-2 pb-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Navigation</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Configure navigation behavior</p>
        </div>
        <div className="px-2 pt-4 space-y-5">
          <div>
            <label className="label dark:text-gray-300">Default View</label>
            <select
              value={defaultView}
              onChange={(e) => setDefaultView(e.target.value)}
              disabled={!isAdmin}
              className="input dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            >
              {DEFAULT_VIEW_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              The page shown after logging in.
            </p>
          </div>

          <div>
            <label className="label dark:text-gray-300">Default List View Mode</label>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <button
                type="button"
                disabled={!isAdmin}
                onClick={() => setDefaultViewMode('card')}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                  defaultViewMode === 'card'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                } ${!isAdmin ? 'opacity-60' : ''}`}
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Card View</span>
              </button>
              <button
                type="button"
                disabled={!isAdmin}
                onClick={() => setDefaultViewMode('table')}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                  defaultViewMode === 'table'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                } ${!isAdmin ? 'opacity-60' : ''}`}
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Table View</span>
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Default display mode for list pages.
            </p>
          </div>

          {/* Visible Sidebar Tabs */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <label className="label dark:text-gray-300 mb-0">Visible Sidebar Tabs</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => setVisibleTabs([])}
                  className="text-xs text-primary-600 hover:text-primary-700 disabled:opacity-50"
                >
                  Show All
                </button>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <button
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => setVisibleTabs(['/dashboard', '/topics', '/issues'])}
                  className="text-xs text-primary-600 hover:text-primary-700 disabled:opacity-50"
                >
                  Minimal
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SIDEBAR_TABS.map((tab) => {
                const isVisible = visibleTabs.length === 0 || visibleTabs.includes(tab.path)
                return (
                  <button
                    key={tab.path}
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => {
                      if (visibleTabs.length === 0) {
                        // Currently showing all - set to all except this one
                        setVisibleTabs(SIDEBAR_TABS.filter(t => t.path !== tab.path).map(t => t.path))
                      } else if (visibleTabs.includes(tab.path)) {
                        // Remove this tab
                        const newTabs = visibleTabs.filter(p => p !== tab.path)
                        // If removing would leave no tabs, show all
                        setVisibleTabs(newTabs.length === 0 ? [] : newTabs)
                      } else {
                        // Add this tab
                        const newTabs = [...visibleTabs, tab.path]
                        // If all tabs are now selected, use empty array (show all)
                        setVisibleTabs(newTabs.length === SIDEBAR_TABS.length ? [] : newTabs)
                      }
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-left ${
                      isVisible
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300'
                    } ${!isAdmin ? 'opacity-60' : ''}`}
                  >
                    {isVisible ? (
                      <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" strokeWidth="2" />
                      </svg>
                    )}
                    <span className="text-sm truncate">{tab.label}</span>
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              Select which tabs to show in the sidebar. Admin-only tabs (Audit Log, Backup) are always visible to admins.
            </p>
          </div>
        </div>
      </section>

      {/* Language Section */}
      <section className="card dark:bg-gray-800 dark:border-gray-700">
        <div className="px-2 pb-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            {t('settings.language', 'Language')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.languageDescription', 'Choose your preferred language')}</p>
        </div>
        <div className="px-2 pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(Object.entries(supportedLanguages) as [SupportedLanguage, { name: string; nativeName: string; dir: string }][]).map(([code, lang]) => (
              <button
                key={code}
                onClick={async () => {
                  await changeLanguage(code)
                  setCurrentLang(code)
                  success(t('settings.languageChanged', 'Language changed'), t('settings.languageChangedTo', 'Language changed to {{language}}', { language: lang.name }))
                }}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                  currentLang === code
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                  currentLang === code
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}>
                  {code.toUpperCase()}
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{lang.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{lang.nativeName}</p>
                </div>
                {currentLang === code && (
                  <svg className="w-5 h-5 text-primary-600 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {t('settings.languageNote', 'Changing the language will update all text in the application. Arabic uses right-to-left (RTL) layout.')}
          </p>
        </div>
      </section>

      {/* Custom Fields Section - Admin Only */}
      {isAdmin && (
        <section className="card dark:bg-gray-800 dark:border-gray-700">
          <div className="px-2 pb-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  {t('settings.customFields', 'Custom Fields')}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.customFieldsDescription', 'Define custom fields for records, letters, issues, and MOMs')}</p>
              </div>
              <button
                onClick={() => setShowCustomFields(!showCustomFields)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
              >
                {showCustomFields ? t('common.hide', 'Hide') : t('common.manage', 'Manage')}
                <svg className={`w-4 h-4 transition-transform ${showCustomFields ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
          {showCustomFields && (
            <div className="px-2 pt-4">
              <CustomFieldEditor />
            </div>
          )}
        </section>
      )}

      {/* Tag Management Section - Admin Only */}
      {isAdmin && (
        <section className="card dark:bg-gray-800 dark:border-gray-700">
          <div className="px-2 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {t('settings.tagManagement', 'Tag Management')}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.tagManagementDescription', 'Create and manage tags for records, letters, and issues')}</p>
              </div>
              <button
                onClick={() => setShowTagManager(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {t('common.manage', 'Manage')}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Tag Manager Modal */}
      {showTagManager && (
        <Modal
          isOpen={showTagManager}
          onClose={() => setShowTagManager(false)}
          title={t('settings.tagManagement', 'Tag Management')}
          size="xl"
        >
          <TagManager />
        </Modal>
      )}

      {/* Import Data Section - Admin Only */}
      {isAdmin && (
        <section className="card dark:bg-gray-800 dark:border-gray-700">
          <div className="px-2 pb-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  {t('settings.importData', 'Import Data')}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.importDataDescription', 'Import data from Excel or CSV files')}</p>
              </div>
              <button
                onClick={() => setShowImportWizard(!showImportWizard)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {showImportWizard ? t('common.close', 'Close') : t('settings.startImport', 'Start Import')}
              </button>
            </div>
          </div>
          {showImportWizard && (
            <div className="px-2 pt-4">
              <ImportWizard onClose={() => setShowImportWizard(false)} />
            </div>
          )}
        </section>
      )}

      {/* Data Protection Section */}
      <DataProtectionSection
        isAdmin={isAdmin}
        backupReminderDays={backupReminderDays}
        setBackupReminderDays={setBackupReminderDays}
      />

      {/* Database Maintenance Section - Admin Only */}
      {isAdmin && <DatabaseMaintenanceSection />}

      {/* Database Testing Section - Admin Only */}
      {isAdmin && (
        <section className="card dark:bg-gray-800 dark:border-gray-700 border-red-200 dark:border-red-800">
          <div className="px-2 pb-4 border-b border-red-100 dark:border-red-900">
            <h2 className="text-lg font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Database Testing
            </h2>
            <p className="text-sm text-red-600 dark:text-red-400">
              Populate or clear database for testing purposes. Use with caution!
            </p>
          </div>
          <div className="px-2 pt-4 space-y-4">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSeedDatabase}
                disabled={seeding || clearing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {seeding ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Seeding...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                    Seed Test Data
                  </>
                )}
              </button>
              <button
                onClick={handleClearAllData}
                disabled={seeding || clearing}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {clearing ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Clear All Data
                  </>
                )}
              </button>
            </div>

            {/* Seed Result */}
            {seedResult && (
              <div className={`p-4 rounded-lg ${seedResult.success ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
                <p className={`font-medium ${seedResult.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {seedResult.message}
                </p>
                {seedResult.counts && (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-sm">
                    {Object.entries(seedResult.counts).filter(([, v]) => v > 0).map(([key, value]) => (
                      <div key={key} className="flex justify-between px-2 py-1 bg-white dark:bg-gray-800 rounded">
                        <span className="text-gray-600 dark:text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400">
              <strong>Seed Test Data:</strong> Creates sample users, topics, records, letters, MOMs, issues, attendance entries, and more for testing.
              <br />
              <strong>Clear All Data:</strong> Permanently deletes ALL data (topics, records, letters, MOMs, etc.), removes all stored files, and refreshes the database. Only admin users are kept. Cannot be undone!
            </p>
          </div>
        </section>
      )}

      {/* Application Console - Admin Only */}
      {isAdmin && (
        <section className="card dark:bg-gray-800 dark:border-gray-700">
          <div className="px-2 pb-4 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Application Console
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">View application logs and errors</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Floating Console Toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Floating Console</span>
                  <button
                    type="button"
                    onClick={() => setShowFloatingConsole(!showFloatingConsole)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      showFloatingConsole ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        showFloatingConsole ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </label>
              {logStats && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400">
                    {logStats.total} total
                  </span>
                  {logStats.errors > 0 && (
                    <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 rounded text-red-600 dark:text-red-400">
                      {logStats.errors} errors
                    </span>
                  )}
                  {logStats.warnings > 0 && (
                    <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 rounded text-yellow-600 dark:text-yellow-400">
                      {logStats.warnings} warnings
                    </span>
                  )}
                </div>
              )}
              </div>
            </div>
          </div>
          <div className="px-2 pt-4 space-y-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowConsole(!showConsole)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showConsole ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"} />
                </svg>
                {showConsole ? 'Hide Console' : 'Show Console'}
              </button>
              {showConsole && (
                <>
                  <select
                    value={logFilter}
                    onChange={(e) => setLogFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  >
                    <option value="all">All Logs</option>
                    <option value="error">Errors Only</option>
                    <option value="warn">Warnings Only</option>
                    <option value="log">Info Only</option>
                  </select>
                  <button
                    onClick={loadLogs}
                    disabled={loadingLogs}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
                  >
                    <svg className={`w-4 h-4 ${loadingLogs ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </button>
                  <button
                    onClick={handleClearLogs}
                    className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Clear
                  </button>
                </>
              )}
            </div>

            {showConsole && (
              <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-auto font-mono text-xs">
                {loadingLogs ? (
                  <div className="flex items-center justify-center py-8 text-gray-400">
                    <div className="animate-spin w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full mr-2" />
                    Loading logs...
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-gray-500 text-center py-8">No logs found</div>
                ) : (
                  <div className="space-y-1">
                    {logs.map((log, index) => (
                      <div
                        key={index}
                        className={`flex gap-2 ${
                          log.level === 'error' ? 'text-red-400' :
                          log.level === 'warn' ? 'text-yellow-400' :
                          log.level === 'info' ? 'text-blue-400' : 'text-gray-300'
                        }`}
                      >
                        <span className="text-gray-500 flex-shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={`w-12 flex-shrink-0 uppercase font-bold ${
                          log.level === 'error' ? 'text-red-500' :
                          log.level === 'warn' ? 'text-yellow-500' :
                          log.level === 'info' ? 'text-blue-500' : 'text-gray-500'
                        }`}>
                          [{log.level}]
                        </span>
                        <span className="whitespace-pre-wrap break-all">{log.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400">
              View application logs to debug issues. Logs are stored in memory and will be cleared when the app restarts.
            </p>
          </div>
        </section>
      )}

      {/* About & Updates */}
      <AboutSection appInfo={appInfo} />

      {/* Save Button */}
      {isAdmin && (
        <div className="flex justify-end pb-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Settings
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

// About & Updates Section Component
function AboutSection({ appInfo }: { appInfo: { version: string; platform: string; isPackaged: boolean } | null }) {
  const [importing, setImporting] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<string>('')
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error'>('info')

  // Check for pending update on mount
  useEffect(() => {
    window.electronAPI.updater.checkPending().then(result => {
      setUpdateReady(result.pending)
      if (result.pending) {
        setUpdateStatus('Update ready to install')
        setStatusType('success')
      }
    })
  }, [])

  const handleImportUpdate = async () => {
    setImporting(true)
    setUpdateStatus('Select update ZIP file...')
    setStatusType('info')

    try {
      const result = await window.electronAPI.updater.importZip()
      if (result.success) {
        setUpdateReady(true)
        setUpdateStatus(result.message || 'Update ready!')
        setStatusType('success')
      } else {
        setUpdateStatus(result.error || 'Import failed')
        setStatusType('error')
      }
    } catch (err: any) {
      setUpdateStatus(err.message || 'Import failed')
      setStatusType('error')
    } finally {
      setImporting(false)
    }
  }

  const handleApplyUpdate = async () => {
    setUpdateStatus('Applying update and restarting...')
    setStatusType('info')
    await window.electronAPI.updater.applyUpdate()
  }

  const handleCancelUpdate = async () => {
    await window.electronAPI.updater.cancelUpdate()
    setUpdateReady(false)
    setUpdateStatus('')
  }

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        About & Updates
      </h2>

      <div className="space-y-4">
        {/* App Info */}
        <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Version</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {appInfo?.version || 'Loading...'}
              {appInfo?.isPackaged === false && ' (Development)'}
            </p>
          </div>
        </div>

        {/* Update Status */}
        {updateStatus && (
          <div className={`p-3 rounded-lg text-sm ${
            statusType === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
            statusType === 'error' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
            'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
          }`}>
            {updateStatus}
          </div>
        )}

        {/* Update Buttons */}
        <div className="flex items-center gap-3">
          {!updateReady ? (
            <button
              onClick={handleImportUpdate}
              disabled={importing}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {importing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Import Update ZIP
                </>
              )}
            </button>
          ) : (
            <>
              <button
                onClick={handleApplyUpdate}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Apply Update & Restart
              </button>
              <button
                onClick={handleCancelUpdate}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>

        {/* Instructions */}
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <p><strong>To update:</strong></p>
          <ol className="list-decimal ml-4 space-y-1">
            <li>Download the latest portable ZIP from <a href="https://github.com/mohamed20102002/Archive/releases" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">GitHub Releases</a></li>
            <li>Click "Import Update ZIP" and select the downloaded file</li>
            <li>Click "Apply Update & Restart" to install</li>
          </ol>
          <p className="mt-2">Your data will be preserved during the update.</p>
        </div>
      </div>
    </section>
  )
}

// Data Protection Section Component
function DataProtectionSection({
  isAdmin,
  backupReminderDays,
  setBackupReminderDays
}: {
  isAdmin: boolean
  backupReminderDays: number
  setBackupReminderDays: (days: number) => void
}) {
  const { success, error } = useToast()
  const [keyfileExists, setKeyfileExists] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    window.electronAPI.keyfile.exists().then(setKeyfileExists)
  }, [])

  const handleExportKeyfile = async () => {
    setExporting(true)
    try {
      const result = await window.electronAPI.keyfile.export()
      if (result.success) {
        success('Keyfile exported', 'Your encryption keyfile has been exported. Keep it safe!')
      } else {
        error('Export failed', result.error || 'Could not export keyfile')
      }
    } catch (err: any) {
      error('Export failed', err.message)
    } finally {
      setExporting(false)
    }
  }

  const handleImportKeyfile = async () => {
    setImporting(true)
    try {
      const result = await window.electronAPI.keyfile.import()
      if (result.success) {
        success('Keyfile imported', 'Encryption keyfile has been restored. Restart the app to use it.')
        setKeyfileExists(true)
      } else if (result.error !== 'Import cancelled') {
        error('Import failed', result.error || 'Could not import keyfile')
      }
    } catch (err: any) {
      error('Import failed', err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <section className="card dark:bg-gray-800 dark:border-gray-700">
      <div className="px-2 pb-4 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Data Protection
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Configure backup reminders and encryption key management</p>
      </div>
      <div className="px-2 pt-4 space-y-5">
        {/* Backup Reminder */}
        <div>
          <label className="label dark:text-gray-300">Backup Reminder</label>
          <select
            value={backupReminderDays}
            onChange={(e) => setBackupReminderDays(Number(e.target.value))}
            disabled={!isAdmin}
            className="input dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            <option value={0}>Disabled</option>
            <option value={7}>Every 7 days</option>
            <option value={14}>Every 14 days</option>
            <option value={30}>Every 30 days</option>
          </select>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Show a reminder when it's been too long since the last backup.
          </p>
        </div>

        {/* Encryption Keyfile - Admin Only */}
        {isAdmin && (
          <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
            <label className="label dark:text-gray-300 flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Encryption Keyfile
            </label>
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={handleExportKeyfile}
                disabled={!keyfileExists || exporting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {exporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export Keyfile
                  </>
                )}
              </button>
              <button
                onClick={handleImportKeyfile}
                disabled={importing}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Import Keyfile
                  </>
                )}
              </button>
            </div>
            <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                <strong>Important:</strong> The encryption keyfile is used to encrypt/decrypt credentials and secure references.
                If you lose this file and your backup, you will <strong>permanently lose access</strong> to all encrypted data.
                Export and store this keyfile in a safe location separate from your database backup.
              </p>
            </div>
            {!keyfileExists && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                No keyfile exists yet. It will be created when you add your first credential or secure reference.
              </p>
            )}
          </div>
        )}

        {/* Tip */}
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-400">
            <strong>Tip:</strong> Regular backups protect your data from loss. Go to{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = '/backup' }} className="underline hover:no-underline">
              Backup & Restore
            </a>
            {' '}to create a backup.
          </p>
        </div>
      </div>
    </section>
  )
}

// Database Maintenance Section Component
function DatabaseMaintenanceSection() {
  const { success, error } = useToast()
  const [checking, setChecking] = useState(false)
  const [repairing, setRepairing] = useState(false)
  const [checkResult, setCheckResult] = useState<{
    valid: boolean
    checks: Array<{
      name: string
      description: string
      passed: boolean
      details?: string
      repairAvailable?: boolean
    }>
    totalChecks: number
    passedChecks: number
    failedChecks: number
    timestamp: string
  } | null>(null)
  const [repairResults, setRepairResults] = useState<Array<{
    name: string
    success: boolean
    repaired: number
    errors: string[]
  }>>([])

  const runIntegrityCheck = async () => {
    setChecking(true)
    setCheckResult(null)
    try {
      const result = await window.electronAPI.integrity.check()
      setCheckResult(result)
      if (result.valid) {
        success('Integrity Check Passed', 'All database checks passed successfully.')
      }
    } catch (err: any) {
      error('Check Failed', err.message)
    } finally {
      setChecking(false)
    }
  }

  const repairAllIssues = async () => {
    if (!checkResult) return

    setRepairing(true)
    setRepairResults([])
    const results: typeof repairResults = []

    try {
      // Find which repairs are needed
      const needsFkRepair = checkResult.checks.some(c => c.name === 'Foreign Key Integrity' && !c.passed)
      const needsOrphanedRecords = checkResult.checks.some(c => c.name === 'Orphaned Records' && !c.passed)
      const needsOrphanedEmails = checkResult.checks.some(c => c.name === 'Orphaned Emails' && !c.passed)
      const needsOrphanedAttachments = checkResult.checks.some(c => c.name === 'Orphaned Attachments' && !c.passed)
      const needsFtsRebuild = checkResult.checks.some(c => c.name === 'FTS Index Sync' && !c.passed)

      // Run repairs in order
      if (needsFkRepair) {
        const r = await window.electronAPI.integrity.repairForeignKeyViolations()
        results.push({ name: 'Foreign Key Violations', ...r })
      }

      if (needsOrphanedRecords) {
        const r = await window.electronAPI.integrity.repairOrphanedRecords()
        results.push({ name: 'Orphaned Records', ...r })
      }

      if (needsOrphanedEmails) {
        const r = await window.electronAPI.integrity.repairOrphanedEmails()
        results.push({ name: 'Orphaned Emails', ...r })
      }

      if (needsOrphanedAttachments) {
        const r = await window.electronAPI.integrity.repairOrphanedAttachments()
        results.push({ name: 'Orphaned Attachments', ...r })
      }

      if (needsFtsRebuild) {
        const r = await window.electronAPI.integrity.rebuildFtsIndexes()
        results.push({ name: 'FTS Indexes', ...r })
      }

      setRepairResults(results)

      const totalRepaired = results.reduce((sum, r) => sum + r.repaired, 0)
      const allSuccess = results.every(r => r.success)

      if (allSuccess && totalRepaired > 0) {
        success('Repairs Complete', `Fixed ${totalRepaired} issues.`)
        // Re-run check to show updated status
        await runIntegrityCheck()
      } else if (totalRepaired === 0) {
        success('No Repairs Needed', 'All issues were already resolved.')
      } else {
        error('Some Repairs Failed', 'Check the details below.')
      }
    } catch (err: any) {
      error('Repair Failed', err.message)
    } finally {
      setRepairing(false)
    }
  }

  const failedChecks = checkResult?.checks.filter(c => !c.passed) || []
  const hasRepairableIssues = failedChecks.some(c => c.repairAvailable)

  return (
    <section className="card dark:bg-gray-800 dark:border-gray-700">
      <div className="px-2 pb-4 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Database Maintenance
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Check and repair database integrity issues</p>
      </div>
      <div className="px-2 pt-4 space-y-4">
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={runIntegrityCheck}
            disabled={checking || repairing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {checking ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Checking...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Run Integrity Check
              </>
            )}
          </button>

          {hasRepairableIssues && (
            <button
              onClick={repairAllIssues}
              disabled={checking || repairing}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {repairing ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Repairing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                  </svg>
                  Repair All Issues
                </>
              )}
            </button>
          )}
        </div>

        {/* Check Results */}
        {checkResult && (
          <div className="space-y-3">
            {/* Summary */}
            <div className={`p-3 rounded-lg ${
              checkResult.valid
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-center gap-2">
                {checkResult.valid ? (
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <span className={`font-medium ${checkResult.valid ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {checkResult.valid ? 'All checks passed' : `${checkResult.failedChecks} issue${checkResult.failedChecks > 1 ? 's' : ''} found`}
                </span>
              </div>
            </div>

            {/* Failed Checks Details */}
            {failedChecks.length > 0 && (
              <div className="space-y-2">
                {failedChecks.map((check, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{check.name}</span>
                      {check.repairAvailable && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                          Repairable
                        </span>
                      )}
                    </div>
                    {check.details && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{check.details}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Repair Results */}
        {repairResults.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Repair Results:</h3>
            {repairResults.map((result, idx) => (
              <div key={idx} className={`p-2 rounded ${
                result.success
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
              }`}>
                <span className="font-medium">{result.name}:</span>{' '}
                {result.success ? `Fixed ${result.repaired} items` : `Failed - ${result.errors.join(', ')}`}
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Integrity checks verify database consistency. Repair functions fix issues like orphaned records,
          foreign key violations, and missing search indexes.
        </p>
      </div>
    </section>
  )
}
