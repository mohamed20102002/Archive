import React, { useState, useEffect } from 'react'
import { format, addDays, addHours, setHours, setMinutes } from 'date-fns'
import { Modal } from '../common/Modal'
import type { Topic, Reminder } from '../../types'

interface ReminderFormProps {
  reminder?: Reminder
  topicId?: string
  onSubmit: (data: {
    title: string
    description?: string
    due_date: string
    priority?: string
    topic_id?: string
  }) => Promise<void>
  onClose: () => void
}

const quickDateOptions = [
  { label: 'In 1 hour', getValue: () => addHours(new Date(), 1) },
  { label: 'Later today', getValue: () => setHours(setMinutes(new Date(), 0), 17) },
  { label: 'Tomorrow', getValue: () => setHours(setMinutes(addDays(new Date(), 1), 0), 9) },
  { label: 'Next week', getValue: () => setHours(setMinutes(addDays(new Date(), 7), 0), 9) }
]

export function ReminderForm({ reminder, topicId, onSubmit, onClose }: ReminderFormProps) {
  const [title, setTitle] = useState(reminder?.title || '')
  const [description, setDescription] = useState(reminder?.description || '')
  const [dueDate, setDueDate] = useState(
    reminder?.due_date
      ? format(new Date(reminder.due_date), "yyyy-MM-dd'T'HH:mm")
      : format(addHours(new Date(), 1), "yyyy-MM-dd'T'HH:mm")
  )
  const [priority, setPriority] = useState(reminder?.priority || 'normal')
  const [selectedTopicId, setSelectedTopicId] = useState(topicId || reminder?.topic_id || '')
  const [topics, setTopics] = useState<Topic[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isEditing = !!reminder

  useEffect(() => {
    loadTopics()
  }, [])

  const loadTopics = async () => {
    try {
      const data = await window.electronAPI.topics.getAll()
      setTopics(data as Topic[])
    } catch (err) {
      console.error('Error loading topics:', err)
    }
  }

  const handleQuickDate = (getValue: () => Date) => {
    setDueDate(format(getValue(), "yyyy-MM-dd'T'HH:mm"))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!title.trim()) {
      setError('Title is required')
      return
    }

    if (!dueDate) {
      setError('Due date is required')
      return
    }

    setIsSubmitting(true)

    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        due_date: new Date(dueDate).toISOString(),
        priority,
        topic_id: selectedTopicId || undefined
      })
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      title={isEditing ? 'Edit Reminder' : 'Create Reminder'}
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
            placeholder="What do you need to remember?"
            autoFocus
            disabled={isSubmitting}
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="label">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input min-h-[80px] resize-y"
            placeholder="Add more details (optional)"
            disabled={isSubmitting}
          />
        </div>

        {/* Due Date */}
        <div>
          <label htmlFor="dueDate" className="label">
            Due Date <span className="text-red-500">*</span>
          </label>

          {/* Quick Options */}
          <div className="flex flex-wrap gap-2 mb-3">
            {quickDateOptions.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => handleQuickDate(option.getValue)}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={isSubmitting}
              >
                {option.label}
              </button>
            ))}
          </div>

          <input
            id="dueDate"
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="input"
            disabled={isSubmitting}
          />
        </div>

        {/* Priority and Topic Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Priority */}
          <div>
            <label htmlFor="priority" className="label">
              Priority
            </label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="input"
              disabled={isSubmitting}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Topic */}
          <div>
            <label htmlFor="topic" className="label">
              Link to Topic
            </label>
            <select
              id="topic"
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="input"
              disabled={isSubmitting}
            >
              <option value="">No topic</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title}
                </option>
              ))}
            </select>
          </div>
        </div>

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
                <span>{isEditing ? 'Saving...' : 'Creating...'}</span>
              </>
            ) : (
              <span>{isEditing ? 'Save Changes' : 'Create Reminder'}</span>
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}
