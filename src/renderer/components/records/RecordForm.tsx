import React, { useState, useEffect } from 'react'
import { Modal } from '../common/Modal'
import { useAuth } from '../../context/AuthContext'
import { notifyReminderDataChanged } from '../reminders/ReminderBadge'
import type { Record, Subcategory, RecordAttachment } from '../../types'

interface RecordFormProps {
  record?: Record
  topicId?: string
  topicTitle?: string
  subcategories?: Subcategory[]
  defaultSubcategoryId?: string
  onSubmit: (data: { type: string; title: string; content?: string; subcategory_id?: string }) => Promise<{ recordId?: string }>
  onClose: () => void
}

interface PendingFile {
  filename: string
  buffer: string
  size: number
}

const allRecordTypes = [
  { value: 'email', label: 'Email', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { value: 'note', label: 'Note', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  { value: 'document', label: 'Document', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { value: 'event', label: 'Event', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { value: 'decision', label: 'Decision', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' }
]

// Helper to parse types (stored as comma-separated string)
const parseTypes = (typeStr: string): string[] => typeStr.split(',').filter(Boolean)
const joinTypes = (types: string[]): string => types.join(',')

export function RecordForm({ record, topicId, topicTitle, subcategories = [], defaultSubcategoryId, onSubmit, onClose }: RecordFormProps) {
  const { user } = useAuth()
  // Support multiple types (stored as comma-separated)
  const [selectedTypes, setSelectedTypes] = useState<string[]>(() => {
    if (record?.type) {
      return parseTypes(record.type)
    }
    return ['note'] // default for new records
  })
  const [title, setTitle] = useState(record?.title || '')
  const [content, setContent] = useState(record?.content || '')
  const [subcategoryId, setSubcategoryId] = useState<string>(
    record?.subcategory_id || defaultSubcategoryId || ''
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // File attachments state
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [existingAttachments, setExistingAttachments] = useState<RecordAttachment[]>([])
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null)

  // Load existing attachments when editing any record (use record.id as stable dependency)
  useEffect(() => {
    if (record?.id) {
      window.electronAPI.recordAttachments.getByRecord(record.id).then(atts => {
        setExistingAttachments(atts as RecordAttachment[])
      })
    }
  }, [record?.id])

  // Reminder state
  const [setReminder, setSetReminder] = useState(false)
  const [reminderDueDate, setReminderDueDate] = useState('')
  const [reminderPriority, setReminderPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal')

  const isEditing = !!record

  // Determine which types to show - email only when editing existing email record
  const hasEmail = record?.type?.includes('email')
  const recordTypes = hasEmail
    ? allRecordTypes
    : allRecordTypes.filter(rt => rt.value !== 'email')

  // Toggle type selection
  const toggleType = (typeValue: string) => {
    setSelectedTypes(prev => {
      if (prev.includes(typeValue)) {
        // Don't allow removing all types - must have at least one
        if (prev.length === 1) return prev
        return prev.filter(t => t !== typeValue)
      } else {
        return [...prev, typeValue]
      }
    })
  }

  // Quick date options
  const setQuickDate = (option: 'hour' | 'tomorrow' | 'week') => {
    const now = new Date()
    let dueDate: Date

    switch (option) {
      case 'hour':
        dueDate = new Date(now.getTime() + 60 * 60 * 1000)
        break
      case 'tomorrow':
        dueDate = new Date(now)
        dueDate.setDate(dueDate.getDate() + 1)
        dueDate.setHours(9, 0, 0, 0)
        break
      case 'week':
        dueDate = new Date(now)
        dueDate.setDate(dueDate.getDate() + 7)
        dueDate.setHours(9, 0, 0, 0)
        break
    }

    // Format for datetime-local input
    const formatted = dueDate.toISOString().slice(0, 16)
    setReminderDueDate(formatted)
  }

  // File selection handler for document type
  const handleSelectFiles = async () => {
    const result = await window.electronAPI.dialog.openFile({
      title: 'Select Files to Attach',
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'] },
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp'] }
      ],
      multiple: true
    })

    if (!result.canceled && result.files) {
      const newFiles: PendingFile[] = result.files.map(f => ({
        filename: f.filename,
        buffer: f.buffer,
        size: f.size
      }))
      setPendingFiles(prev => [...prev, ...newFiles])
    }
  }

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleDeleteExistingAttachment = async (attachmentId: string) => {
    if (!user) return
    setDeletingAttachmentId(attachmentId)
    try {
      const result = await window.electronAPI.recordAttachments.delete(attachmentId, user.id)
      if (result.success) {
        setExistingAttachments(prev => prev.filter(a => a.id !== attachmentId))
      } else {
        console.error('Failed to delete attachment:', result.error)
      }
    } catch (err) {
      console.error('Error deleting attachment:', err)
    } finally {
      setDeletingAttachmentId(null)
    }
  }

  const handleOpenExistingAttachment = async (attachmentId: string) => {
    const result = await window.electronAPI.recordAttachments.open(attachmentId)
    if (!result.success) {
      console.error('Failed to open attachment:', result.error)
    }
  }

  const formatFileSize = (bytes: number | null): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!title.trim()) {
      setError('Title is required')
      return
    }

    if (setReminder && !reminderDueDate) {
      setError('Please set a due date for the reminder')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await onSubmit({
        type: joinTypes(selectedTypes),
        title: title.trim(),
        content: content.trim() || undefined,
        subcategory_id: subcategoryId || undefined
      })

      const recordId = isEditing ? record?.id : result?.recordId

      // Upload file attachments
      if (pendingFiles.length > 0 && recordId && user) {
        for (const file of pendingFiles) {
          await window.electronAPI.recordAttachments.add({
            recordId,
            filename: file.filename,
            buffer: file.buffer,
            topicTitle: topicTitle || ''
          }, user.id)
        }
      }

      // Create reminder if enabled
      if (setReminder && reminderDueDate && user) {
        const reminderData = {
          title: `Reminder: ${title.trim()}`,
          record_id: recordId,
          topic_id: topicId || record?.topic_id,
          due_date: new Date(reminderDueDate).toISOString(),
          priority: reminderPriority
        }

        await window.electronAPI.reminders.create(reminderData, user.id)
        // Notify the reminder badge to refresh
        notifyReminderDataChanged()
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      title={isEditing ? 'Edit Record' : 'Add New Record'}
      onClose={onClose}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Type Selection - Multi-select */}
        <div>
          <label className="label">Record Type(s) <span className="text-xs text-gray-400 font-normal">(select one or more)</span></label>
          <div className={`grid gap-2 ${hasEmail ? 'grid-cols-5' : 'grid-cols-4'}`}>
            {recordTypes.map((rt) => {
              const isSelected = selectedTypes.includes(rt.value)
              return (
                <button
                  key={rt.value}
                  type="button"
                  onClick={() => toggleType(rt.value)}
                  className={`relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                    isSelected
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                  disabled={isSubmitting}
                >
                  {isSelected && (
                    <div className="absolute top-1 right-1">
                      <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={rt.icon} />
                  </svg>
                  <span className="text-xs font-medium">{rt.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Subcategory Selection */}
        {subcategories.length > 0 && (
          <div>
            <label htmlFor="subcategory" className="label">
              Subcategory
            </label>
            <select
              id="subcategory"
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              className="input"
              disabled={isSubmitting}
            >
              <option value="">General (No subcategory)</option>
              {subcategories.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.title}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Organize this record under a specific subcategory
            </p>
          </div>
        )}

        {/* Title */}
        <div>
          <label htmlFor="title" className="label">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            placeholder="Enter record title"
            autoFocus
            disabled={isSubmitting}
          />
        </div>

        {/* Content */}
        <div>
          <label htmlFor="content" className="label">
            Content
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="input min-h-[150px] resize-y"
            placeholder="Add details, notes, or description..."
            disabled={isSubmitting}
          />
        </div>

        {/* File Attachments - available for all record types */}
        {(
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                File Attachments
              </label>
              <button
                type="button"
                onClick={handleSelectFiles}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex items-center gap-2"
                disabled={isSubmitting}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Files
              </button>
            </div>

            {/* Existing attachments (when editing) */}
            {existingAttachments.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-medium">Current Attachments:</p>
                {existingAttachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-2 bg-purple-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <svg className="w-5 h-5 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm text-gray-700 truncate">{att.filename}</span>
                      <span className="text-xs text-gray-500 flex-shrink-0">({formatFileSize(att.file_size)})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenExistingAttachment(att.id)}
                        className="p-1 text-purple-500 hover:text-purple-700 transition-colors"
                        title="Open file"
                        disabled={isSubmitting}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteExistingAttachment(att.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete attachment"
                        disabled={isSubmitting || deletingAttachmentId === att.id}
                      >
                        {deletingAttachmentId === att.id ? (
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pending files (new attachments to be added) */}
            {pendingFiles.length > 0 && (
              <div className="space-y-2">
                {existingAttachments.length > 0 && (
                  <p className="text-xs text-gray-500 font-medium">New Attachments:</p>
                )}
                {pendingFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-green-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <span className="text-sm text-gray-700 truncate">{file.filename}</span>
                      <span className="text-xs text-gray-500 flex-shrink-0">({formatFileSize(file.size)})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePendingFile(index)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      disabled={isSubmitting}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {existingAttachments.length === 0 && pendingFiles.length === 0 && (
              <p className="text-sm text-gray-500">
                No files attached. Click "Add Files" to attach documents.
              </p>
            )}
          </div>
        )}

        {/* Reminder Option - available for both new and editing records */}
        {(
          <div className="border border-gray-200 rounded-lg p-4 space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={setReminder}
                onChange={(e) => setSetReminder(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                disabled={isSubmitting}
              />
              <span className="text-sm font-medium text-gray-700">
                Set a reminder for this record
              </span>
            </label>

            {setReminder && (
              <div className="space-y-4 pt-2">
                {/* Quick date options */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickDate('hour')}
                    className="px-3 py-1.5 text-xs font-medium rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                    disabled={isSubmitting}
                  >
                    In 1 hour
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDate('tomorrow')}
                    className="px-3 py-1.5 text-xs font-medium rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                    disabled={isSubmitting}
                  >
                    Tomorrow 9 AM
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDate('week')}
                    className="px-3 py-1.5 text-xs font-medium rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                    disabled={isSubmitting}
                  >
                    Next week
                  </button>
                </div>

                {/* Due date picker */}
                <div>
                  <label htmlFor="reminderDueDate" className="label">
                    Due Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reminderDueDate"
                    type="datetime-local"
                    value={reminderDueDate}
                    onChange={(e) => setReminderDueDate(e.target.value)}
                    className="input"
                    disabled={isSubmitting}
                  />
                </div>

                {/* Priority dropdown */}
                <div>
                  <label htmlFor="reminderPriority" className="label">
                    Priority
                  </label>
                  <select
                    id="reminderPriority"
                    value={reminderPriority}
                    onChange={(e) => setReminderPriority(e.target.value as 'low' | 'normal' | 'high' | 'urgent')}
                    className="input"
                    disabled={isSubmitting}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary flex items-center gap-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>{isEditing ? 'Saving...' : 'Adding...'}</span>
              </>
            ) : (
              <span>{isEditing ? 'Save Changes' : 'Add Record'}</span>
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}
