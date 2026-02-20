import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import type { Credential, CreateCredentialData, UpdateCredentialData, ResourceColor, ResourceCategory, RESOURCE_COLORS } from '../../types'

const RESOURCE_COLORS_DATA = [
  { value: null, label: 'None', class: '' },
  { value: 'red', label: 'Red', class: 'bg-red-500' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-500' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500' },
  { value: 'green', label: 'Green', class: 'bg-green-500' },
  { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' }
] as const

const DEFAULT_CREDENTIAL_CATEGORIES = ['Software', 'Desktop', 'Server', 'Network', 'Other']

interface CredentialFormProps {
  credential?: Credential | null
  onSubmit: (data: CreateCredentialData | UpdateCredentialData) => void
  onCancel: () => void
}

export function CredentialForm({ credential, onSubmit, onCancel }: CredentialFormProps) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [systemName, setSystemName] = useState(credential?.system_name || '')
  const [username, setUsername] = useState(credential?.username || '')
  const [password, setPassword] = useState('')
  const [category, setCategory] = useState(credential?.category || 'Other')
  const [description, setDescription] = useState(credential?.description || '')
  const [notes, setNotes] = useState(credential?.notes || '')
  const [adminOnly, setAdminOnly] = useState(credential?.admin_only || false)
  const [color, setColor] = useState<ResourceColor>(credential?.color || null)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [categories, setCategories] = useState<string[]>(DEFAULT_CREDENTIAL_CATEGORIES)

  const isEdit = !!credential

  // Load dynamic categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const result = await window.electronAPI.categories.getByType('credential')
        if (result && Array.isArray(result) && result.length > 0) {
          setCategories(result.map((cat: ResourceCategory) => cat.name))
        }
      } catch (err) {
        console.error('Error loading categories:', err)
      }
    }
    loadCategories()
  }, [])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!systemName.trim()) newErrors.systemName = 'System name is required'
    if (!username.trim()) newErrors.username = 'Username is required'
    if (!isEdit && !password) newErrors.password = 'Password is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    if (isEdit) {
      const data: UpdateCredentialData = {
        system_name: systemName.trim(),
        username: username.trim(),
        category,
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
        admin_only: adminOnly,
        color
      }
      if (password) data.password = password
      onSubmit(data)
    } else {
      onSubmit({
        system_name: systemName.trim(),
        username: username.trim(),
        password,
        category,
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
        admin_only: adminOnly,
        color
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* System Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          System Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={systemName}
          onChange={(e) => setSystemName(e.target.value)}
          placeholder="e.g., Production Server, VPN, Database"
          className={`w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            errors.systemName ? 'border-red-300 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
          }`}
        />
        {errors.systemName && <p className="text-xs text-red-500 mt-1">{errors.systemName}</p>}
      </div>

      {/* Username */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Username <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter username"
          className={`w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            errors.username ? 'border-red-300 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
          }`}
        />
        {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username}</p>}
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Password {!isEdit && <span className="text-red-500">*</span>}
          {isEdit && <span className="text-gray-400 dark:text-gray-500 text-xs ml-1">(leave blank to keep current)</span>}
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isEdit ? 'Enter new password to change' : 'Enter password'}
            className={`w-full px-3 py-2 pr-10 border rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              errors.password ? 'border-red-300 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {showPassword ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.5 6.5m7.378 7.378L17.5 17.5M3 3l18 18" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Color Label */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Color Label</label>
        <div className="flex items-center gap-2">
          {RESOURCE_COLORS_DATA.map(c => (
            <button
              key={c.value || 'none'}
              type="button"
              onClick={() => setColor(c.value as ResourceColor)}
              className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center ${
                color === c.value
                  ? 'border-gray-900 dark:border-white ring-2 ring-gray-300 dark:ring-gray-600'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              } ${c.class || 'bg-gray-100 dark:bg-gray-600'}`}
              title={c.label}
            >
              {c.value === null && color === null && (
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {c.value !== null && color === c.value && (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this credential"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        />
      </div>

      {/* Admin Only Toggle - Only visible to admins */}
      {isAdmin && (
        <div className="flex items-center gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={adminOnly}
              onChange={(e) => setAdminOnly(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
          </label>
          <div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Admin Only</span>
            <p className="text-xs text-gray-500 dark:text-gray-400">Hide this credential from non-admin users</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
        >
          {isEdit ? 'Update Credential' : 'Create Credential'}
        </button>
      </div>
    </form>
  )
}
