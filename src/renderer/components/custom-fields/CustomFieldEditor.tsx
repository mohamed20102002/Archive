/**
 * Custom Field Editor
 *
 * Manages custom field definitions for an entity type.
 * Allows admins to create, edit, delete, and reorder custom fields.
 */

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  XMarkIcon,
  CheckIcon,
  Bars3Icon
} from '@heroicons/react/24/outline'

type CustomFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multi_select'
  | 'checkbox'
  | 'url'
  | 'email'
  | 'phone'
  | 'currency'

type CustomFieldEntityType =
  | 'records'
  | 'topics'
  | 'letters'
  | 'moms'
  | 'issues'
  | 'contacts'
  | 'authorities'

interface CustomFieldOption {
  value: string
  label: string
  color?: string
}

interface CustomFieldDefinition {
  id: string
  entity_type: CustomFieldEntityType
  name: string
  label: string
  field_type: CustomFieldType
  description?: string
  placeholder?: string
  default_value?: string
  options?: CustomFieldOption[]
  is_required: boolean
  is_searchable: boolean
  is_visible_in_list: boolean
  display_order: number
  validation_rules?: {
    min?: number
    max?: number
    min_length?: number
    max_length?: number
    pattern?: string
    pattern_message?: string
  }
  created_by: string
  created_at: string
  updated_at: string
}

interface CustomFieldEditorProps {
  entityType?: CustomFieldEntityType
  onFieldsChange?: () => void
}

const FIELD_TYPE_OPTIONS: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Multi-line Text' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & Time' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multi_select', label: 'Multi-select' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' }
]

const OPTION_COLORS = [
  '#EF4444', // red
  '#F97316', // orange
  '#EAB308', // yellow
  '#22C55E', // green
  '#06B6D4', // cyan
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#6B7280'  // gray
]

const ENTITY_TYPE_OPTIONS: { value: CustomFieldEntityType; label: string }[] = [
  { value: 'records', label: 'Records' },
  { value: 'topics', label: 'Topics' },
  { value: 'letters', label: 'Letters' },
  { value: 'moms', label: 'Minutes of Meeting' },
  { value: 'issues', label: 'Issues' },
  { value: 'contacts', label: 'Contacts' },
  { value: 'authorities', label: 'Authorities' }
]

