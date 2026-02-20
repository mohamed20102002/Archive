/**
 * Import Wizard
 *
 * Multi-step wizard for importing data from Excel/CSV files.
 * Steps: File Selection -> Column Mapping -> Preview -> Import
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import {
  DocumentArrowUpIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  XMarkIcon,
  DocumentArrowDownIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

type ImportEntityType = 'topics' | 'records' | 'letters' | 'moms' | 'issues' | 'contacts' | 'authorities'

interface ImportColumn {
  sourceColumn: string
  targetField: string
  transform?: 'text' | 'number' | 'date' | 'boolean' | 'lookup'
  lookupTable?: string
  lookupField?: string
  required?: boolean
  defaultValue?: string
}

interface ImportPreview {
  headers: string[]
  sampleData: Record<string, string>[]
  totalRows: number
  sheetNames: string[]
}

interface ImportProgress {
  status: 'idle' | 'parsing' | 'validating' | 'importing' | 'complete' | 'error'
  totalRows: number
  processedRows: number
  successCount: number
  errorCount: number
  skipCount: number
  errors: ImportError[]
  currentPhase: string
}

interface ImportError {
  row: number
  column?: string
  message: string
  value?: string
}

interface ImportResult {
  success: boolean
  totalRows: number
  importedCount: number
  updatedCount: number
  skippedCount: number
  errorCount: number
  errors: ImportError[]
  duration: number
}

interface ImportWizardProps {
  entityType: ImportEntityType
  isOpen: boolean
  onClose: () => void
  onComplete?: () => void
}

const ENTITY_TYPE_LABELS: Record<ImportEntityType, string> = {
  topics: 'Topics',
  records: 'Records',
  letters: 'Letters',
  moms: 'MOMs',
  issues: 'Issues',
  contacts: 'Contacts',
  authorities: 'Authorities'
}

export function ImportWizard({ entityType, isOpen, onClose, onComplete }: ImportWizardProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()

  // Wizard state
  const [step, setStep] = useState(1)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [mappings, setMappings] = useState<ImportColumn[]>([])
  const [duplicateHandling, setDuplicateHandling] = useState<'skip' | 'update' | 'create'>('skip')
  const [duplicateCheckFields, setDuplicateCheckFields] = useState<string[]>([])
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setFilePath(null)
      setPreview(null)
      setMappings([])
      setProgress(null)
      setResult(null)
    }
  }, [isOpen])

  // Listen for import progress updates
  useEffect(() => {
    const unsubscribe = window.electronAPI.import.onProgress((progress) => {
      setProgress(progress)
    })
    return () => unsubscribe()
  }, [])

  async function handleSelectFile() {
    try {
      const result = await window.electronAPI.import.selectFile()
      if (result.success && result.filePath) {
        setFilePath(result.filePath)
        await loadPreview(result.filePath)
      }
    } catch (error) {
      console.error('Error selecting file:', error)
      showToast(t('import.selectError', 'Failed to select file'), 'error')
    }
  }

  async function loadPreview(path: string) {
    setLoading(true)
    try {
      const result = await window.electronAPI.import.preview(path)
      if (result.success && result.preview) {
        setPreview(result.preview)
        // Get suggested mappings
        const suggestions = await window.electronAPI.import.getSuggestedMappings(
          entityType,
          result.preview.headers
        )
        setMappings(suggestions)
      } else {
        showToast(result.error || t('import.previewError', 'Failed to preview file'), 'error')
      }
    } catch (error) {
      console.error('Error loading preview:', error)
      showToast(t('import.previewError', 'Failed to preview file'), 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleDownloadTemplate() {
    try {
      const result = await window.electronAPI.import.generateTemplate(entityType)
      if (result.success && result.data) {
        // Convert base64 to blob and download
        const byteCharacters = atob(result.data)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${entityType}_import_template.xlsx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        showToast(t('import.templateDownloaded', 'Template downloaded'), 'success')
      }
    } catch (error) {
      console.error('Error downloading template:', error)
      showToast(t('import.templateError', 'Failed to download template'), 'error')
    }
  }

  function updateMapping(index: number, updates: Partial<ImportColumn>) {
    setMappings(prev => prev.map((m, i) => i === index ? { ...m, ...updates } : m))
  }

  async function handleImport() {
    if (!filePath || !user) return

    setLoading(true)
    setProgress({
      status: 'parsing',
      totalRows: preview?.totalRows || 0,
      processedRows: 0,
      successCount: 0,
      errorCount: 0,
      skipCount: 0,
      errors: [],
      currentPhase: 'Starting...'
    })

    try {
      const importResult = await window.electronAPI.import.execute({
        entityType,
        filePath,
        columnMappings: mappings.filter(m => m.targetField),
        duplicateHandling,
        duplicateCheckFields: duplicateCheckFields.length > 0 ? duplicateCheckFields : undefined,
        userId: user.id
      })

      setResult(importResult)
      setStep(4)

      if (importResult.success && importResult.importedCount > 0) {
        showToast(
          t('import.success', 'Successfully imported {{count}} records', { count: importResult.importedCount }),
          'success'
        )
        onComplete?.()
      } else if (importResult.errorCount > 0) {
        showToast(
          t('import.partialSuccess', 'Import completed with {{count}} errors', { count: importResult.errorCount }),
          'warning'
        )
      }
    } catch (error: any) {
      console.error('Import error:', error)
      showToast(error.message || t('import.error', 'Import failed'), 'error')
    } finally {
      setLoading(false)
    }
  }

  function canProceed(): boolean {
    switch (step) {
      case 1:
        return !!preview
      case 2:
        return mappings.some(m => m.targetField)
      case 3:
        return true
      default:
        return false
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              {t('import.title', 'Import {{entity}}', { entity: ENTITY_TYPE_LABELS[entityType] })}
            </h2>
            <div className="flex items-center mt-2 space-x-4">
              {[1, 2, 3, 4].map(s => (
                <div key={s} className="flex items-center">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${s === step ? 'bg-primary-600 text-white' :
                      s < step ? 'bg-green-500 text-white' :
                      'bg-gray-200 dark:bg-gray-700 text-gray-500'}
                  `}>
                    {s < step ? <CheckIcon className="h-4 w-4" /> : s}
                  </div>
                  {s < 4 && (
                    <div className={`w-12 h-0.5 ${s < step ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Step 1: File Selection */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center py-8">
                <DocumentArrowUpIcon className="mx-auto h-16 w-16 text-gray-300" />
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                  {t('import.selectFile', 'Select a file to import')}
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {t('import.supportedFormats', 'Supported formats: Excel (.xlsx, .xls), CSV')}
                </p>
                <div className="mt-6 flex justify-center space-x-4">
                  <button
                    onClick={handleSelectFile}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                  >
                    <DocumentArrowUpIcon className="h-5 w-5 mr-2" />
                    {t('import.chooseFile', 'Choose File')}
                  </button>
                  <button
                    onClick={handleDownloadTemplate}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
                    {t('import.downloadTemplate', 'Download Template')}
                  </button>
                </div>
              </div>

              {filePath && preview && (
                <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center">
                    <CheckIcon className="h-5 w-5 text-green-500 mr-2" />
                    <span className="text-sm text-green-700 dark:text-green-300">
                      {t('import.fileLoaded', 'File loaded: {{count}} rows found', { count: preview.totalRows })}
                    </span>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1 truncate">
                    {filePath}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {step === 2 && preview && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {t('import.mapColumns', 'Map Columns')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('import.mapColumnsDescription', 'Match file columns to database fields')}
                </p>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('import.fileColumn', 'File Column')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('import.sampleData', 'Sample')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('import.targetField', 'Import As')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {mappings.map((mapping, index) => (
                      <tr key={mapping.sourceColumn}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {mapping.sourceColumn}
                          {mapping.required && <span className="text-red-500 ml-1">*</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                          {preview.sampleData[0]?.[mapping.sourceColumn] || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <select
                            value={mapping.targetField}
                            onChange={e => updateMapping(index, { targetField: e.target.value })}
                            className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white text-sm"
                          >
                            <option value="">{t('import.skipColumn', 'Skip this column')}</option>
                            <option value="title">{t('import.fields.title', 'Title')}</option>
                            <option value="name">{t('import.fields.name', 'Name')}</option>
                            <option value="description">{t('import.fields.description', 'Description')}</option>
                            <option value="content">{t('import.fields.content', 'Content')}</option>
                            <option value="subject">{t('import.fields.subject', 'Subject')}</option>
                            <option value="status">{t('import.fields.status', 'Status')}</option>
                            <option value="type">{t('import.fields.type', 'Type')}</option>
                            <option value="date">{t('import.fields.date', 'Date')}</option>
                            <option value="email">{t('import.fields.email', 'Email')}</option>
                            <option value="phone">{t('import.fields.phone', 'Phone')}</option>
                            <option value="reference_number">{t('import.fields.referenceNumber', 'Reference Number')}</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Duplicate Handling */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  {t('import.duplicateHandling', 'Duplicate Handling')}
                </h4>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="skip"
                      checked={duplicateHandling === 'skip'}
                      onChange={e => setDuplicateHandling(e.target.value as any)}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      {t('import.skipDuplicates', 'Skip duplicates')}
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="update"
                      checked={duplicateHandling === 'update'}
                      onChange={e => setDuplicateHandling(e.target.value as any)}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      {t('import.updateDuplicates', 'Update existing')}
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="create"
                      checked={duplicateHandling === 'create'}
                      onChange={e => setDuplicateHandling(e.target.value as any)}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      {t('import.createAll', 'Create all as new')}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Preview & Confirm */}
          {step === 3 && preview && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {t('import.reviewImport', 'Review Import')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('import.reviewDescription', 'Review your settings before importing')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    {t('import.summary', 'Summary')}
                  </h4>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">{t('import.totalRows', 'Total Rows')}:</dt>
                      <dd className="text-gray-900 dark:text-white font-medium">{preview.totalRows}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">{t('import.mappedColumns', 'Mapped Columns')}:</dt>
                      <dd className="text-gray-900 dark:text-white font-medium">
                        {mappings.filter(m => m.targetField).length}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">{t('import.duplicates', 'Duplicates')}:</dt>
                      <dd className="text-gray-900 dark:text-white font-medium capitalize">
                        {duplicateHandling}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    {t('import.fieldMappings', 'Field Mappings')}
                  </h4>
                  <ul className="space-y-1 text-sm">
                    {mappings.filter(m => m.targetField).map(m => (
                      <li key={m.sourceColumn} className="flex items-center text-gray-600 dark:text-gray-300">
                        <span>{m.sourceColumn}</span>
                        <ArrowRightIcon className="h-3 w-3 mx-2 text-gray-400" />
                        <span className="font-medium">{m.targetField}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Sample Preview */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  {t('import.dataPreview', 'Data Preview')}
                </h4>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        {mappings.filter(m => m.targetField).map(m => (
                          <th key={m.sourceColumn} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            {m.targetField}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                      {preview.sampleData.slice(0, 3).map((row, i) => (
                        <tr key={i}>
                          {mappings.filter(m => m.targetField).map(m => (
                            <td key={m.sourceColumn} className="px-3 py-2 text-gray-900 dark:text-white truncate max-w-xs">
                              {row[m.sourceColumn] || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Results */}
          {step === 4 && (
            <div className="space-y-6">
              {progress && progress.status !== 'complete' && !result ? (
                <div className="text-center py-8">
                  <ArrowPathIcon className="mx-auto h-12 w-12 text-primary-500 animate-spin" />
                  <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                    {progress.currentPhase}
                  </p>
                  <div className="mt-4 max-w-md mx-auto">
                    <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${progress.totalRows > 0
                            ? (progress.processedRows / progress.totalRows) * 100
                            : 0}%`
                        }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      {progress.processedRows} / {progress.totalRows} rows
                    </p>
                  </div>
                </div>
              ) : result ? (
                <div className="space-y-6">
                  <div className={`p-6 rounded-lg ${result.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                    <div className="flex items-center">
                      {result.success ? (
                        <CheckIcon className="h-8 w-8 text-green-500 mr-3" />
                      ) : (
                        <ExclamationTriangleIcon className="h-8 w-8 text-red-500 mr-3" />
                      )}
                      <div>
                        <h3 className={`text-lg font-medium ${result.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                          {result.success
                            ? t('import.importComplete', 'Import Complete')
                            : t('import.importFailed', 'Import Failed')}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {t('import.completedIn', 'Completed in {{duration}}ms', { duration: result.duration })}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{result.totalRows}</div>
                      <div className="text-xs text-gray-500">{t('import.totalRows', 'Total Rows')}</div>
                    </div>
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                      <div className="text-2xl font-bold text-green-600">{result.importedCount}</div>
                      <div className="text-xs text-gray-500">{t('import.imported', 'Imported')}</div>
                    </div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                      <div className="text-2xl font-bold text-blue-600">{result.updatedCount}</div>
                      <div className="text-xs text-gray-500">{t('import.updated', 'Updated')}</div>
                    </div>
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
                      <div className="text-2xl font-bold text-yellow-600">{result.skippedCount}</div>
                      <div className="text-xs text-gray-500">{t('import.skipped', 'Skipped')}</div>
                    </div>
                  </div>

                  {result.errors.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                        {t('import.errors', 'Errors')} ({result.errorCount})
                      </h4>
                      <div className="max-h-48 overflow-y-auto border border-red-200 dark:border-red-800 rounded-lg">
                        <table className="min-w-full divide-y divide-red-200 dark:divide-red-800 text-sm">
                          <thead className="bg-red-50 dark:bg-red-900/30">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-red-700">Row</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-red-700">Column</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-red-700">Error</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-red-100 dark:divide-red-900">
                            {result.errors.slice(0, 50).map((error, i) => (
                              <tr key={i}>
                                <td className="px-3 py-2 text-red-600">{error.row}</td>
                                <td className="px-3 py-2 text-red-600">{error.column || '-'}</td>
                                <td className="px-3 py-2 text-red-600">{error.message}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <div>
            {step > 1 && step < 4 && (
              <button
                onClick={() => setStep(step - 1)}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                {t('common.back', 'Back')}
              </button>
            )}
          </div>
          <div className="flex space-x-3">
            {step < 4 && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                {t('common.cancel', 'Cancel')}
              </button>
            )}
            {step < 3 && (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed() || loading}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.next', 'Next')}
                <ArrowRightIcon className="h-4 w-4 ml-2" />
              </button>
            )}
            {step === 3 && (
              <button
                onClick={handleImport}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                    {t('import.importing', 'Importing...')}
                  </>
                ) : (
                  <>
                    <DocumentArrowUpIcon className="h-4 w-4 mr-2" />
                    {t('import.startImport', 'Start Import')}
                  </>
                )}
              </button>
            )}
            {step === 4 && (
              <button
                onClick={onClose}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
              >
                {t('common.done', 'Done')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImportWizard
