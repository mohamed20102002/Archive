import React, { useState } from 'react'
import { Modal } from '../common/Modal'
import { useAuth } from '../../context/AuthContext'
import type { Record, Subcategory } from '../../types'

interface RecordFormProps {
  record?: Record
  topicId?: string
  subcategories?: Subcategory[]
  defaultSubcategoryId?: string
  onSubmit: (data: { type: string; title: string; content?: string; subcategory_id?: string }) => Promise<{ recordId?: string }>
  onClose: () => void
}

const recordTypes = [
  { value: 'note', label: 'Note', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  { value: 'email', label: 'Email', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { value: 'document', label: 'Document', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { value: 'event', label: 'Event', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { value: 'decision', label: 'Decision', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' }
]

export function RecordForm({ record, topicId, subcategories = [], defaultSubcategoryId, onSubmit, onClose }: RecordFormProps) {
  const { user } = useAuth()
  const [type, setType] = useState(record?.type || 'note')
  const [title, setTitle] = useState(record?.title || '')
  const [content, setContent] = useState(record?.content || '')
  const [subcategoryId, setSubcategoryId] = useState<string>(
    record?.subcategory_id || defaultSubcategoryId || ''
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Reminder state
  const [setReminder, setSetReminder] = useState(false)
  const [reminderDueDate, setReminderDueDate] = useState('')
  const [reminderPriority, setReminderPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal')

  const isEditing = !!record

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
        type,
        title: title.trim(),
        content: content.trim() || undefined,
        subcategory_id: subcategoryId || undefined
      })

      // Create reminder if enabled
      if (setReminder && reminderDueDate && user) {
        const recordId = isEditing ? record?.id : result?.recordId
        const reminderData = {
          title: `Reminder: ${title.trim()}`,
          record_id: recordId,
          topic_id: topicId || record?.topic_id,
          due_date: new Date(reminderDueDate).toISOString(),
          priority: reminderPriority
        }

        await window.electronAPI.reminders.create(reminderData, user.id)
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

        {/* Type Selection */}
        <div>
          <label className="label">Record Type</label>
          <div className="grid grid-cols-5 gap-2">
            {recordTypes.map((rt) => (
              <button
                key={rt.value}
                type="button"
                onClick={() => setType(rt.value)}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                  type === rt.value
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
                disabled={isSubmitting}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={rt.icon} />
                </svg>
                <span className="text-xs font-medium">{rt.label}</span>
              </button>
            ))}
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
