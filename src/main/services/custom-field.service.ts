/**
 * Custom Field Service
 *
 * Allows users to define custom fields for entities (records, topics, letters, etc.)
 * Supports various field types: text, number, date, select, multi-select, checkbox, url
 */

import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'
import { getUsername } from './auth.service'
import { randomUUID } from 'crypto'

// Field types supported
export type CustomFieldType =
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

// Entity types that support custom fields
export type CustomFieldEntityType =
  | 'records'
  | 'topics'
  | 'letters'
  | 'moms'
  | 'issues'
  | 'contacts'
  | 'authorities'

export interface CustomFieldOption {
  value: string
  label: string
  color?: string
}

export interface CustomFieldDefinition {
  id: string
  entity_type: CustomFieldEntityType
  name: string
  label: string
  field_type: CustomFieldType
  description?: string
  placeholder?: string
  default_value?: string
  options?: CustomFieldOption[] // For select/multi_select
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

export interface CustomFieldValue {
  id: string
  field_id: string
  entity_type: CustomFieldEntityType
  entity_id: string
  value: string // JSON stringified for complex values
  created_at: string
  updated_at: string
}

export interface CreateFieldInput {
  entity_type: CustomFieldEntityType
  name: string
  label: string
  field_type: CustomFieldType
  description?: string
  placeholder?: string
  default_value?: string
  options?: CustomFieldOption[]
  is_required?: boolean
  is_searchable?: boolean
  is_visible_in_list?: boolean
  display_order?: number
  validation_rules?: CustomFieldDefinition['validation_rules']
  created_by: string
}

export interface UpdateFieldInput {
  name?: string
  label?: string
  description?: string
  placeholder?: string
  default_value?: string
  options?: CustomFieldOption[]
  is_required?: boolean
  is_searchable?: boolean
  is_visible_in_list?: boolean
  display_order?: number
  validation_rules?: CustomFieldDefinition['validation_rules']
}

// ===== Table Initialization =====

export function ensureCustomFieldTables(): void {
  const db = getDatabase()

  // Custom field definitions
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_field_definitions (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      name TEXT NOT NULL,
      label TEXT NOT NULL,
      field_type TEXT NOT NULL,
      description TEXT,
      placeholder TEXT,
      default_value TEXT,
      options TEXT,
      is_required INTEGER DEFAULT 0,
      is_searchable INTEGER DEFAULT 0,
      is_visible_in_list INTEGER DEFAULT 0,
      display_order INTEGER DEFAULT 0,
      validation_rules TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(entity_type, name),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `)

  // Custom field values
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_field_values (
      id TEXT PRIMARY KEY,
      field_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      value TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(field_id, entity_id),
      FOREIGN KEY (field_id) REFERENCES custom_field_definitions(id) ON DELETE CASCADE
    )
  `)

  // Indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_custom_field_defs_entity
    ON custom_field_definitions(entity_type, display_order)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_custom_field_values_entity
    ON custom_field_values(entity_type, entity_id)
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_custom_field_values_field
    ON custom_field_values(field_id)
  `)
}

// ===== Field Definition CRUD =====

/**
 * Create a new custom field definition
 */
export function createFieldDefinition(
  input: CreateFieldInput
): { success: boolean; field?: CustomFieldDefinition; error?: string } {
  ensureCustomFieldTables()
  const db = getDatabase()

  const id = randomUUID()
  const now = new Date().toISOString()

  // Validate name format (alphanumeric + underscore)
  const nameRegex = /^[a-z][a-z0-9_]*$/
  if (!nameRegex.test(input.name)) {
    return {
      success: false,
      error: 'Field name must start with a letter and contain only lowercase letters, numbers, and underscores'
    }
  }

  // Get max display order
  let displayOrder = input.display_order
  if (displayOrder === undefined) {
    const maxOrder = db.prepare(`
      SELECT MAX(display_order) as max_order
      FROM custom_field_definitions
      WHERE entity_type = ?
    `).get(input.entity_type) as { max_order: number | null }
    displayOrder = (maxOrder?.max_order ?? -1) + 1
  }

  try {
    db.prepare(`
      INSERT INTO custom_field_definitions (
        id, entity_type, name, label, field_type, description, placeholder,
        default_value, options, is_required, is_searchable, is_visible_in_list,
        display_order, validation_rules, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.entity_type,
      input.name,
      input.label,
      input.field_type,
      input.description || null,
      input.placeholder || null,
      input.default_value || null,
      input.options ? JSON.stringify(input.options) : null,
      input.is_required ? 1 : 0,
      input.is_searchable ? 1 : 0,
      input.is_visible_in_list ? 1 : 0,
      displayOrder,
      input.validation_rules ? JSON.stringify(input.validation_rules) : null,
      input.created_by,
      now,
      now
    )

    logAudit('CUSTOM_FIELD_CREATE', input.created_by, getUsername(input.created_by), 'custom_field', id, {
      entity_type: input.entity_type,
      name: input.name,
      field_type: input.field_type
    })

    const field: CustomFieldDefinition = {
      id,
      entity_type: input.entity_type,
      name: input.name,
      label: input.label,
      field_type: input.field_type,
      description: input.description,
      placeholder: input.placeholder,
      default_value: input.default_value,
      options: input.options,
      is_required: input.is_required ?? false,
      is_searchable: input.is_searchable ?? false,
      is_visible_in_list: input.is_visible_in_list ?? false,
      display_order: displayOrder,
      validation_rules: input.validation_rules,
      created_by: input.created_by,
      created_at: now,
      updated_at: now
    }

    return { success: true, field }
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { success: false, error: 'A field with this name already exists for this entity type' }
    }
    console.error('Error creating custom field:', error)
    return { success: false, error: 'Failed to create custom field' }
  }
}

