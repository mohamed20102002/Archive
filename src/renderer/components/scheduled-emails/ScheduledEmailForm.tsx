import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import type { EmailSchedule, EmailScheduleFrequency, EmailScheduleLanguage } from '../../types'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface ScheduledEmailFormProps {
  schedule: EmailSchedule | null
  onClose: () => void
  onSave: () => void
}

const PLACEHOLDERS = [
  { placeholder: '{{date}}', description: 'Current date (per settings format)' },
  { placeholder: '{{date_arabic}}', description: 'Date with Arabic numerals' },
  { placeholder: '{{day_name}}', description: 'Day name (English)' },
  { placeholder: '{{day_name_arabic}}', description: 'Day name (Arabic)' },
  { placeholder: '{{week_number}}', description: 'Week number in year' },
  { placeholder: '{{week_number_arabic}}', description: 'Week number (Arabic numerals)' },
  { placeholder: '{{week_in_month}}', description: 'Week number in month (1-5)' },
  { placeholder: '{{week_in_month_arabic}}', description: 'Week in month (Arabic numerals)' },
  { placeholder: '{{week_in_month_ordinal}}', description: 'Week ordinal (1st, 2nd...)' },
  { placeholder: '{{week_in_month_ordinal_arabic}}', description: 'Week ordinal (Arabic)' },
  { placeholder: '{{month_name}}', description: 'Month name (English)' },
  { placeholder: '{{month_name_arabic}}', description: 'Month name (Arabic)' },
  { placeholder: '{{year}}', description: 'Current year' },
  { placeholder: '{{year_arabic}}', description: 'Year (Arabic numerals)' },
  { placeholder: '{{department_name}}', description: 'Department name' },
  { placeholder: '{{department_name_arabic}}', description: 'Department name (Arabic)' },
  { placeholder: '{{user_name}}', description: 'Logged-in user name' },
  { placeholder: '{{user_name_arabic}}', description: 'User name (Arabic)' }
]

