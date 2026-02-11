import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../common/ConfirmDialog'
import { LoginBackgroundStyle } from '../../types'
import { BACKGROUND_OPTIONS } from '../auth/backgrounds'

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
  const isAdmin = user?.role === 'admin'

  const [departmentName, setDepartmentName] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [defaultView, setDefaultView] = useState('/topics')
  const [defaultViewMode, setDefaultViewMode] = useState<'card' | 'table'>('card')
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY')
  const [loginAnimationSpeed, setLoginAnimationSpeed] = useState(4)
  const [loginBackgroundStyle, setLoginBackgroundStyle] = useState<LoginBackgroundStyle>('atom')
  const [zoomFactor, setZoomFactor] = useState(0.85)
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

  useEffect(() => {
    setDepartmentName(settings.department_name)
    setTheme(settings.theme)
    setDefaultView(settings.default_view)
    setDefaultViewMode(settings.default_view_mode)
    setDateFormat(settings.date_format)
    setLoginAnimationSpeed(settings.login_animation_speed)
    setLoginBackgroundStyle(settings.login_background_style)
  }, [settings])

  // Load zoom factor on mount
  useEffect(() => {
    window.electronAPI.app.getZoomFactor().then(setZoomFactor)
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
          theme,
          default_view: defaultView,
          default_view_mode: defaultViewMode,
          date_format: dateFormat,
          login_animation_speed: String(loginAnimationSpeed),
          login_background_style: loginBackgroundStyle
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
              Displayed in the sidebar header. Leave empty for default.
            </p>
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
        </div>
      </section>

      
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