/**
 * Get all field definitions for an entity type
 */
export function getFieldDefinitions(entityType: CustomFieldEntityType): CustomFieldDefinition[] {
  ensureCustomFieldTables()
  const db = getDatabase()

  const rows = db.prepare(`
    SELECT * FROM custom_field_definitions
    WHERE entity_type = ?
    ORDER BY display_order ASC
  `).all(entityType) as any[]

  return rows.map(parseFieldDefinition)
}

/**
 * Get a single field definition by ID
 */
export function getFieldDefinitionById(id: string): CustomFieldDefinition | null {
  ensureCustomFieldTables()
  const db = getDatabase()

  const row = db.prepare('SELECT * FROM custom_field_definitions WHERE id = ?').get(id) as any
  if (!row) return null

  return parseFieldDefinition(row)
}

/**
 * Get a field definition by name and entity type
 */
export function getFieldDefinitionByName(
  entityType: CustomFieldEntityType,
  name: string
): CustomFieldDefinition | null {
  ensureCustomFieldTables()
  const db = getDatabase()

  const row = db.prepare(`
    SELECT * FROM custom_field_definitions
    WHERE entity_type = ? AND name = ?
  `).get(entityType, name) as any

  if (!row) return null

  return parseFieldDefinition(row)
}

/**
 * Update a field definition
 */
