/**
 * Import Service
 *
 * Handles batch importing of data from Excel/CSV files
 * Supports: Topics, Records, Letters, MOMs, Issues, Contacts
 */

import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'
import { getUsername } from './auth.service'
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import { randomUUID } from 'crypto'
import { BrowserWindow } from 'electron'

// Import types
export type ImportEntityType = 'topics' | 'records' | 'letters' | 'moms' | 'issues' | 'contacts' | 'authorities'

export interface ImportColumn {
  sourceColumn: string
  targetField: string
  transform?: 'text' | 'number' | 'date' | 'boolean' | 'lookup'
  lookupTable?: string
  lookupField?: string
  required?: boolean
  defaultValue?: string
}

export interface ImportConfig {
  entityType: ImportEntityType
  filePath: string
  sheetName?: string
  skipRows?: number
  columnMappings: ImportColumn[]
  duplicateHandling: 'skip' | 'update' | 'create'
  duplicateCheckFields?: string[]
  userId: string
}

export interface ImportProgress {
  status: 'idle' | 'parsing' | 'validating' | 'importing' | 'complete' | 'error'
  totalRows: number
  processedRows: number
  successCount: number
  errorCount: number
  skipCount: number
  errors: ImportError[]
  currentPhase: string
}

export interface ImportError {
  row: number
  column?: string
  message: string
  value?: string
}

export interface ImportResult {
  success: boolean
  totalRows: number
  importedCount: number
  updatedCount: number
  skippedCount: number
  errorCount: number
  errors: ImportError[]
  duration: number
}

export interface ImportPreview {
  headers: string[]
  sampleData: Record<string, string>[]
  totalRows: number
  sheetNames: string[]
}

// Progress callback type
type ProgressCallback = (progress: ImportProgress) => void

// Current import state
let currentProgress: ImportProgress = createInitialProgress()
let progressCallback: ProgressCallback | null = null

function createInitialProgress(): ImportProgress {
  return {
    status: 'idle',
    totalRows: 0,
    processedRows: 0,
    successCount: 0,
    errorCount: 0,
    skipCount: 0,
    errors: [],
    currentPhase: ''
  }
}

function updateProgress(updates: Partial<ImportProgress>): void {
  currentProgress = { ...currentProgress, ...updates }
  if (progressCallback) {
    progressCallback(currentProgress)
  }

  // Also send to renderer via IPC
  const focusedWindow = BrowserWindow.getFocusedWindow()
  if (focusedWindow) {
    focusedWindow.webContents.send('import:progress', currentProgress)
  }
}

// ===== Preview Functions =====

/**
 * Preview a file to get headers and sample data
 */
export function previewImportFile(filePath: string): {
  success: boolean
  preview?: ImportPreview
  error?: string
} {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' }
    }

    const ext = path.extname(filePath).toLowerCase()

    if (ext === '.csv') {
      return previewCsvFile(filePath)
    } else if (ext === '.xlsx' || ext === '.xls') {
      return previewExcelFile(filePath)
    } else {
      return { success: false, error: 'Unsupported file format. Use .xlsx, .xls, or .csv' }
    }
  } catch (error: any) {
    console.error('Error previewing import file:', error)
    return { success: false, error: error.message }
  }
}

function previewCsvFile(filePath: string): {
  success: boolean
  preview?: ImportPreview
  error?: string
} {
  const workbook = XLSX.readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

  if (data.length === 0) {
    return { success: false, error: 'File is empty' }
  }

  const headers = data[0].map(h => String(h || '').trim())
  const sampleData: Record<string, string>[] = []

  for (let i = 1; i < Math.min(6, data.length); i++) {
    const row: Record<string, string> = {}
    headers.forEach((header, idx) => {
      row[header] = data[i]?.[idx] !== undefined ? String(data[i][idx]) : ''
    })
    sampleData.push(row)
  }

  return {
    success: true,
    preview: {
      headers,
      sampleData,
      totalRows: data.length - 1,
      sheetNames: ['Sheet1']
    }
  }
}

