import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

interface AttendanceEmailSettingsProps {
  isOpen: boolean
  onClose: () => void
}

// Placeholders that will be replaced with actual values
const PLACEHOLDERS = [
  { key: '{day_name}', description: 'Arabic day name (e.g., الخميس)' },
  { key: '{date}', description: 'Date in DD/MM/YYYY format' },
  { key: '{date_en}', description: 'Date in YYYY-MM-DD format' }
]

export function AttendanceEmailSettings({ isOpen, onClose }: AttendanceEmailSettingsProps) {
  const { user } = useAuth()
  const toast = useToast()

  const [toEmails, setToEmails] = useState('')
  const [ccEmails, setCcEmails] = useState('')
  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [activeTab, setActiveTab] = useState<'recipients' | 'template'>('recipients')

  const bodyEditorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      loadSettings()
    }
  }, [isOpen])

  // Update body editor when bodyHtml changes or when switching to template tab
  useEffect(() => {
    if (bodyEditorRef.current && bodyHtml !== undefined) {
      // Only update if the content is different to avoid cursor jumping
      if (bodyEditorRef.current.innerHTML !== bodyHtml) {
        bodyEditorRef.current.innerHTML = bodyHtml
      }
    }
  }, [bodyHtml, activeTab])

  const loadSettings = async () => {
    try {
      const [to, cc, subj, body] = await Promise.all([
        window.electronAPI.settings.get('attendance_report_email_to'),
        window.electronAPI.settings.get('attendance_report_email_cc'),
        window.electronAPI.settings.get('attendance_report_email_subject'),
        window.electronAPI.settings.get('attendance_report_email_body')
      ])
      setToEmails(to || '')
      setCcEmails(cc || '')
      setSubject(subj || 'الموقف اليومي لإدارة الأمان النووي عن يوم {day_name} الموافق {date}.')
      setBodyHtml(body || '')
      setHasChanges(false)
    } catch (err: any) {
      toast.error('Load Error', err.message)
    }
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      // Get HTML content from editor
      const htmlContent = bodyEditorRef.current?.innerHTML || ''

      await window.electronAPI.settings.updateAll({
        'attendance_report_email_to': toEmails,
        'attendance_report_email_cc': ccEmails,
        'attendance_report_email_subject': subject,
        'attendance_report_email_body': htmlContent
      }, user.id)

      setHasChanges(false)
      toast.success('Saved', 'Email settings saved successfully')
    } catch (err: any) {
      toast.error('Save Error', err.message)
    } finally {
      setSaving(false)
    }
  }

  const insertPlaceholder = (placeholder: string, target: 'subject' | 'body') => {
    if (target === 'subject') {
      setSubject(prev => prev + placeholder)
      setHasChanges(true)
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
        setHasChanges(true)
      }
    }
  }

  const handlePasteFormatted = async () => {
    try {
      // Read from clipboard with HTML format
      const clipboardItems = await navigator.clipboard.read()
      for (const item of clipboardItems) {
        if (item.types.includes('text/html')) {
          const blob = await item.getType('text/html')
          const html = await blob.text()
          if (bodyEditorRef.current) {
            bodyEditorRef.current.innerHTML = html
            setHasChanges(true)
            toast.success('Pasted', 'Formatted content pasted successfully')
          }
          return
        }
      }
      // Fallback to plain text
      const text = await navigator.clipboard.readText()
      if (bodyEditorRef.current) {
        bodyEditorRef.current.innerText = text
        setHasChanges(true)
      }
    } catch (err: any) {
      // Fallback for browsers that don't support clipboard API
      toast.info('Paste', 'Use Ctrl+V to paste in the editor below')
    }
  }

  const handleClearBody = () => {
    if (bodyEditorRef.current) {
      bodyEditorRef.current.innerHTML = ''
      setHasChanges(true)
    }
  }

  const previewText = (text: string) => {
    const today = new Date()
    const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    const dayName = arabicDays[today.getDay()]
    const dd = String(today.getDate()).padStart(2, '0')
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const yyyy = today.getFullYear()

    return text
      .replace(/{day_name}/g, dayName)
      .replace(/{date}/g, `${dd}/${mm}/${yyyy}`)
      .replace(/{date_en}/g, `${yyyy}-${mm}-${dd}`)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Email Settings</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Configure attendance report email template
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-4">
            <button
              onClick={() => setActiveTab('recipients')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'recipients'
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Recipients
            </button>
            <button
              onClick={() => setActiveTab('template')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'template'
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Email Template
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {activeTab === 'recipients' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  To (Recipients) <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={toEmails}
                  onChange={e => { setToEmails(e.target.value); setHasChanges(true) }}
                  placeholder="email1@example.com; email2@example.com"
                  className="w-full text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg resize-none"
                  rows={2}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Separate multiple addresses with semicolon (;)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  CC (Carbon Copy)
                </label>
                <textarea
                  value={ccEmails}
                  onChange={e => { setCcEmails(e.target.value); setHasChanges(true) }}
                  placeholder="cc1@example.com; cc2@example.com"
                  className="w-full text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg resize-none"
                  rows={2}
                />
              </div>
            </div>
          )}

          {activeTab === 'template' && (
            <div className="space-y-4">
              {/* Placeholders info */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Dynamic Placeholders</h4>
                <div className="flex flex-wrap gap-2">
                  {PLACEHOLDERS.map(p => (
                    <div key={p.key} className="text-xs">
                      <code className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded font-mono">
                        {p.key}
                      </code>
                      <span className="text-gray-600 dark:text-gray-400 ml-1">{p.description}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Subject
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={subject}
                    onChange={e => { setSubject(e.target.value); setHasChanges(true) }}
                    className="flex-1 text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-right"
                    dir="rtl"
                  />
                </div>
                <div className="flex gap-1 mt-2">
                  {PLACEHOLDERS.map(p => (
                    <button
                      key={p.key}
                      onClick={() => insertPlaceholder(p.key, 'subject')}
                      className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      + {p.key}
                    </button>
                  ))}
                </div>
                <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-sm text-gray-600 dark:text-gray-400 text-right" dir="rtl">
                  <span className="text-xs text-gray-400 dark:text-gray-500">Preview: </span>
                  {previewText(subject)}
                </div>
              </div>

              {/* Body */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email Body
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePasteFormatted}
                      className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-800/40 flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Paste Formatted
                    </button>
                    <button
                      onClick={handleClearBody}
                      className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="flex gap-1 mb-2">
                  {PLACEHOLDERS.map(p => (
                    <button
                      key={p.key}
                      onClick={() => insertPlaceholder(p.key, 'body')}
                      className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      + {p.key}
                    </button>
                  ))}
                </div>

                <div
                  ref={bodyEditorRef}
                  contentEditable
                  onInput={() => setHasChanges(true)}
                  className="w-full min-h-[200px] max-h-[300px] overflow-y-auto text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  dir="auto"
                  style={{ whiteSpace: 'pre-wrap' }}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  You can paste formatted text from Outlook or other email clients to preserve styling
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <div>
            {hasChanges && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                You have unsaved changes
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary text-sm">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
