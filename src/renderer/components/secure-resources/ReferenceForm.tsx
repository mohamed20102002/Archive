import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import type { SecureReference, CreateReferenceData, UpdateReferenceData, ResourceColor, ResourceCategory } from '../../types'

const RESOURCE_COLORS_DATA = [
  { value: null, label: 'None', class: '' },
  { value: 'red', label: 'Red', class: 'bg-red-500' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-500' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500' },
  { value: 'green', label: 'Green', class: 'bg-green-500' },
  { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' }
] as const

const DEFAULT_REFERENCE_CATEGORIES = ['General', 'Policy', 'Procedure', 'Template', 'Guide', 'Other']

interface ReferenceFormProps {
  reference?: SecureReference | null
  onSubmit: (data: CreateReferenceData | UpdateReferenceData) => void
  onCancel: () => void
}

export function ReferenceForm({ reference, onSubmit, onCancel }: ReferenceFormProps) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [name, setName] = useState(reference?.name || '')
  const [description, setDescription] = useState(reference?.description || '')
  const [category, setCategory] = useState(reference?.category || 'General')
  const [adminOnly, setAdminOnly] = useState(reference?.admin_only || false)
  const [color, setColor] = useState<ResourceColor>(reference?.color || null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [categories, setCategories] = useState<string[]>(DEFAULT_REFERENCE_CATEGORIES)

  const isEdit = !!reference

  // Load dynamic categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const result = await window.electronAPI.categories.getByType('reference')
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
    if (!name.trim()) newErrors.name = 'Name is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      admin_only: adminOnly,
      color
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Network Diagrams, Security Policies"
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
            errors.name ? 'border-red-300' : 'border-gray-300'
          }`}
        />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this reference collection contains..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Color Label */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Color Label</label>
        <div className="flex items-center gap-2">
          {RESOURCE_COLORS_DATA.map(c => (
            <button
              key={c.value || 'none'}
              type="button"
              onClick={() => setColor(c.value as ResourceColor)}
              className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center ${
                color === c.value
                  ? 'border-gray-900 ring-2 ring-gray-300'
                  : 'border-gray-300 hover:border-gray-400'
              } ${c.class || 'bg-gray-100'}`}
              title={c.label}
            >
              {c.value === null && color === null && (
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* Admin Only Toggle - Only visible to admins */}
      {isAdmin && (
        <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={adminOnly}
              onChange={(e) => setAdminOnly(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
          </label>
          <div>
            <span className="text-sm font-medium text-gray-700">Admin Only</span>
            <p className="text-xs text-gray-500">Hide this reference from non-admin users (files will be encrypted)</p>
          </div>
        </div>
      )}

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
          {isEdit ? 'Update Reference' : 'Create Reference'}
        </button>
      </div>
    </form>
  )
}