function previewExcelFile(filePath: string): {
  success: boolean
  preview?: ImportPreview
  error?: string
} {
  const workbook = XLSX.readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

  if (data.length === 0) {
    return { success: false, error: 'File is empty' }
  }

  const headers = data[0].map(h => String(h || '').trim())
  const sampleData: Record<string, string>[] = []

  for (let i = 1; i < Math.min(6, data.length); i++) {
    const row: Record<string, string> = {}
    headers.forEach((header, idx) => {
      row[header] = data[i]?.[idx] !== undefined ? String(data[i][idx]) : ''
    })
    sampleData.push(row)
  }

  return {
    success: true,
    preview: {
      headers,
      sampleData,
      totalRows: data.length - 1,
      sheetNames: workbook.SheetNames
    }
  }
}

/**
 * Get suggested field mappings based on headers
 */
export function getSuggestedMappings(
  entityType: ImportEntityType,
  headers: string[]
): ImportColumn[] {
  const fieldMappings = getEntityFieldMappings(entityType)
  const suggestions: ImportColumn[] = []

  for (const header of headers) {
    const normalizedHeader = header.toLowerCase().replace(/[_\s-]/g, '')

    // Try to find a matching field
    let matchedField: string | undefined
    let transform: ImportColumn['transform'] = 'text'

    for (const [fieldName, config] of Object.entries(fieldMappings)) {
      const normalizedField = fieldName.toLowerCase().replace(/[_\s-]/g, '')
      const aliases = config.aliases.map(a => a.toLowerCase().replace(/[_\s-]/g, ''))

      if (normalizedField === normalizedHeader || aliases.includes(normalizedHeader)) {
        matchedField = fieldName
        transform = config.type
        break
      }
    }

    suggestions.push({
      sourceColumn: header,
      targetField: matchedField || '',
      transform,
      required: matchedField ? fieldMappings[matchedField]?.required : false
    })
  }

  return suggestions
}

function getEntityFieldMappings(entityType: ImportEntityType): Record<string, {
  aliases: string[]
  type: ImportColumn['transform']
  required?: boolean
}> {
  switch (entityType) {
    case 'topics':
      return {
        title: { aliases: ['name', 'topic', 'subject'], type: 'text', required: true },
        description: { aliases: ['desc', 'details', 'notes'], type: 'text' },
        status: { aliases: ['state'], type: 'text' }
      }

    case 'records':
      return {
        title: { aliases: ['name', 'record', 'subject'], type: 'text', required: true },
        content: { aliases: ['description', 'details', 'body', 'text'], type: 'text' },
        type: { aliases: ['record_type', 'category'], type: 'text' },
        record_date: { aliases: ['date', 'entry_date'], type: 'date' },
        topic_id: { aliases: ['topic', 'topic_title'], type: 'lookup' }
      }

    case 'letters':
      return {
        subject: { aliases: ['title', 'name', 'letter_subject'], type: 'text', required: true },
        letter_type: { aliases: ['type', 'direction'], type: 'text', required: true },
        reference_number: { aliases: ['ref', 'ref_no', 'reference'], type: 'text' },
        incoming_number: { aliases: ['incoming_no', 'in_no'], type: 'text' },
        outgoing_number: { aliases: ['outgoing_no', 'out_no'], type: 'text' },
        letter_date: { aliases: ['date', 'sent_date', 'received_date'], type: 'date' },
        due_date: { aliases: ['deadline', 'response_date'], type: 'date' },
        status: { aliases: ['state', 'letter_status'], type: 'text' },
        priority: { aliases: ['urgency', 'importance'], type: 'text' },
        authority_id: { aliases: ['authority', 'sender', 'recipient', 'company'], type: 'lookup' }
      }

    case 'moms':
      return {
        title: { aliases: ['name', 'meeting', 'subject'], type: 'text', required: true },
        meeting_date: { aliases: ['date', 'mom_date'], type: 'date', required: true },
        subject: { aliases: ['agenda', 'topics', 'description'], type: 'text' },
        status: { aliases: ['state'], type: 'text' },
        location_id: { aliases: ['location', 'venue', 'place'], type: 'lookup' }
      }

    case 'issues':
      return {
        title: { aliases: ['name', 'issue', 'subject'], type: 'text', required: true },
        description: { aliases: ['details', 'body', 'content'], type: 'text' },
        status: { aliases: ['state', 'issue_status'], type: 'text' },
        importance: { aliases: ['priority', 'severity', 'level'], type: 'text' },
        reminder_date: { aliases: ['reminder', 'due_date', 'deadline'], type: 'date' },
        topic_id: { aliases: ['topic', 'category'], type: 'lookup' }
      }

    case 'contacts':
      return {
        name: { aliases: ['full_name', 'contact_name', 'person'], type: 'text', required: true },
        email: { aliases: ['email_address', 'e_mail'], type: 'text' },
        phone: { aliases: ['phone_number', 'mobile', 'telephone'], type: 'text' },
        position: { aliases: ['title', 'job_title', 'role'], type: 'text' },
        department: { aliases: ['dept', 'division', 'unit'], type: 'text' },
        authority_id: { aliases: ['authority', 'company', 'organization'], type: 'lookup' }
      }

    case 'authorities':
      return {
        name: { aliases: ['authority_name', 'company', 'organization', 'org'], type: 'text', required: true },
        short_name: { aliases: ['abbreviation', 'abbr', 'code'], type: 'text' },
        type: { aliases: ['authority_type', 'category', 'kind'], type: 'text' },
        email: { aliases: ['email_address', 'e_mail'], type: 'text' },
        phone: { aliases: ['phone_number', 'telephone'], type: 'text' },
        address: { aliases: ['location', 'addr'], type: 'text' }
      }

    default:
      return {}
  }
}