export function CustomFieldEditor({ entityType: propEntityType, onFieldsChange }: CustomFieldEditorProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [selectedEntityType, setSelectedEntityType] = useState<CustomFieldEntityType>(propEntityType || 'records')
  const entityType = propEntityType || selectedEntityType

  const [fields, setFields] = useState<CustomFieldDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null)
  const [deletingField, setDeletingField] = useState<CustomFieldDefinition | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    label: '',
    field_type: 'text' as CustomFieldType,
    description: '',
    placeholder: '',
    default_value: '',
    options: [] as CustomFieldOption[],
    is_required: false,
    is_searchable: false,
    is_visible_in_list: false,
    validation_rules: {} as CustomFieldDefinition['validation_rules']
  })

  useEffect(() => {
    loadFields()
  }, [entityType])

  async function loadFields() {
    try {
      setLoading(true)
      const result = await window.electronAPI.customFields.getDefinitions(entityType)
      setFields(result)
    } catch (error) {
      console.error('Error loading custom fields:', error)
      showToast(t('customFields.loadError', 'Failed to load custom fields'), 'error')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      label: '',
      field_type: 'text',
      description: '',
      placeholder: '',
      default_value: '',
      options: [],
      is_required: false,
      is_searchable: false,
      is_visible_in_list: false,
      validation_rules: {}
    })
  }

  function openAddDialog() {
    resetForm()
    setEditingField(null)
    setShowAddDialog(true)
  }

  function openEditDialog(field: CustomFieldDefinition) {
    setFormData({
      name: field.name,
      label: field.label,
      field_type: field.field_type,
      description: field.description || '',
      placeholder: field.placeholder || '',
      default_value: field.default_value || '',
      options: field.options || [],
      is_required: field.is_required,
      is_searchable: field.is_searchable,
      is_visible_in_list: field.is_visible_in_list,
      validation_rules: field.validation_rules || {}
    })
    setEditingField(field)
    setShowAddDialog(true)
  }

  function closeDialog() {
    setShowAddDialog(false)
    setEditingField(null)
    resetForm()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!user) return

    // Generate name from label if not provided
    const name = formData.name || formData.label.toLowerCase().replace(/[^a-z0-9]/g, '_')

    try {
      if (editingField) {
        // Update existing field
        const result = await window.electronAPI.customFields.updateDefinition(
          editingField.id,
          {
            name,
            label: formData.label,
            description: formData.description || undefined,
            placeholder: formData.placeholder || undefined,
            default_value: formData.default_value || undefined,
            options: formData.options.length > 0 ? formData.options : undefined,
            is_required: formData.is_required,
            is_searchable: formData.is_searchable,
            is_visible_in_list: formData.is_visible_in_list,
            validation_rules: Object.keys(formData.validation_rules || {}).length > 0
              ? formData.validation_rules
              : undefined
          },
          user.id
        )

        if (result.success) {
          showToast(t('customFields.updateSuccess', 'Field updated successfully'), 'success')
          closeDialog()
          loadFields()
          onFieldsChange?.()
        } else {
          showToast(result.error || t('customFields.updateError', 'Failed to update field'), 'error')
        }
      } else {
        // Create new field
        const result = await window.electronAPI.customFields.createDefinition({
          entity_type: entityType,
          name,
          label: formData.label,
          field_type: formData.field_type,
          description: formData.description || undefined,
          placeholder: formData.placeholder || undefined,
          default_value: formData.default_value || undefined,
          options: formData.options.length > 0 ? formData.options : undefined,
          is_required: formData.is_required,
          is_searchable: formData.is_searchable,
          is_visible_in_list: formData.is_visible_in_list,
          validation_rules: Object.keys(formData.validation_rules || {}).length > 0
            ? formData.validation_rules
            : undefined,
          created_by: user.id
        })

        if (result.success) {
          showToast(t('customFields.createSuccess', 'Field created successfully'), 'success')
          closeDialog()
          loadFields()
          onFieldsChange?.()
        } else {
          showToast(result.error || t('customFields.createError', 'Failed to create field'), 'error')
        }
      }
    } catch (error) {
      console.error('Error saving custom field:', error)
      showToast(t('customFields.saveError', 'Failed to save field'), 'error')
    }
  }

  async function handleDelete(field: CustomFieldDefinition) {
    if (!user) return

    try {
      const result = await window.electronAPI.customFields.deleteDefinition(field.id, user.id)

      if (result.success) {
        showToast(t('customFields.deleteSuccess', 'Field deleted successfully'), 'success')
        setDeletingField(null)
        loadFields()
        onFieldsChange?.()
      } else {
        showToast(result.error || t('customFields.deleteError', 'Failed to delete field'), 'error')
      }
    } catch (error) {
      console.error('Error deleting custom field:', error)
      showToast(t('customFields.deleteError', 'Failed to delete field'), 'error')
    }
  }

  async function handleReorder(fieldId: string, direction: 'up' | 'down') {
    if (!user) return

    const currentIndex = fields.findIndex(f => f.id === fieldId)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= fields.length) return

    const newOrder = [...fields]
    const [moved] = newOrder.splice(currentIndex, 1)
    newOrder.splice(newIndex, 0, moved)

    const fieldIds = newOrder.map(f => f.id)

    try {
      const result = await window.electronAPI.customFields.reorderDefinitions(entityType, fieldIds, user.id)

      if (result.success) {
        setFields(newOrder)
        onFieldsChange?.()
      } else {
        showToast(result.error || t('customFields.reorderError', 'Failed to reorder fields'), 'error')
      }
    } catch (error) {
      console.error('Error reordering fields:', error)
    }
  }

  function addOption() {
    setFormData(prev => ({
      ...prev,
      options: [
        ...prev.options,
        { value: `option_${prev.options.length + 1}`, label: '', color: OPTION_COLORS[prev.options.length % OPTION_COLORS.length] }
      ]
    }))
  }

  function updateOption(index: number, updates: Partial<CustomFieldOption>) {
    setFormData(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === index ? { ...opt, ...updates } : opt)
    }))
  }

  function removeOption(index: number) {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }))
  }

  const needsOptions = formData.field_type === 'select' || formData.field_type === 'multi_select'

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Entity Type Selector (when no prop provided) */}
      {!propEntityType && (
        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('customFields.entityType', 'Entity Type')}:
          </label>
          <select
            value={selectedEntityType}
            onChange={(e) => setSelectedEntityType(e.target.value as CustomFieldEntityType)}
            className="flex-1 max-w-xs px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm"
          >
            {ENTITY_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {t('customFields.title', 'Custom Fields')} - {ENTITY_TYPE_OPTIONS.find(o => o.value === entityType)?.label}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('customFields.description', 'Define additional fields for this entity type')}
          </p>
        </div>
        <button
          onClick={openAddDialog}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          {t('customFields.addField', 'Add Field')}
        </button>
      </div>

      {/* Fields List */}
      {fields.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          {t('customFields.noFields', 'No custom fields defined yet')}
        </div>
      ) : (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('customFields.label', 'Label')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('customFields.type', 'Type')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('customFields.required', 'Required')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('customFields.searchable', 'Searchable')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('common.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {fields.map((field, index) => (
                <tr key={field.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex flex-col">
                      <button
                        onClick={() => handleReorder(field.id, 'up')}
                        disabled={index === 0}
                        className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronUpIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleReorder(field.id, 'down')}
                        disabled={index === fields.length - 1}
                        className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronDownIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{field.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{field.name}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {FIELD_TYPE_OPTIONS.find(o => o.value === field.field_type)?.label || field.field_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {field.is_required ? (
                      <CheckIcon className="h-5 w-5 text-green-500" />
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {field.is_searchable ? (
                      <CheckIcon className="h-5 w-5 text-green-500" />
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <button
                      onClick={() => openEditDialog(field)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeletingField(field)}
                      className="p-1 text-gray-400 hover:text-red-500 ml-2"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                {editingField
                  ? t('customFields.editField', 'Edit Field')
                  : t('customFields.addField', 'Add Field')}
              </h2>
              <button onClick={closeDialog} className="text-gray-400 hover:text-gray-500">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              {/* Label */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('customFields.label', 'Label')} *
                </label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={e => setFormData({ ...formData, label: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                  required
                />
              </div>

              {/* Field Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('customFields.type', 'Type')} *
                </label>
                <select
                  value={formData.field_type}
                  onChange={e => setFormData({ ...formData, field_type: e.target.value as CustomFieldType })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                  disabled={!!editingField}
                >
                  {FIELD_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Options for select/multi_select */}
              {needsOptions && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('customFields.options', 'Options')}
                  </label>
                  <div className="space-y-2">
                    {formData.options.map((option, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={option.color || '#6B7280'}
                          onChange={e => updateOption(index, { color: e.target.value })}
                          className="h-8 w-8 rounded border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={option.label}
                          onChange={e => updateOption(index, {
                            label: e.target.value,
                            value: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_')
                          })}
                          placeholder={t('customFields.optionLabel', 'Option label')}
                          className="flex-1 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeOption(index)}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addOption}
                      className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700"
                    >
                      <PlusIcon className="h-4 w-4 mr-1" />
                      {t('customFields.addOption', 'Add Option')}
                    </button>
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('customFields.fieldDescription', 'Description')}
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                  placeholder={t('customFields.descriptionPlaceholder', 'Help text for users')}
                />
              </div>

              {/* Placeholder */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('customFields.placeholder', 'Placeholder')}
                </label>
                <input
                  type="text"
                  value={formData.placeholder}
                  onChange={e => setFormData({ ...formData, placeholder: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                />
              </div>

              {/* Options */}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_required}
                    onChange={e => setFormData({ ...formData, is_required: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    {t('customFields.required', 'Required')}
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_searchable}
                    onChange={e => setFormData({ ...formData, is_searchable: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    {t('customFields.searchable', 'Searchable')}
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_visible_in_list}
                    onChange={e => setFormData({ ...formData, is_visible_in_list: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    {t('customFields.showInList', 'Show in list')}
                  </span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  {editingField ? t('common.save', 'Save') : t('common.create', 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t('customFields.deleteConfirmTitle', 'Delete Field')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {t('customFields.deleteConfirmMessage', 'Are you sure you want to delete the field "{{label}}"? All values for this field will be permanently deleted.', { label: deletingField.label })}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeletingField(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={() => handleDelete(deletingField)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
              >
                {t('common.delete', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomFieldEditor
