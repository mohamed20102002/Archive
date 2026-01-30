import React, { useState } from 'react'
import type { SecureReference, ReferenceCategory, CreateReferenceData, UpdateReferenceData } from '../../types'

const REFERENCE_CATEGORIES: ReferenceCategory[] = ['General', 'Policy', 'Procedure', 'Template', 'Guide', 'Other']

interface ReferenceFormProps {
  reference?: SecureReference | null
  onSubmit: (data: CreateReferenceData | UpdateReferenceData) => void
  onCancel: () => void
}

export function ReferenceForm({ reference, onSubmit, onCancel }: ReferenceFormProps) {
  const [name, setName] = useState(reference?.name || '')
  const [description, setDescription] = useState(reference?.description || '')
  const [category, setCategory] = useState<ReferenceCategory>(reference?.category || 'General')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isEdit = !!reference

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
      category
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
          onChange={(e) => setCategory(e.target.value as ReferenceCategory)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {REFERENCE_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
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
          {isEdit ? 'Update Reference' : 'Create Reference'}
        </button>
      </div>
    </form>
  )
}