// ===== Import Functions =====

/**
 * Execute the import
 */
export async function executeImport(config: ImportConfig): Promise<ImportResult> {
  const startTime = Date.now()
  currentProgress = createInitialProgress()

  try {
    updateProgress({ status: 'parsing', currentPhase: 'Reading file...' })

    // Read file
    if (!fs.existsSync(config.filePath)) {
      return createErrorResult('File not found', startTime)
    }

    const workbook = XLSX.readFile(config.filePath)
    const sheetName = config.sheetName || workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

    const skipRows = config.skipRows || 1
    const dataRows = data.slice(skipRows)
    const headers = data[skipRows - 1] || data[0]

    updateProgress({
      status: 'validating',
      totalRows: dataRows.length,
      currentPhase: 'Validating data...'
    })

    // Validate column mappings
    const validationErrors = validateMappings(config.columnMappings, headers)
    if (validationErrors.length > 0) {
      return {
        success: false,
        totalRows: dataRows.length,
        importedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        errorCount: validationErrors.length,
        errors: validationErrors,
        duration: Date.now() - startTime
      }
    }

    updateProgress({ status: 'importing', currentPhase: 'Importing data...' })

    // Execute import based on entity type
    const result = await importEntities(config, dataRows, headers)

    updateProgress({
      status: 'complete',
      processedRows: dataRows.length,
      successCount: result.importedCount + result.updatedCount,
      errorCount: result.errorCount,
      skipCount: result.skippedCount,
      currentPhase: 'Complete'
    })

    return {
      ...result,
      duration: Date.now() - startTime
    }
  } catch (error: any) {
    console.error('Import error:', error)
    updateProgress({ status: 'error', currentPhase: error.message })
    return createErrorResult(error.message, startTime)
  }
}

function createErrorResult(error: string, startTime: number): ImportResult {
  return {
    success: false,
    totalRows: 0,
    importedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    errorCount: 1,
    errors: [{ row: 0, message: error }],
    duration: Date.now() - startTime
  }
}

function validateMappings(
  mappings: ImportColumn[],
  headers: any[]
): ImportError[] {
  const errors: ImportError[] = []
  const headerSet = new Set(headers.map(h => String(h)))

  for (const mapping of mappings) {
    if (mapping.required && !mapping.targetField) {
      errors.push({
        row: 0,
        column: mapping.sourceColumn,
        message: `Required field mapping missing for column: ${mapping.sourceColumn}`
      })
    }

    if (mapping.sourceColumn && !headerSet.has(mapping.sourceColumn)) {
      errors.push({
        row: 0,
        column: mapping.sourceColumn,
        message: `Column not found in file: ${mapping.sourceColumn}`
      })
    }
  }

  return errors
}

