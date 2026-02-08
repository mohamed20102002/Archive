import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import type { Topic, MomLetterLink, Letter } from '../../types'

interface TopicLink {
  id: string
  topic_id: string
  topic_title: string
  created_at: string
}

interface RecordLink {
  id: string
  record_id: string
  record_title: string
  topic_title: string
  topic_id: string
  created_at: string
}

interface MOMTopicLinksProps {
  momInternalId: string
  onLinksChanged?: () => void
}

export function MOMTopicLinks({ momInternalId, onLinksChanged }: MOMTopicLinksProps) {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [linkedTopics, setLinkedTopics] = useState<TopicLink[]>([])
  const [linkedRecords, setLinkedRecords] = useState<RecordLink[]>([])
  const [allTopics, setAllTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)

  // Add topic state
  const [selectedTopicId, setSelectedTopicId] = useState('')

  // Record paste-by-ID state
  const [recordIdSearch, setRecordIdSearch] = useState('')
  const [foundRecord, setFoundRecord] = useState<{ id: string; title: string; topic_title: string; topic_id: string } | null>(null)
  const [recordSearchError, setRecordSearchError] = useState('')

  // Letter link state
  const [linkedLetters, setLinkedLetters] = useState<MomLetterLink[]>([])
  const [letterIdSearch, setLetterIdSearch] = useState('')
  const [foundLetter, setFoundLetter] = useState<Letter | null>(null)
  const [letterSearchError, setLetterSearchError] = useState('')

  const loadData = useCallback(async () => {
    try {
      const [topics, records, allT, letters] = await Promise.all([
        window.electronAPI.moms.getLinkedTopics(momInternalId),
        window.electronAPI.moms.getLinkedRecords(momInternalId),
        window.electronAPI.topics.getAll(),
        window.electronAPI.moms.getLinkedLetters(momInternalId)
      ])
      setLinkedTopics(topics as TopicLink[])
      setLinkedRecords(records as RecordLink[])
      setAllTopics((allT as Topic[]).filter(t => !t.deleted_at))
      setLinkedLetters(letters as MomLetterLink[])
    } catch (err) {
      console.error('Error loading links:', err)
    } finally {
      setLoading(false)
    }
  }, [momInternalId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Lookup record by pasted ID
  useEffect(() => {
    if (!recordIdSearch.trim()) {
      setFoundRecord(null)
      setRecordSearchError('')
      return
    }
    const timer = setTimeout(async () => {
      try {
        const record = await window.electronAPI.records.getById(recordIdSearch.trim())
        if (record) {
          const r = record as { id: string; title: string; topic_id: string }
          const topic = await window.electronAPI.topics.getById(r.topic_id)
          setFoundRecord({
            id: r.id,
            title: r.title,
            topic_title: (topic as any)?.title || 'Unknown topic',
            topic_id: r.topic_id
          })
          setRecordSearchError('')
        } else {
          setFoundRecord(null)
          setRecordSearchError('No record found with this ID')
        }
      } catch {
        setFoundRecord(null)
        setRecordSearchError('Error looking up record')
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [recordIdSearch])

  const handleLinkTopic = async () => {
    if (!user || !selectedTopicId) return
    try {
      const result = await window.electronAPI.moms.linkTopic(momInternalId, selectedTopicId, user.id)
      if (result.success) {
        setSelectedTopicId('')
        loadData()
        onLinksChanged?.()
      } else {
        alert(result.error || 'Failed to link topic')
      }
    } catch (err) {
      console.error('Error linking topic:', err)
    }
  }

  const handleUnlinkTopic = async (topicId: string) => {
    if (!user) return
    try {
      const result = await window.electronAPI.moms.unlinkTopic(momInternalId, topicId, user.id)
      if (result.success) {
        loadData()
        onLinksChanged?.()
      } else {
        alert(result.error || 'Failed to unlink topic')
      }
    } catch (err) {
      console.error('Error unlinking topic:', err)
    }
  }

  const handleLinkRecord = async (recordId: string) => {
    if (!user) return
    try {
      const result = await window.electronAPI.moms.linkRecord(momInternalId, recordId, user.id)
      if (result.success) {
        setRecordIdSearch('')
        setFoundRecord(null)
        setRecordSearchError('')
        loadData()
        onLinksChanged?.()
      } else {
        alert(result.error || 'Failed to link record')
      }
    } catch (err) {
      console.error('Error linking record:', err)
    }
  }

  const handleUnlinkRecord = async (recordId: string) => {
    if (!user) return
    try {
      const result = await window.electronAPI.moms.unlinkRecord(momInternalId, recordId, user.id)
      if (result.success) {
        loadData()
        onLinksChanged?.()
      } else {
        alert(result.error || 'Failed to unlink record')
      }
    } catch (err) {
      console.error('Error unlinking record:', err)
    }
  }

  // Letter search - search by both internal ID and display letter_id
  useEffect(() => {
    if (!letterIdSearch.trim()) {
      setFoundLetter(null)
      setLetterSearchError('')
      return
    }
    const timer = setTimeout(async () => {
      try {
        const searchTerm = letterIdSearch.trim()
        // Try by internal UUID first
        let result = await window.electronAPI.letters.getById(searchTerm)
        // If not found, try by display letter_id
        if (!result) {
          result = await window.electronAPI.letters.getByLetterId(searchTerm)
        }
        // If still not found, try by reference numbers
        if (!result) {
          result = await window.electronAPI.letterReferences.findByRefNumber(searchTerm)
        }
        if (result) {
          setFoundLetter(result as Letter)
          setLetterSearchError('')
        } else {
          setFoundLetter(null)
          setLetterSearchError('No letter found with this ID')
        }
      } catch {
        setFoundLetter(null)
        setLetterSearchError('Error searching')
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [letterIdSearch])

  const handleLinkLetter = async () => {
    if (!user || !foundLetter) return
    try {
      const result = await window.electronAPI.moms.linkLetter(momInternalId, foundLetter.id, user.id)
      if (result.success) {
        setLetterIdSearch('')
        setFoundLetter(null)
        setLetterSearchError('')
        loadData()
        onLinksChanged?.()
      } else {
        setLetterSearchError(result.error || 'Failed to link letter')
      }
    } catch (err) {
      console.error('Error linking letter:', err)
    }
  }

  const handleUnlinkLetter = async (letterInternalId: string) => {
    if (!user) return
    try {
      const result = await window.electronAPI.moms.unlinkLetter(momInternalId, letterInternalId, user.id)
      if (result.success) {
        loadData()
        onLinksChanged?.()
      } else {
        alert(result.error || 'Failed to unlink letter')
      }
    } catch (err) {
      console.error('Error unlinking letter:', err)
    }
  }

  const linkedTopicIds = new Set(linkedTopics.map(t => t.topic_id))
  const linkedRecordIds = new Set(linkedRecords.map(r => r.record_id))
  const linkedLetterIds = new Set(linkedLetters.map(l => l.letter_id))
  const availableTopics = allTopics.filter(t => !linkedTopicIds.has(t.id))

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Topics Section */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Linked Topics</h4>

        {/* Linked topic list */}
        <div className="space-y-1 mb-3">
          {linkedTopics.map((link) => (
            <div key={link.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 group">
              <span
                className="text-sm text-blue-600 hover:text-blue-700 cursor-pointer"
                onClick={() => navigate(`/topics/${link.topic_id}`)}
              >
                {link.topic_title}
              </span>
              {linkedTopics.length > 1 && (
                <button
                  onClick={() => handleUnlinkTopic(link.topic_id)}
                  className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                  title="Unlink topic"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add topic */}
        {availableTopics.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select topic to link...</option>
              {availableTopics.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
            <button
              onClick={handleLinkTopic}
              disabled={!selectedTopicId}
              className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              Link
            </button>
          </div>
        )}
      </div>

      {/* Records Section */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Linked Records</h4>

        {/* Linked records list */}
        {linkedRecords.length > 0 ? (
          <div className="space-y-1 mb-3">
            {linkedRecords.map((link) => (
              <div key={link.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 group">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-gray-400">{link.topic_title}</span>
                  <span className="text-gray-300">/</span>
                  <span
                    className="text-sm text-blue-600 hover:text-blue-700 cursor-pointer truncate"
                    onClick={() => navigate(`/topics/${link.topic_id}?recordId=${link.record_id}`)}
                  >
                    {link.record_title}
                  </span>
                </div>
                <button
                  onClick={() => handleUnlinkRecord(link.record_id)}
                  className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                  title="Unlink record"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500 mb-3">No records linked</p>
        )}

        {/* Paste record ID to link */}
        <div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={recordIdSearch}
              onChange={(e) => setRecordIdSearch(e.target.value)}
              placeholder="Paste Record ID to link..."
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {recordSearchError && (
            <p className="text-xs text-red-500 mt-1">{recordSearchError}</p>
          )}
          {foundRecord && !linkedRecordIds.has(foundRecord.id) && (
            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">{foundRecord.topic_title}</p>
                  <p className="text-sm font-medium text-gray-900 truncate">{foundRecord.title}</p>
                </div>
                <button
                  onClick={() => handleLinkRecord(foundRecord.id)}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors flex-shrink-0 ml-2"
                >
                  Link
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Letters Section */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Linked Letters</h4>

        {/* Linked letters list */}
        {linkedLetters.length > 0 ? (
          <div className="space-y-1 mb-3">
            {linkedLetters.map((link) => (
              <div key={link.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 group">
                <div className="flex items-center gap-2 min-w-0">
                  {link.letter_display_id && (
                    <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                      {link.letter_display_id}
                    </span>
                  )}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                    link.letter_type === 'incoming' ? 'bg-blue-100 text-blue-700' :
                    link.letter_type === 'outgoing' ? 'bg-green-100 text-green-700' :
                    'bg-purple-100 text-purple-700'
                  }`}>
                    {link.letter_type}
                  </span>
                  <span
                    className="text-sm text-blue-600 hover:text-blue-700 cursor-pointer truncate"
                    onClick={() => navigate(`/letters?letterId=${link.letter_id}`)}
                  >
                    {link.letter_subject}
                  </span>
                </div>
                <button
                  onClick={() => handleUnlinkLetter(link.letter_id)}
                  className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                  title="Unlink letter"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500 mb-3">No letters linked</p>
        )}

        {/* Search by letter_id to link */}
        <div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={letterIdSearch}
              onChange={(e) => setLetterIdSearch(e.target.value)}
              placeholder="Paste Letter ID to link..."
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {letterSearchError && (
            <p className="text-xs text-red-500 mt-1">{letterSearchError}</p>
          )}
          {foundLetter && !linkedLetterIds.has(foundLetter.id) && (
            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{foundLetter.subject}</p>
                  <p className="text-xs text-gray-500">
                    {foundLetter.letter_type} {foundLetter.reference_number ? `- ${foundLetter.reference_number}` : ''}
                  </p>
                </div>
                <button
                  onClick={handleLinkLetter}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors flex-shrink-0 ml-2"
                >
                  Link
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
