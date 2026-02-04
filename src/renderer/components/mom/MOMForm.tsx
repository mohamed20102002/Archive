import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Modal } from '../common/Modal'
import { LocationManager } from './LocationManager'
import type { Mom, MomLocation, Topic, CreateMomData, UpdateMomData } from '../../types'

interface MOMFormProps {
  mom?: Mom | null
  onSubmit: (data: CreateMomData | UpdateMomData) => void
  onCancel: () => void
}

export function MOMForm({ mom, onSubmit, onCancel }: MOMFormProps) {
  const { user } = useAuth()
  const isEdit = !!mom

  const [momId, setMomId] = useState(mom?.mom_id || '')
  const [title, setTitle] = useState(mom?.title || '')
  const [subject, setSubject] = useState(mom?.subject || '')
  const [meetingDate, setMeetingDate] = useState(mom?.meeting_date || new Date().toISOString().split('T')[0])
  const [locationId, setLocationId] = useState(mom?.location_id || '')

  const [locations, setLocations] = useState<MomLocation[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([])
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([])

  // Record search
  const [recordSearch, setRecordSearch] = useState('')
  const [recordResults, setRecordResults] = useState<{ id: string; title: string; topic_title: string; topic_id: string }[]>([])

  const [showLocationManager, setShowLocationManager] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [momIdError, setMomIdError] = useState('')

  // Load locations and topics
  const loadData = useCallback(async () => {
    try {
      const [locs, allTopics] = await Promise.all([
        window.electronAPI.momLocations.getAll(),
        window.electronAPI.topics.getAll()
      ])
      setLocations(locs as MomLocation[])
      setTopics((allTopics as Topic[]).filter(t => !t.deleted_at))

      // For edit mode, load linked topics
      if (mom) {
        const linkedTopics = await window.electronAPI.moms.getLinkedTopics(mom.id)
        setSelectedTopicIds((linkedTopics as { topic_id: string }[]).map(t => t.topic_id))
      }
    } catch (err) {
      console.error('Error loading form data:', err)
    }
  }, [mom])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Validate mom_id uniqueness
  useEffect(() => {
    if (isEdit || !momId.trim()) {
      setMomIdError('')
      return
    }
    const timer = setTimeout(async () => {
      try {
        const existing = await window.electronAPI.moms.getByMomId(momId.trim())
        if (existing) {
          setMomIdError('This MOM ID already exists')
        } else {
          setMomIdError('')
        }
      } catch {
        setMomIdError('')
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [momId, isEdit])

  // Record search
  useEffect(() => {
    if (!recordSearch.trim()) {
      setRecordResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const results = await window.electronAPI.issues.searchRecordsForLinking(recordSearch.trim())
        setRecordResults(results as { id: string; title: string; topic_title: string; topic_id: string }[])
      } catch {
        setRecordResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [recordSearch])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!title.trim()) return
    if (momIdError) return

    setSubmitting(true)
    try {
      if (isEdit) {
        onSubmit({
          title: title.trim(),
          subject: subject.trim() || undefined,
          meeting_date: meetingDate || undefined,
          location_id: locationId || undefined
        } as UpdateMomData)
      } else {
        onSubmit({
          mom_id: momId.trim() || undefined,
          title: title.trim(),
          subject: subject.trim() || undefined,
          meeting_date: meetingDate || undefined,
          location_id: locationId || undefined,
          topic_ids: selectedTopicIds,
          record_ids: selectedRecordIds.length > 0 ? selectedRecordIds : undefined
        } as CreateMomData)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const toggleTopic = (topicId: string) => {
    setSelectedTopicIds(prev =>
      prev.includes(topicId) ? prev.filter(id => id !== topicId) : [...prev, topicId]
    )
  }

  const addRecord = (record: { id: string; title: string }) => {
    if (!selectedRecordIds.includes(record.id)) {
      setSelectedRecordIds(prev => [...prev, record.id])
    }
    setRecordSearch('')
    setRecordResults([])
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* MOM ID - only on create */}
        {!isEdit && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">MOM ID (Optional)</label>
            <input
              type="text"
              value={momId}
              onChange={(e) => setMomId(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                momIdError ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="e.g. MOM-2026-001"
            />
            {momIdError && (
              <p className="text-xs text-red-600 mt-1">{momIdError}</p>
            )}
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Meeting title"
            required
          />
        </div>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
          <textarea
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            placeholder="Meeting subject or agenda"
          />
        </div>

        {/* Meeting Date & Location */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Date</label>
            <input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <div className="flex gap-2">
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select location...</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowLocationManager(true)}
                className="px-2 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Manage locations"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Topics (create only) */}
        {!isEdit && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Topics <span className="text-xs text-gray-400">(optional)</span>
            </label>
            <div className="flex flex-wrap gap-2 p-3 border border-gray-300 rounded-lg min-h-[42px]">
              {topics.map(topic => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => toggleTopic(topic.id)}
                  className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                    selectedTopicIds.includes(topic.id)
                      ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {topic.title}
                  {selectedTopicIds.includes(topic.id) && (
                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Record links (create only) */}
        {!isEdit && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Link Records (optional)</label>
            {selectedRecordIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedRecordIds.map(id => (
                  <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                    {id.slice(0, 8)}...
                    <button type="button" onClick={() => setSelectedRecordIds(prev => prev.filter(r => r !== id))}>
                      <svg className="w-3 h-3 text-blue-400 hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <input
                type="text"
                value={recordSearch}
                onChange={(e) => setRecordSearch(e.target.value)}
                placeholder="Search records to link..."
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {recordResults.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-auto">
                  {recordResults
                    .filter(r => !selectedRecordIds.includes(r.id))
                    .map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => addRecord(r)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        <span className="text-gray-400">{r.topic_title} /</span>{' '}
                        <span className="font-medium text-gray-700">{r.title}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !!momIdError}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Saving...' : isEdit ? 'Update MOM' : 'Create MOM'}
          </button>
        </div>
      </form>

      {/* Location Manager Modal */}
      {showLocationManager && (
        <Modal
          title="Manage Locations"
          onClose={() => setShowLocationManager(false)}
          isOpen={showLocationManager}
          size="md"
        >
          <LocationManager
            onClose={() => setShowLocationManager(false)}
            onLocationCreated={(loc) => {
              setLocations(prev => [...prev, loc])
              setLocationId(loc.id)
            }}
          />
        </Modal>
      )}
    </>
  )
}