export function updateFieldDefinition(
  id: string,
  input: UpdateFieldInput,
  userId: string
): { success: boolean; error?: string } {
  ensureCustomFieldTables()
  const db = getDatabase()

  const now = new Date().toISOString()
  const existing = getFieldDefinitionById(id)

  if (!existing) {
    return { success: false, error: 'Field definition not found' }
  }

  const updates: string[] = ['updated_at = ?']
  const values: any[] = [now]

  if (input.name !== undefined) {
    const nameRegex = /^[a-z][a-z0-9_]*$/
    if (!nameRegex.test(input.name)) {
      return {
        success: false,
        error: 'Field name must start with a letter and contain only lowercase letters, numbers, and underscores'
      }
    }
    updates.push('name = ?')
    values.push(input.name)
  }

  if (input.label !== undefined) {
    updates.push('label = ?')
    values.push(input.label)
  }

  if (input.description !== undefined) {
    updates.push('description = ?')
    values.push(input.description)
  }

  if (input.placeholder !== undefined) {
    updates.push('placeholder = ?')
    values.push(input.placeholder)
  }

  if (input.default_value !== undefined) {
    updates.push('default_value = ?')
    values.push(input.default_value)
  }

  if (input.options !== undefined) {
    updates.push('options = ?')
    values.push(JSON.stringify(input.options))
  }

  if (input.is_required !== undefined) {
    updates.push('is_required = ?')
    values.push(input.is_required ? 1 : 0)
  }

  if (input.is_searchable !== undefined) {
    updates.push('is_searchable = ?')
    values.push(input.is_searchable ? 1 : 0)
  }

  if (input.is_visible_in_list !== undefined) {
    updates.push('is_visible_in_list = ?')
    values.push(input.is_visible_in_list ? 1 : 0)
  }

  if (input.display_order !== undefined) {
    updates.push('display_order = ?')
    values.push(input.display_order)
  }

  if (input.validation_rules !== undefined) {
    updates.push('validation_rules = ?')
    values.push(JSON.stringify(input.validation_rules))
  }

  values.push(id)

  try {
    db.prepare(`
      UPDATE custom_field_definitions
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values)

    logAudit('CUSTOM_FIELD_UPDATE', userId, getUsername(userId), 'custom_field', id, input)

    return { success: true }
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { success: false, error: 'A field with this name already exists for this entity type' }
    }
    console.error('Error updating custom field:', error)
    return { success: false, error: 'Failed to update custom field' }
  }
}

/**
 * Delete a field definition and all its values
 */
export function deleteFieldDefinition(
  id: string,
  userId: string
): { success: boolean; error?: string } {
  ensureCustomFieldTables()
  const db = getDatabase()

  const existing = getFieldDefinitionById(id)
  if (!existing) {
    return { success: false, error: 'Field definition not found' }
  }

  try {
    db.transaction(() => {
      // Delete all values for this field
      db.prepare('DELETE FROM custom_field_values WHERE field_id = ?').run(id)
      // Delete the field definition
      db.prepare('DELETE FROM custom_field_definitions WHERE id = ?').run(id)
    })()

    logAudit('CUSTOM_FIELD_DELETE', userId, getUsername(userId), 'custom_field', id, {
      name: existing.name,
      entity_type: existing.entity_type
    })

    return { success: true }
  } catch (error) {
    console.error('Error deleting custom field:', error)
    return { success: false, error: 'Failed to delete custom field' }
  }
}

/**
 * Reorder field definitions
 */
export function reorderFieldDefinitions(
  entityType: CustomFieldEntityType,
  fieldIds: string[],
  userId: string
): { success: boolean; error?: string } {
  ensureCustomFieldTables()
  const db = getDatabase()

  try {
    db.transaction(() => {
      const update = db.prepare(`
        UPDATE custom_field_definitions
        SET display_order = ?, updated_at = ?
        WHERE id = ? AND entity_type = ?
      `)
      const now = new Date().toISOString()

      fieldIds.forEach((id, index) => {
        update.run(index, now, id, entityType)
      })
    })()

    logAudit('CUSTOM_FIELD_REORDER', userId, getUsername(userId), 'custom_field', entityType, {
      order: fieldIds
    })

    return { success: true }
  } catch (error) {
    console.error('Error reordering custom fields:', error)
    return { success: false, error: 'Failed to reorder custom fields' }
  }
}

// ===== Field Values CRUD =====

/**
 * Set a custom field value for an entity
 */
export function setFieldValue(
  fieldId: string,
  entityType: CustomFieldEntityType,
  entityId: string,
  value: any
): { success: boolean; error?: string } {
  ensureCustomFieldTables()
  const db = getDatabase()

  const field = getFieldDefinitionById(fieldId)
  if (!field) {
    return { success: false, error: 'Field definition not found' }
  }

  // Validate the value
  const validationError = validateFieldValue(field, value)
  if (validationError) {
    return { success: false, error: validationError }
  }

  const now = new Date().toISOString()
  const stringValue = serializeFieldValue(field.field_type, value)

  try {
    db.prepare(`
      INSERT INTO custom_field_values (id, field_id, entity_type, entity_id, value, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(field_id, entity_id) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `).run(randomUUID(), fieldId, entityType, entityId, stringValue, now, now)

    return { success: true }
  } catch (error) {
    console.error('Error setting custom field value:', error)
    return { success: false, error: 'Failed to set custom field value' }
  }
}

/**
 * Set multiple custom field values for an entity
 */
export function setFieldValues(
  entityType: CustomFieldEntityType,
  entityId: string,
  values: Record<string, any>
): { success: boolean; errors?: Record<string, string> } {
  ensureCustomFieldTables()
  const db = getDatabase()

  const errors: Record<string, string> = {}
  const fields = getFieldDefinitions(entityType)
  const fieldsByName = new Map(fields.map(f => [f.name, f]))

  try {
    db.transaction(() => {
      const now = new Date().toISOString()

      for (const [fieldName, value] of Object.entries(values)) {
        const field = fieldsByName.get(fieldName)
        if (!field) {
          errors[fieldName] = 'Unknown field'
          continue
        }

        const validationError = validateFieldValue(field, value)
        if (validationError) {
          errors[fieldName] = validationError
          continue
        }

        const stringValue = serializeFieldValue(field.field_type, value)

        db.prepare(`
          INSERT INTO custom_field_values (id, field_id, entity_type, entity_id, value, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(field_id, entity_id) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at
        `).run(randomUUID(), field.id, entityType, entityId, stringValue, now, now)
      }
    })()

    return { success: Object.keys(errors).length === 0, errors: Object.keys(errors).length > 0 ? errors : undefined }
  } catch (error) {
    console.error('Error setting custom field values:', error)
    return { success: false, errors: { _error: 'Failed to set custom field values' } }
  }
}

/**
 * Get all custom field values for an entity
 */
export function getFieldValues(
  entityType: CustomFieldEntityType,
  entityId: string
): Record<string, any> {
  ensureCustomFieldTables()
  const db = getDatabase()

  const rows = db.prepare(`
    SELECT cfv.*, cfd.name, cfd.field_type
    FROM custom_field_values cfv
    JOIN custom_field_definitions cfd ON cfd.id = cfv.field_id
    WHERE cfv.entity_type = ? AND cfv.entity_id = ?
  `).all(entityType, entityId) as any[]

  const values: Record<string, any> = {}
  for (const row of rows) {
    values[row.name] = deserializeFieldValue(row.field_type, row.value)
  }

  return values
}

/**
 * Get custom field values with definitions for an entity
 */
export function getFieldValuesWithDefinitions(
  entityType: CustomFieldEntityType,
  entityId: string
): Array<{ field: CustomFieldDefinition; value: any }> {
  ensureCustomFieldTables()
  const db = getDatabase()

  const fields = getFieldDefinitions(entityType)
  const values = getFieldValues(entityType, entityId)

  return fields.map(field => ({
    field,
    value: values[field.name] ?? (field.default_value ? deserializeFieldValue(field.field_type, field.default_value) : null)
  }))
}

/**
 * Delete all custom field values for an entity
 */
export function deleteFieldValuesForEntity(
  entityType: CustomFieldEntityType,
  entityId: string
): { success: boolean; error?: string } {
  ensureCustomFieldTables()
  const db = getDatabase()

  try {
    db.prepare(`
      DELETE FROM custom_field_values
      WHERE entity_type = ? AND entity_id = ?
    `).run(entityType, entityId)

    return { success: true }
  } catch (error) {
    console.error('Error deleting custom field values:', error)
    return { success: false, error: 'Failed to delete custom field values' }
  }
}

/**
 * Search entities by custom field value
 */
export function searchByCustomField(
  entityType: CustomFieldEntityType,
  fieldName: string,
  value: string,
  operator: 'eq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' = 'eq'
): string[] {
  ensureCustomFieldTables()
  const db = getDatabase()

  const field = getFieldDefinitionByName(entityType, fieldName)
  if (!field) return []

  let sql = `
    SELECT entity_id FROM custom_field_values
    WHERE field_id = ?
  `
  const params: any[] = [field.id]

  switch (operator) {
    case 'contains':
      sql += ' AND value LIKE ?'
      params.push(`%${value}%`)
      break
    case 'gt':
      sql += ' AND CAST(value AS REAL) > ?'
      params.push(parseFloat(value))
      break
    case 'lt':
      sql += ' AND CAST(value AS REAL) < ?'
      params.push(parseFloat(value))
      break
    case 'gte':
      sql += ' AND CAST(value AS REAL) >= ?'
      params.push(parseFloat(value))
      break
    case 'lte':
      sql += ' AND CAST(value AS REAL) <= ?'
      params.push(parseFloat(value))
      break
    default: // eq
      sql += ' AND value = ?'
      params.push(value)
  }

  const rows = db.prepare(sql).all(...params) as { entity_id: string }[]
  return rows.map(r => r.entity_id)
}

// ===== Helper Functions =====

function parseFieldDefinition(row: any): CustomFieldDefinition {
  return {
    ...row,
    options: row.options ? JSON.parse(row.options) : undefined,
    validation_rules: row.validation_rules ? JSON.parse(row.validation_rules) : undefined,
    is_required: Boolean(row.is_required),
    is_searchable: Boolean(row.is_searchable),
    is_visible_in_list: Boolean(row.is_visible_in_list)
  }
}

function serializeFieldValue(fieldType: CustomFieldType, value: any): string {
  if (value === null || value === undefined) return ''

  switch (fieldType) {
    case 'checkbox':
      return value ? '1' : '0'
    case 'multi_select':
      return Array.isArray(value) ? JSON.stringify(value) : ''
    case 'number':
    case 'currency':
      return String(value)
    default:
      return String(value)
  }
}

function deserializeFieldValue(fieldType: CustomFieldType, value: string): any {
  if (value === null || value === undefined || value === '') return null

  switch (fieldType) {
    case 'checkbox':
      return value === '1' || value === 'true'
    case 'multi_select':
      try {
        return JSON.parse(value)
      } catch {
        return []
      }
    case 'number':
      return parseFloat(value)
    case 'currency':
      return parseFloat(value)
    default:
      return value
  }
}

function validateFieldValue(field: CustomFieldDefinition, value: any): string | null {
  // Required check
  if (field.is_required && (value === null || value === undefined || value === '')) {
    return `${field.label} is required`
  }

  // Skip further validation if empty
  if (value === null || value === undefined || value === '') {
    return null
  }

  const rules = field.validation_rules

  // Type-specific validation
  switch (field.field_type) {
    case 'number':
    case 'currency':
      const num = parseFloat(value)
      if (isNaN(num)) return `${field.label} must be a number`
      if (rules?.min !== undefined && num < rules.min) {
        return `${field.label} must be at least ${rules.min}`
      }
      if (rules?.max !== undefined && num > rules.max) {
        return `${field.label} must be at most ${rules.max}`
      }
      break

    case 'text':
    case 'textarea':
      const str = String(value)
      if (rules?.min_length !== undefined && str.length < rules.min_length) {
        return `${field.label} must be at least ${rules.min_length} characters`
      }
      if (rules?.max_length !== undefined && str.length > rules.max_length) {
        return `${field.label} must be at most ${rules.max_length} characters`
      }
      if (rules?.pattern) {
        const regex = new RegExp(rules.pattern)
        if (!regex.test(str)) {
          return rules.pattern_message || `${field.label} format is invalid`
        }
      }
      break

    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(String(value))) {
        return `${field.label} must be a valid email address`
      }
      break

    case 'url':
      try {
        new URL(String(value))
      } catch {
        return `${field.label} must be a valid URL`
      }
      break

    case 'select':
      if (field.options && !field.options.some(o => o.value === value)) {
        return `${field.label} must be one of the available options`
      }
      break

    case 'multi_select':
      if (!Array.isArray(value)) {
        return `${field.label} must be an array`
      }
      if (field.options) {
        const validValues = field.options.map(o => o.value)
        for (const v of value) {
          if (!validValues.includes(v)) {
            return `${field.label} contains invalid option: ${v}`
          }
        }
      }
      break
  }

  return null
}

export default {
  ensureCustomFieldTables,
  createFieldDefinition,
  getFieldDefinitions,
  getFieldDefinitionById,
  getFieldDefinitionByName,
  updateFieldDefinition,
  deleteFieldDefinition,
  reorderFieldDefinitions,
  setFieldValue,
  setFieldValues,
  getFieldValues,
  getFieldValuesWithDefinitions,
  deleteFieldValuesForEntity,
  searchByCustomField
}
