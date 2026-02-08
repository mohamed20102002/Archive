import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { useToast } from '../../context/ToastContext'

const DATE_FORMAT_OPTIONS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' }
]

const HANDOVER_START_DAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
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
  const isAdmin = user?.role === 'admin'

  const [departmentName, setDepartmentName] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [defaultView, setDefaultView] = useState('/topics')
  const [defaultViewMode, setDefaultViewMode] = useState<'card' | 'table'>('card')
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY')
  const [handoverStartDay, setHandoverStartDay] = useState(1)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDepartmentName(settings.department_name)
    setTheme(settings.theme)
    setDefaultView(settings.default_view)
    setDefaultViewMode(settings.default_view_mode)
    setDateFormat(settings.date_format)
    setHandoverStartDay(settings.handover_start_day)
  }, [settings])

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
          handover_start_day: String(handoverStartDay)
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
        <div className="px-2 pt-4">
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

      {/* Shift Handover Section */}
      <section className="card dark:bg-gray-800 dark:border-gray-700">
        <div className="px-2 pb-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Shift Handover</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Configure shift handover timeline calculation</p>
        </div>
        <div className="px-2 pt-4 space-y-5">
          <div>
            <label className="label dark:text-gray-300">Week Start Day</label>
            <select
              value={handoverStartDay}
              onChange={(e) => setHandoverStartDay(Number(e.target.value))}
              disabled={!isAdmin}
              className="input dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            >
              {HANDOVER_START_DAY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              The day of the week when the shift handover period starts. Records from this day to the day before will be included in the handover.
            </p>
          </div>
        </div>
      </section>

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