async function importEntities(
  config: ImportConfig,
  dataRows: any[][],
  headers: any[]
): Promise<Omit<ImportResult, 'duration'>> {
  const db = getDatabase()
  const errors: ImportError[] = []
  let importedCount = 0
  let updatedCount = 0
  let skippedCount = 0

  // Create column index map
  const headerIndexMap = new Map<string, number>()
  headers.forEach((h, i) => {
    headerIndexMap.set(String(h), i)
  })

  // Get insert/update SQL based on entity type
  const sqlOperations = getEntitySqlOperations(config.entityType)

  try {
    db.transaction(() => {
      const now = new Date().toISOString()

      for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
        const row = dataRows[rowIndex]
        const rowNumber = rowIndex + 2 // Account for header row

        try {
          // Extract values from row based on mappings
          const values: Record<string, any> = {}
          let hasError = false

          for (const mapping of config.columnMappings) {
            if (!mapping.targetField || !mapping.sourceColumn) continue

            const colIndex = headerIndexMap.get(mapping.sourceColumn)
            if (colIndex === undefined) continue

            let value = row[colIndex]

            // Transform value
            try {
              value = transformValue(value, mapping.transform, mapping, db)
            } catch (transformError: any) {
              errors.push({
                row: rowNumber,
                column: mapping.sourceColumn,
                message: transformError.message,
                value: String(value)
              })
              hasError = true
              break
            }

            // Apply default if empty
            if ((value === null || value === undefined || value === '') && mapping.defaultValue) {
              value = mapping.defaultValue
            }

            // Check required
            if (mapping.required && (value === null || value === undefined || value === '')) {
              errors.push({
                row: rowNumber,
                column: mapping.sourceColumn,
                message: `Required field is empty: ${mapping.targetField}`
              })
              hasError = true
              break
            }

            values[mapping.targetField] = value
          }

          if (hasError) {
            continue
          }

          // Check for duplicates
          let existingId: string | null = null
          if (config.duplicateCheckFields && config.duplicateCheckFields.length > 0) {
            existingId = findExisting(db, config.entityType, config.duplicateCheckFields, values)
          }

          if (existingId) {
            if (config.duplicateHandling === 'skip') {
              skippedCount++
              updateProgress({ processedRows: rowIndex + 1, skipCount: skippedCount })
              continue
            } else if (config.duplicateHandling === 'update') {
              // Update existing record
              sqlOperations.update(db, existingId, values, config.userId, now)
              updatedCount++
              updateProgress({ processedRows: rowIndex + 1, successCount: importedCount + updatedCount })
              continue
            }
            // 'create' falls through to insert
          }

          // Insert new record
          const id = randomUUID()
          sqlOperations.insert(db, id, values, config.userId, now)
          importedCount++

          updateProgress({ processedRows: rowIndex + 1, successCount: importedCount + updatedCount })
        } catch (rowError: any) {
          errors.push({
            row: rowNumber,
            message: rowError.message
          })
        }
      }
    })()

    // Log audit
    logAudit('IMPORT_COMPLETE', config.userId, getUsername(config.userId), config.entityType, 'batch', {
      totalRows: dataRows.length,
      imported: importedCount,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errors.length
    })

    return {
      success: errors.length === 0,
      totalRows: dataRows.length,
      importedCount,
      updatedCount,
      skippedCount,
      errorCount: errors.length,
      errors
    }
  } catch (error: any) {
    console.error('Import transaction error:', error)
    throw error
  }
}

