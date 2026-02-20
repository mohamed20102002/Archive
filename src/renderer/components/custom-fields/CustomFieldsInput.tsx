/**
 * Custom Fields Input
 *
 * Renders custom field inputs based on field definitions.
 * Used in entity forms to display and edit custom field values.
 */

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

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
}

interface CustomFieldsInputProps {
  entityType: CustomFieldEntityType
  entityId?: string
  values: Record<string, any>
  onChange: (values: Record<string, any>) => void
  disabled?: boolean
  compact?: boolean
}

export function CustomFieldsInput({
  entityType,
  entityId,
  values,
  onChange,
  disabled = false,
  compact = false
}: CustomFieldsInputProps) {
  const { t } = useTranslation()
  const [fields, setFields] = useState<CustomFieldDefinition[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFields()
  }, [entityType])

  useEffect(() => {
    if (entityId && fields.length > 0) {
      loadValues()
    }
  }, [entityId, fields])

  async function loadFields() {
    try {
      setLoading(true)
      const result = await window.electronAPI.customFields.getDefinitions(entityType)
      setFields(result)

      // Initialize values with defaults
      const defaults: Record<string, any> = {}
      result.forEach(field => {
        if (field.default_value && values[field.name] === undefined) {
          defaults[field.name] = parseDefaultValue(field)
        }
      })
      if (Object.keys(defaults).length > 0) {
        onChange({ ...values, ...defaults })
      }
    } catch (error) {
      console.error('Error loading custom fields:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadValues() {
    if (!entityId) return

    try {
      const result = await window.electronAPI.customFields.getFieldValues(entityType, entityId)
      if (Object.keys(result).length > 0) {
        onChange({ ...values, ...result })
      }
    } catch (error) {
      console.error('Error loading custom field values:', error)
    }
  }

  function parseDefaultValue(field: CustomFieldDefinition): any {
    if (!field.default_value) return null

    switch (field.field_type) {
      case 'checkbox':
        return field.default_value === 'true' || field.default_value === '1'
      case 'number':
      case 'currency':
        return parseFloat(field.default_value)
      case 'multi_select':
        try {
          return JSON.parse(field.default_value)
        } catch {
          return []
        }
      default:
        return field.default_value
    }
  }

  function handleChange(fieldName: string, value: any) {
    onChange({ ...values, [fieldName]: value })
  }

  function renderField(field: CustomFieldDefinition) {
    const value = values[field.name]
    const fieldId = `custom-field-${field.name}`

    const labelClasses = compact
      ? 'block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1'
      : 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

    const inputClasses = compact
      ? 'block w-full rounded border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white text-xs'
      : 'block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white sm:text-sm'

    switch (field.field_type) {
      case 'text':
      case 'url':
      case 'email':
      case 'phone':
        return (
          <div key={field.id}>
            <label htmlFor={fieldId} className={labelClasses}>
              {field.label}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              id={fieldId}
              type={field.field_type === 'email' ? 'email' : field.field_type === 'url' ? 'url' : 'text'}
              value={value || ''}
              onChange={e => handleChange(field.name, e.target.value)}
              disabled={disabled}
              placeholder={field.placeholder}
              required={field.is_required}
              className={inputClasses}
            />
            {field.description && (
              <p className="mt-1 text-xs text-gray-500">{field.description}</p>
            )}
          </div>
        )

      case 'textarea':
        return (
          <div key={field.id}>
            <label htmlFor={fieldId} className={labelClasses}>
              {field.label}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              id={fieldId}
              value={value || ''}
              onChange={e => handleChange(field.name, e.target.value)}
              disabled={disabled}
              placeholder={field.placeholder}
              required={field.is_required}
              rows={3}
              className={inputClasses}
            />
            {field.description && (
              <p className="mt-1 text-xs text-gray-500">{field.description}</p>
            )}
          </div>
        )

      case 'number':
      case 'currency':
        return (
          <div key={field.id}>
            <label htmlFor={fieldId} className={labelClasses}>
              {field.label}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="relative">
              {field.field_type === 'currency' && (
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">$</span>
              )}
              <input
                id={fieldId}
                type="number"
                value={value ?? ''}
                onChange={e => handleChange(field.name, e.target.value ? parseFloat(e.target.value) : null)}
                disabled={disabled}
                placeholder={field.placeholder}
                required={field.is_required}
                step={field.field_type === 'currency' ? '0.01' : 'any'}
                className={`${inputClasses} ${field.field_type === 'currency' ? 'pl-7' : ''}`}
              />
            </div>
            {field.description && (
              <p className="mt-1 text-xs text-gray-500">{field.description}</p>
            )}
          </div>
        )

      case 'date':
        return (
          <div key={field.id}>
            <label htmlFor={fieldId} className={labelClasses}>
              {field.label}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              id={fieldId}
              type="date"
              value={value || ''}
              onChange={e => handleChange(field.name, e.target.value)}
              disabled={disabled}
              required={field.is_required}
              className={inputClasses}
            />
            {field.description && (
              <p className="mt-1 text-xs text-gray-500">{field.description}</p>
            )}
          </div>
        )

      case 'datetime':
        return (
          <div key={field.id}>
            <label htmlFor={fieldId} className={labelClasses}>
              {field.label}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              id={fieldId}
              type="datetime-local"
              value={value || ''}
              onChange={e => handleChange(field.name, e.target.value)}
              disabled={disabled}
              required={field.is_required}
              className={inputClasses}
            />
            {field.description && (
              <p className="mt-1 text-xs text-gray-500">{field.description}</p>
            )}
          </div>
        )

      case 'select':
        return (
          <div key={field.id}>
            <label htmlFor={fieldId} className={labelClasses}>
              {field.label}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              id={fieldId}
              value={value || ''}
              onChange={e => handleChange(field.name, e.target.value)}
              disabled={disabled}
              required={field.is_required}
              className={inputClasses}
            >
              <option value="">{field.placeholder || t('common.select', 'Select...')}</option>
              {field.options?.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {field.description && (
              <p className="mt-1 text-xs text-gray-500">{field.description}</p>
            )}
          </div>
        )

      case 'multi_select':
        const selectedValues = Array.isArray(value) ? value : []
        return (
          <div key={field.id}>
            <label className={labelClasses}>
              {field.label}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="space-y-2">
              {field.options?.map(opt => (
                <label key={opt.value} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(opt.value)}
                    onChange={e => {
                      const newValues = e.target.checked
                        ? [...selectedValues, opt.value]
                        : selectedValues.filter(v => v !== opt.value)
                      handleChange(field.name, newValues)
                    }}
                    disabled={disabled}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span
                    className="ml-2 text-sm"
                    style={{ color: opt.color }}
                  >
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
            {field.description && (
              <p className="mt-1 text-xs text-gray-500">{field.description}</p>
            )}
          </div>
        )

      case 'checkbox':
        return (
          <div key={field.id} className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id={fieldId}
                type="checkbox"
                checked={!!value}
                onChange={e => handleChange(field.name, e.target.checked)}
                disabled={disabled}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
            </div>
            <div className="ml-3">
              <label htmlFor={fieldId} className={labelClasses}>
                {field.label}
                {field.is_required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {field.description && (
                <p className="text-xs text-gray-500">{field.description}</p>
              )}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    )
  }

  if (fields.length === 0) {
    return null
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {fields.map(field => renderField(field))}
    </div>
  )
}

/**
 * Display custom field values (read-only)
 */
interface CustomFieldsDisplayProps {
  entityType: CustomFieldEntityType
  entityId: string
  className?: string
}

export function CustomFieldsDisplay({ entityType, entityId, className }: CustomFieldsDisplayProps) {
  const [fieldsWithValues, setFieldsWithValues] = useState<Array<{
    field: CustomFieldDefinition
    value: any
  }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFieldsWithValues()
  }, [entityType, entityId])

  async function loadFieldsWithValues() {
    try {
      setLoading(true)
      const result = await window.electronAPI.customFields.getFieldValuesWithDefinitions(entityType, entityId)
      setFieldsWithValues(result.filter(item => item.value !== null && item.value !== undefined && item.value !== ''))
    } catch (error) {
      console.error('Error loading custom field values:', error)
    } finally {
      setLoading(false)
    }
  }

  function formatValue(field: CustomFieldDefinition, value: any): string {
    if (value === null || value === undefined) return '-'

    switch (field.field_type) {
      case 'checkbox':
        return value ? 'Yes' : 'No'
      case 'currency':
        return `$${Number(value).toFixed(2)}`
      case 'date':
        return new Date(value).toLocaleDateString()
      case 'datetime':
        return new Date(value).toLocaleString()
      case 'select':
        const option = field.options?.find(o => o.value === value)
        return option?.label || value
      case 'multi_select':
        if (Array.isArray(value)) {
          return value
            .map(v => field.options?.find(o => o.value === v)?.label || v)
            .join(', ')
        }
        return value
      default:
        return String(value)
    }
  }

  if (loading) {
    return <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
  }

  if (fieldsWithValues.length === 0) {
    return null
  }

  return (
    <div className={className}>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
        {fieldsWithValues.map(({ field, value }) => (
          <div key={field.id}>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {field.label}
            </dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">
              {formatValue(field, value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export default CustomFieldsInput
