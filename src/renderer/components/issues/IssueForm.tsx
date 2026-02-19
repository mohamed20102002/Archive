import React, { useState, useEffect } from 'react'
import type { Topic, Subcategory, IssueImportance, CreateIssueData, UpdateIssueData, Issue } from '../../types'

interface IssueFormProps {
  issue?: Issue | null
  onSubmit: (data: CreateIssueData | UpdateIssueData) => void
  onCancel: () => void
}

const importanceOptions: { value: IssueImportance; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-600 border-gray-300' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-700 border-red-300' }
]

export function IssueForm({ issue, onSubmit, onCancel }: IssueFormProps) {
  const [title, setTitle] = useState(issue?.title || '')
  const [description, setDescription] = useState(issue?.description || '')
  const [topicId, setTopicId] = useState(issue?.topic_id || '')
  const [subcategoryId, setSubcategoryId] = useState(issue?.subcategory_id || '')
  const [importance, setImportance] = useState<IssueImportance>(issue?.importance || 'medium')
  const [reminderDate, setReminderDate] = useState(issue?.reminder_date || '')

  const [topics, setTopics] = useState<Topic[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    loadTopics()
  }, [])

  useEffect(() => {
    if (topicId) {
      loadSubcategories(topicId)
    } else {
      setSubcategories([])
      setSubcategoryId('')
    }
  }, [topicId])

  const loadTopics = async () => {
    try {
      const result = await window.electronAPI.topics.getAll({}) as { data: Topic[] }
      setTopics((result.data || []).filter(t => !t.deleted_at))
    } catch (err) {
      console.error('Error loading topics:', err)
    }
  }

  const loadSubcategories = async (tid: string) => {
    try {
      const result = await window.electronAPI.subcategories.getByTopic(tid)
      setSubcategories((result as Subcategory[]).filter(s => !s.deleted_at))
    } catch (err) {
      console.error('Error loading subcategories:', err)
    }
  }

  const setQuickReminder = (type: 'hour' | 'tomorrow' | 'week') => {
    const now = new Date()
    switch (type) {
      case 'hour':
        now.setHours(now.getHours() + 1)
        break
      case 'tomorrow':
        now.setDate(now.getDate() + 1)
        now.setHours(9, 0, 0, 0)
        break
      case 'week':
        now.setDate(now.getDate() + 7)
        now.setHours(9, 0, 0, 0)
        break
    }
    // Format for datetime-local input: YYYY-MM-DDTHH:mm
    const pad = (n: number) => n.toString().padStart(2, '0')
    const formatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
    setReminderDate(formatted)
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!title.trim()) {
      errs.title = 'Title is required'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const data: CreateIssueData & UpdateIssueData = {
      title: title.trim(),
      description: description.trim() || undefined,
      topic_id: topicId || undefined,
      subcategory_id: subcategoryId || undefined,
      importance,
      reminder_date: reminderDate || undefined
    }

    // For update, if reminder was cleared, pass null
    if (issue && !reminderDate && issue.reminder_date) {
      (data as UpdateIssueData).reminder_date = null
    }

    onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Describe the issue..."
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
            errors.title ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-primary-500'
          }`}
          autoFocus
        />
        {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Additional details..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        />
      </div>

      {/* Importance */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Importance</label>
        <div className="flex gap-2">
          {importanceOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setImportance(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                importance === opt.value
                  ? `${opt.color} ring-2 ring-offset-1 ring-current`
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Topic & Subcategory */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
          <select
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">No topic</option>
            {topics.map(t => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
          <select
            value={subcategoryId}
            onChange={(e) => setSubcategoryId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            disabled={!topicId || subcategories.length === 0}
          >
            <option value="">None</option>
            {subcategories.map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Reminder */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Reminder</label>
        <div className="flex gap-2 mb-2">
          <button type="button" onClick={() => setQuickReminder('hour')} className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
            +1 Hour
          </button>
          <button type="button" onClick={() => setQuickReminder('tomorrow')} className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
            Tomorrow
          </button>
          <button type="button" onClick={() => setQuickReminder('week')} className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
            Next Week
          </button>
          {reminderDate && (
            <button type="button" onClick={() => setReminderDate('')} className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors">
              Clear
            </button>
          )}
        </div>
        <input
          type="datetime-local"
          value={reminderDate}
          onChange={(e) => setReminderDate(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
        >
          {issue ? 'Save Changes' : 'Create Issue'}
        </button>
      </div>
    </form>
  )
}