export function ScheduledEmailForm({ schedule, onClose, onSave }: ScheduledEmailFormProps) {
  const { user } = useAuth()
  const toast = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewSubject, setPreviewSubject] = useState('')
  const [previewBody, setPreviewBody] = useState('')
  const bodyEditorRef = useRef<HTMLDivElement>(null)
  const subjectInputRef = useRef<HTMLInputElement>(null)
  const [focusedField, setFocusedField] = useState<'subject' | 'body'>('subject')

  const [formData, setFormData] = useState({
    name: schedule?.name || '',
    description: schedule?.description || '',
    to_emails: schedule?.to_emails || '',
    cc_emails: schedule?.cc_emails || '',
    subject_template: schedule?.subject_template || '',
    body_template: schedule?.body_template || '',
    frequency_type: (schedule?.frequency_type || 'weekly') as EmailScheduleFrequency,
    frequency_days: schedule?.frequency_days ? JSON.parse(schedule.frequency_days) : [0], // Default to Sunday
    send_time: schedule?.send_time || '09:00',
    language: (schedule?.language || 'en') as EmailScheduleLanguage
  })

  // Update body editor when body_template changes or on mount
  useEffect(() => {
    if (bodyEditorRef.current && formData.body_template !== undefined) {
      if (bodyEditorRef.current.innerHTML !== formData.body_template) {
        bodyEditorRef.current.innerHTML = formData.body_template
      }
    }
  }, [formData.body_template])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleDayToggle = (day: number) => {
    setFormData(prev => {
      const days = prev.frequency_days.includes(day)
        ? prev.frequency_days.filter((d: number) => d !== day)
        : [...prev.frequency_days, day].sort((a: number, b: number) => a - b)
      return { ...prev, frequency_days: days }
    })
  }

  const handleInsertPlaceholder = (placeholder: string) => {
    if (focusedField === 'subject') {
      const input = subjectInputRef.current
      if (input) {
        const start = input.selectionStart || 0
        const end = input.selectionEnd || 0
        const text = formData.subject_template
        const newText = text.substring(0, start) + placeholder + text.substring(end)
        handleInputChange('subject_template', newText)
        setTimeout(() => {
          input.selectionStart = input.selectionEnd = start + placeholder.length
          input.focus()
        }, 0)
      } else {
        handleInputChange('subject_template', formData.subject_template + placeholder)
      }
    } else {
      // Insert at cursor position in contentEditable
      const editor = bodyEditorRef.current
      if (editor) {
        editor.focus()
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          const textNode = document.createTextNode(placeholder)
          range.insertNode(textNode)
          range.setStartAfter(textNode)
          range.setEndAfter(textNode)
          selection.removeAllRanges()
          selection.addRange(range)
        } else {
          editor.innerHTML += placeholder
        }
      }
    }
  }

  const handlePasteFormatted = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read()
      for (const item of clipboardItems) {
        if (item.types.includes('text/html')) {
          const blob = await item.getType('text/html')
          const html = await blob.text()
          if (bodyEditorRef.current) {
            bodyEditorRef.current.innerHTML = html
            toast.success('Pasted', 'Formatted content pasted successfully')
          }
          return
        }
      }
      // Fallback to plain text
      const text = await navigator.clipboard.readText()
      if (bodyEditorRef.current) {
        bodyEditorRef.current.innerText = text
      }
    } catch (err: any) {
      toast.info('Paste', 'Use Ctrl+V to paste in the editor below')
    }
  }

  const handleClearBody = () => {
    if (bodyEditorRef.current) {
      bodyEditorRef.current.innerHTML = ''
    }
  }

  const handlePreview = async () => {
    if (!user) return

    try {
      const today = new Date().toISOString().split('T')[0]
      const [subject, body] = await Promise.all([
        window.electronAPI.scheduledEmails.previewPlaceholders(
          formData.subject_template,
          today,
          formData.language,
          user.id
        ),
        window.electronAPI.scheduledEmails.previewPlaceholders(
          formData.body_template,
          today,
          formData.language,
          user.id
        )
      ])
      setPreviewSubject(subject)
      setPreviewBody(body)
      setShowPreview(true)
    } catch (err) {
      console.error('Preview error:', err)
    }
  }

  const handleSubmit = async () => {
    if (!user) return
    setError(null)
    setIsSubmitting(true)

    try {
      // Get HTML content from editor
      const bodyHtml = bodyEditorRef.current?.innerHTML || ''

      // Validation
      if (!formData.name.trim()) {
        throw new Error('Name is required')
      }
      if (!formData.to_emails.trim()) {
        throw new Error('To emails is required')
      }
      if (!formData.subject_template.trim()) {
        throw new Error('Subject is required')
      }
      if (!bodyHtml.trim()) {
        throw new Error('Body is required')
      }
      if (formData.frequency_type === 'weekly' && formData.frequency_days.length === 0) {
        throw new Error('Please select at least one day')
      }

      const data = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        to_emails: formData.to_emails.trim(),
        cc_emails: formData.cc_emails.trim() || undefined,
        subject_template: formData.subject_template,
        body_template: bodyHtml,
        frequency_type: formData.frequency_type,
        frequency_days: formData.frequency_type === 'daily' ? undefined : formData.frequency_days,
        send_time: formData.send_time,
        language: formData.language
      }

      let result
      if (schedule) {
        result = await window.electronAPI.scheduledEmails.update(schedule.id, data, user.id)
      } else {
        result = await window.electronAPI.scheduledEmails.create(data, user.id)
      }

      if (result.success) {
        onSave()
      } else {
        throw new Error(result.error || 'Failed to save schedule')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {schedule ? 'Edit Schedule' : 'New Email Schedule'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="input"
                placeholder="Daily Report Email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Language</label>
              <select
                value={formData.language}
                onChange={(e) => handleInputChange('language', e.target.value)}
                className="input"
              >
                <option value="en">English</option>
                <option value="ar">Arabic</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="input"
              placeholder="Optional description..."
            />
          </div>

          {/* Schedule */}
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-4">
            <h3 className="font-medium text-gray-900 dark:text-gray-100">Schedule</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Frequency</label>
                <select
                  value={formData.frequency_type}
                  onChange={(e) => handleInputChange('frequency_type', e.target.value)}
                  className="input"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly (select days)</option>
                  <option value="monthly">Monthly (select days)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time</label>
                <input
                  type="time"
                  value={formData.send_time}
                  onChange={(e) => handleInputChange('send_time', e.target.value)}
                  className="input"
                />
              </div>
            </div>

            {/* Weekly Days */}
            {formData.frequency_type === 'weekly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Days of Week</label>
                <div className="flex gap-2 flex-wrap">
                  {DAY_NAMES.map((day, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleDayToggle(index)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        formData.frequency_days.includes(index)
                          ? 'bg-primary-600 text-white'
                          : 'bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-500'
                      }`}
                    >
                      {day.substring(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Monthly Days */}
            {formData.frequency_type === 'monthly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Days of Month</label>
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleDayToggle(day)}
                      className={`px-2 py-1 rounded text-sm font-medium transition-colors ${
                        formData.frequency_days.includes(day)
                          ? 'bg-primary-600 text-white'
                          : 'bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-500'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Recipients */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 dark:text-gray-100">Recipients</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To *</label>
              <input
                type="text"
                value={formData.to_emails}
                onChange={(e) => handleInputChange('to_emails', e.target.value)}
                className="input"
                placeholder="email@example.com; another@example.com"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Separate multiple emails with semicolon (;)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CC</label>
              <input
                type="text"
                value={formData.cc_emails}
                onChange={(e) => handleInputChange('cc_emails', e.target.value)}
                className="input"
                placeholder="cc@example.com"
              />
            </div>
          </div>

          {/* Email Content */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Email Content</h3>
              <button
                type="button"
                onClick={handlePreview}
                className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview
              </button>
            </div>

            {/* Shared Placeholders - inserts at focused field */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Placeholders</p>
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  Insert into: <span className="font-medium">{focusedField === 'subject' ? 'Subject' : 'Body'}</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PLACEHOLDERS.map((p) => (
                  <button
                    key={p.placeholder}
                    type="button"
                    onClick={() => handleInsertPlaceholder(p.placeholder)}
                    className="px-2 py-0.5 bg-white dark:bg-blue-800 border border-blue-200 dark:border-blue-700 rounded text-xs text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-700 transition-colors"
                    title={p.description}
                  >
                    {p.placeholder}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject *</label>
              <input
                ref={subjectInputRef}
                type="text"
                value={formData.subject_template}
                onChange={(e) => handleInputChange('subject_template', e.target.value)}
                onFocus={() => setFocusedField('subject')}
                className="input"
                placeholder={formData.language === 'ar' ? 'تقرير أسبوعي - {{date}}' : 'Weekly Report - {{date}}'}
                dir="auto"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Body *</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handlePasteFormatted}
                    className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/70 flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Paste Formatted
                  </button>
                  <button
                    type="button"
                    onClick={handleClearBody}
                    className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div
                ref={bodyEditorRef}
                contentEditable
                onFocus={() => setFocusedField('body')}
                className="w-full min-h-[200px] max-h-[300px] overflow-y-auto text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                dir="auto"
                style={{ whiteSpace: 'pre-wrap' }}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                You can paste formatted text from Outlook or other email clients to preserve styling.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                Saving...
              </>
            ) : (
              schedule ? 'Update Schedule' : 'Create Schedule'
            )}
          </button>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Preview</h3>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Subject</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100 font-medium" dir="auto">
                  {previewSubject}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Body</label>
                <div
                  className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-gray-100 text-sm max-h-60 overflow-y-auto"
                  dir="auto"
                  dangerouslySetInnerHTML={{ __html: previewBody }}
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button onClick={() => setShowPreview(false)} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