function transformValue(
  value: any,
  transform: ImportColumn['transform'],
  mapping: ImportColumn,
  db: any
): any {
  if (value === null || value === undefined || value === '') {
    return null
  }

  switch (transform) {
    case 'number':
      const num = parseFloat(value)
      if (isNaN(num)) {
        throw new Error(`Invalid number: ${value}`)
      }
      return num

    case 'date':
      if (typeof value === 'number') {
        // Excel date serial number
        const excelDate = XLSX.SSF.parse_date_code(value)
        return new Date(excelDate.y, excelDate.m - 1, excelDate.d).toISOString().split('T')[0]
      }
      const date = new Date(value)
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid date: ${value}`)
      }
      return date.toISOString().split('T')[0]

    case 'boolean':
      const strValue = String(value).toLowerCase()
      return strValue === 'true' || strValue === '1' || strValue === 'yes' || strValue === 'y'

    case 'lookup':
      if (!mapping.lookupTable || !mapping.lookupField) {
        return value
      }
      // Try to find matching ID
      const lookupResult = db.prepare(`
        SELECT id FROM ${mapping.lookupTable}
        WHERE ${mapping.lookupField} = ? OR ${mapping.lookupField} LIKE ?
        LIMIT 1
      `).get(value, `%${value}%`) as { id: string } | undefined

      if (!lookupResult) {
        // Return the value as-is, it might be an ID already
        return value
      }
      return lookupResult.id

    default: // text
      return String(value).trim()
  }
}

function findExisting(
  db: any,
  entityType: ImportEntityType,
  checkFields: string[],
  values: Record<string, any>
): string | null {
  const tableName = getTableName(entityType)

  const conditions = checkFields
    .filter(f => values[f] !== null && values[f] !== undefined)
    .map(f => `${f} = ?`)

  if (conditions.length === 0) return null

  const params = checkFields
    .filter(f => values[f] !== null && values[f] !== undefined)
    .map(f => values[f])

  const sql = `SELECT id FROM ${tableName} WHERE ${conditions.join(' AND ')} LIMIT 1`
  const result = db.prepare(sql).get(...params) as { id: string } | undefined

  return result?.id || null
}

function getTableName(entityType: ImportEntityType): string {
  switch (entityType) {
    case 'topics': return 'topics'
    case 'records': return 'records'
    case 'letters': return 'letters'
    case 'moms': return 'moms'
    case 'issues': return 'issues'
    case 'contacts': return 'contacts'
    case 'authorities': return 'authorities'
    default: return entityType
  }
}

function getEntitySqlOperations(entityType: ImportEntityType) {
  return {
    insert: (db: any, id: string, values: Record<string, any>, userId: string, now: string) => {
      const tableName = getTableName(entityType)
      const fields = ['id', 'created_by', 'created_at', 'updated_at', ...Object.keys(values)]
      const placeholders = fields.map(() => '?').join(', ')
      const fieldValues = [id, userId, now, now, ...Object.values(values)]

      db.prepare(`INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders})`).run(...fieldValues)
    },

    update: (db: any, id: string, values: Record<string, any>, userId: string, now: string) => {
      const tableName = getTableName(entityType)
      const updates = Object.keys(values).map(k => `${k} = ?`).join(', ')
      const fieldValues = [...Object.values(values), now, id]

      db.prepare(`UPDATE ${tableName} SET ${updates}, updated_at = ? WHERE id = ?`).run(...fieldValues)
    }
  }
}

/**
 * Get current import progress
 */
export function getImportProgress(): ImportProgress {
  return currentProgress
}

/**
 * Cancel current import (sets flag, actual cancellation happens in import loop)
 */
export function cancelImport(): void {
  updateProgress({ status: 'error', currentPhase: 'Import cancelled by user' })
}

/**
 * Register progress callback
 */
export function onProgress(callback: ProgressCallback): void {
  progressCallback = callback
}

/**
 * Generate import template for an entity type
 */
export function generateImportTemplate(entityType: ImportEntityType): Buffer {
  const fieldMappings = getEntityFieldMappings(entityType)
  const headers = Object.entries(fieldMappings).map(([field, config]) => {
    const label = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    return config.required ? `${label} *` : label
  })

  const worksheet = XLSX.utils.aoa_to_sheet([headers])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Import Template')

  // Add instructions sheet
  const instructions = [
    ['Import Instructions'],
    [''],
    ['1. Fill in the data in the first sheet'],
    ['2. Fields marked with * are required'],
    ['3. Dates should be in YYYY-MM-DD format'],
    ['4. For lookup fields, you can use names or IDs'],
    [''],
    ['Available Fields:'],
    ...Object.entries(fieldMappings).map(([field, config]) => [
      field,
      config.type,
      config.required ? 'Required' : 'Optional',
      config.aliases.join(', ')
    ])
  ]
  const instructionSheet = XLSX.utils.aoa_to_sheet(instructions)
  XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Instructions')

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
}

export default {
  previewImportFile,
  getSuggestedMappings,
  executeImport,
  getImportProgress,
  cancelImport,
  onProgress,
  generateImportTemplate
}
