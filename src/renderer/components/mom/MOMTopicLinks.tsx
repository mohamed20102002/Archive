import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import type { Topic, MomLetterLink, Letter } from '../../types'

interface TopicLink {
  id: string
  topic_id: string
  topic_title: string | null
  created_at: string
  deleted_reason?: string | null
}

interface RecordLink {
  id: string
  record_id: string
  record_title: string | null
  topic_title: string | null
  topic_id: string | null
  created_at: string
  deleted_reason?: string | null
}

interface MOMTopicLinksProps {
  momInternalId: string
  onLinksChanged?: () => void
}

export function MOMTopicLinks({ momInternalId, onLinksChanged }: MOMTopicLinksProps) {
  const { user } = useAuth()
  const toast = useToast()
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
        window.electronAPI.topics.getAll({}),
        window.electronAPI.moms.getLinkedLetters(momInternalId)
      ])
      setLinkedTopics(topics as TopicLink[])
      setLinkedRecords(records as RecordLink[])
      const topicsData = (allT as { data: Topic[] }).data || allT
      setAllTopics((topicsData as Topic[]).filter(t => !t.deleted_at))
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

  const handleLinkTopic = async (topicId?: string) => {
    const idToLink = topicId || selectedTopicId
    if (!user || !idToLink) return
    try {
      const result = await window.electronAPI.moms.linkTopic(momInternalId, idToLink, user.id)
      if (result.success) {
        setSelectedTopicId('')
        loadData()
        onLinksChanged?.()
      } else {
        toast.error('Failed to link topic', result.error)
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
        toast.error('Failed to unlink topic', result.error)
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
        toast.error('Failed to link record', result.error)
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
        toast.error('Failed to unlink record', result.error)
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
        toast.error('Failed to unlink letter', result.error)
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
        <h4 className="text-sm font-semibold text-gray-900 mb-2">
          Topics <span className="font-normal text-gray-400">(optional)</span>
        </h4>

        {/* Topics as chips */}
        <div className="flex flex-wrap gap-2 p-3 border border-gray-200 rounded-lg bg-gray-50/50 min-h-[44px]">
          {/* Linked topics - with remove button */}
          {linkedTopics.map((link) => (
            link.deleted_reason ? (
              // Deleted/broken link
              <span
                key={link.id}
                className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 text-gray-400 rounded-full line-through"
                title="Topic was deleted"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                <span>{link.topic_title || 'Deleted topic'}</span>
                <span className="text-[10px] text-gray-400">(deleted)</span>
                <button
                  onClick={() => handleUnlinkTopic(link.topic_id)}
                  className="ml-0.5 p-0.5 rounded-full hover:bg-gray-200 transition-colors"
                  title="Remove broken link"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ) : (
              // Active link
              <span
                key={link.id}
                className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-primary-100 text-primary-700 rounded-full"
              >
                <span
                  className="cursor-pointer hover:underline"
                  onClick={() => navigate(`/topics/${link.topic_id}`)}
                >
                  {link.topic_title}
                </span>
                <button
                  onClick={() => handleUnlinkTopic(link.topic_id)}
                  className="ml-0.5 p-0.5 rounded-full hover:bg-primary-200 transition-colors"
                  title="Remove topic"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )
          ))}

          {/* Available topics - clickable to add */}
          {availableTopics.map((topic) => (
            <button
              key={topic.id}
              onClick={() => handleLinkTopic(topic.id)}
              className="px-3 py-1 text-sm text-gray-600 bg-white border border-gray-300 rounded-full hover:border-primary-400 hover:text-primary-600 transition-colors"
            >
              {topic.title}
            </button>
          ))}

          {linkedTopics.length === 0 && availableTopics.length === 0 && (
            <span className="text-sm text-gray-400">No topics available</span>
          )}
        </div>
      </div>

      {/* Records Section */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Linked Records</h4>

        {/* Linked records list */}
        {linkedRecords.length > 0 ? (
          <div className="space-y-1 mb-3">
            {linkedRecords.map((link) => (
              link.deleted_reason ? (
                // Deleted/broken link
                <div key={link.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 group">
                  <div className="flex items-center gap-2 min-w-0">
                    <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    <span className="text-xs text-gray-400">{link.topic_title || 'Deleted topic'}</span>
                    <span className="text-gray-300">/</span>
                    <span className="text-sm text-gray-400 line-through truncate">
                      {link.record_title || 'Deleted record'}
                    </span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">
                      ({link.deleted_reason === 'topic_deleted' ? 'topic deleted' : 'record deleted'})
                    </span>
                  </div>
                  <button
                    onClick={() => handleUnlinkRecord(link.record_id)}
                    className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                    title="Remove broken link"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                // Active link
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
              )
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
              link.deleted_reason ? (
                // Deleted/broken link
                <div key={link.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 group">
                  <div className="flex items-center gap-2 min-w-0">
                    <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    <span className="text-sm text-gray-400 line-through truncate">
                      {link.letter_subject || 'Deleted letter'}
                    </span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">(letter deleted)</span>
                  </div>
                  <button
                    onClick={() => handleUnlinkLetter(link.letter_id)}
                    className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                    title="Remove broken link"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                // Active link
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
              )
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
