import React, { useState, useEffect } from 'react'
import type { Credential, CredentialCategory, CreateCredentialData, UpdateCredentialData } from '../../types'

const CREDENTIAL_CATEGORIES: CredentialCategory[] = ['Software', 'Desktop', 'Server', 'Network', 'Other']

interface CredentialFormProps {
  credential?: Credential | null
  onSubmit: (data: CreateCredentialData | UpdateCredentialData) => void
  onCancel: () => void
}

export function CredentialForm({ credential, onSubmit, onCancel }: CredentialFormProps) {
  const [systemName, setSystemName] = useState(credential?.system_name || '')
  const [username, setUsername] = useState(credential?.username || '')
  const [password, setPassword] = useState('')
  const [category, setCategory] = useState<CredentialCategory>(credential?.category || 'Other')
  const [description, setDescription] = useState(credential?.description || '')
  const [notes, setNotes] = useState(credential?.notes || '')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isEdit = !!credential

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
        notes: notes.trim() || undefined
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
        notes: notes.trim() || undefined
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* System Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          System Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={systemName}
          onChange={(e) => setSystemName(e.target.value)}
          placeholder="e.g., Production Server, VPN, Database"
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            errors.systemName ? 'border-red-300' : 'border-gray-300'
          }`}
        />
        {errors.systemName && <p className="text-xs text-red-500 mt-1">{errors.systemName}</p>}
      </div>

      {/* Username */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Username <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter username"
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            errors.username ? 'border-red-300' : 'border-gray-300'
          }`}
        />
        {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username}</p>}
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Password {!isEdit && <span className="text-red-500">*</span>}
          {isEdit && <span className="text-gray-400 text-xs ml-1">(leave blank to keep current)</span>}
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isEdit ? 'Enter new password to change' : 'Enter password'}
            className={`w-full px-3 py-2 pr-10 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              errors.password ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as CredentialCategory)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {CREDENTIAL_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this credential"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
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
