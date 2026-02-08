import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { Modal } from '../common/Modal'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import type { OutlookEmail, OutlookFolder, Topic, Subcategory } from '../../types'

interface EmailArchiveInfo {
  topicId: string
  topicTitle: string
  recordId: string
  recordTitle: string
  subcategoryId: string | null
  subcategoryTitle: string | null
  archivedAt: string
}

interface EmailPreviewProps {
  email: OutlookEmail | null
  selectedFolder: OutlookFolder | null
  isArchived?: boolean
  isLoadingDetails?: boolean
  onArchiveSuccess?: () => void
}

export function EmailPreview({ email, selectedFolder, isArchived, isLoadingDetails, onArchiveSuccess }: EmailPreviewProps) {
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [topics, setTopics] = useState<Topic[]>([])
  const [selectedTopic, setSelectedTopic] = useState<string>('')
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('')
  const [isArchiving, setIsArchiving] = useState(false)
  const [isLoadingTopics, setIsLoadingTopics] = useState(false)
  const [isLoadingSubcategories, setIsLoadingSubcategories] = useState(false)
  const [archiveInfo, setArchiveInfo] = useState<EmailArchiveInfo | null>(null)
  const [isLoadingArchiveInfo, setIsLoadingArchiveInfo] = useState(false)

  const { success, error } = useToast()
  const { user } = useAuth()
  const navigate = useNavigate()

  // Load archive info when email changes and is archived
  useEffect(() => {
    if (email?.entryId && isArchived) {
      setIsLoadingArchiveInfo(true)
      window.electronAPI.emails.getArchiveInfo(email.entryId)
        .then((info) => {
          setArchiveInfo(info as EmailArchiveInfo | null)
        })
        .catch((err) => {
          console.error('Error loading archive info:', err)
          setArchiveInfo(null)
        })
        .finally(() => {
          setIsLoadingArchiveInfo(false)
        })
    } else {
      setArchiveInfo(null)
    }
  }, [email?.entryId, isArchived])

  // Load subcategories when topic changes
  useEffect(() => {
    if (selectedTopic) {
      loadSubcategories(selectedTopic)
    } else {
      setSubcategories([])
      setSelectedSubcategory('')
    }
  }, [selectedTopic])

  const loadSubcategories = async (topicId: string) => {
    setIsLoadingSubcategories(true)
    try {
      const data = await window.electronAPI.subcategories.getByTopic(topicId)
      setSubcategories(data as Subcategory[])
    } catch (err) {
      console.error('Error loading subcategories:', err)
      setSubcategories([])
    } finally {
      setIsLoadingSubcategories(false)
    }
  }

  const handleOpenArchiveModal = async () => {
    setIsLoadingTopics(true)
    try {
      const data = await window.electronAPI.topics.getAll()
      setTopics(data as Topic[])
      setShowArchiveModal(true)
    } catch (err) {
      error('Failed to load topics')
    } finally {
      setIsLoadingTopics(false)
    }
  }

  const handleArchive = async () => {
    if (!email || !selectedTopic || !user) return

    setIsArchiving(true)
    try {
      const result = await window.electronAPI.emails.archive(
        {
          entryId: email.entryId,
          storeId: email.storeId,
          subject: email.subject,
          sender: email.sender,
          senderName: email.senderName,
          recipients: email.recipients,
          cc: email.cc,
          sentAt: email.sentAt,
          receivedAt: email.receivedAt,
          hasAttachments: email.hasAttachments,
          attachmentCount: email.attachmentCount,
          attachmentNames: email.attachmentNames,
          importance: email.importance,
          folderPath: email.folderPath,
          bodyPreview: email.bodyPreview
        },
        selectedTopic,
        user.id,
        selectedSubcategory || undefined
      )

      if (result.success) {
        const subcatName = subcategories.find(s => s.id === selectedSubcategory)?.title
        success(
          'Email archived',
          subcatName
            ? `The email has been saved to "${subcatName}"`
            : 'The email has been saved to the selected topic'
        )
        setShowArchiveModal(false)
        setSelectedTopic('')
        setSelectedSubcategory('')
        onArchiveSuccess?.()
      } else {
        error('Archive failed', result.error || 'Could not archive the email')
      }
    } catch (err: any) {
      error('Archive failed', err.message || 'Could not archive the email')
    } finally {
      setIsArchiving(false)
    }
  }

  if (!email) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 h-full flex items-center justify-center">
        <div className="text-center px-4">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No email selected</h3>
          <p className="text-gray-500">Select an email from the list to preview it</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 h-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{email.subject}</h2>
              {isArchived && (
                <span className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                  Archived
                </span>
              )}
            </div>
            {isArchived ? (
              <div className="flex items-center gap-2 flex-shrink-0">
                {isLoadingArchiveInfo ? (
                  <span className="text-sm text-gray-500">Loading...</span>
                ) : archiveInfo ? (
                  <button
                    onClick={() => navigate(`/topics/${archiveInfo.topicId}?recordId=${archiveInfo.recordId}`)}
                    className="btn-secondary text-sm flex items-center gap-2"
                    title={`View in ${archiveInfo.topicTitle}${archiveInfo.subcategoryTitle ? ` / ${archiveInfo.subcategoryTitle}` : ''}`}
                  >
                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                    <span className="text-gray-700">
                      {archiveInfo.topicTitle}
                      {archiveInfo.subcategoryTitle && <span className="text-gray-400"> / {archiveInfo.subcategoryTitle}</span>}
                    </span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                ) : (
                  <span className="text-sm text-green-600 font-medium flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                    Already Archived
                  </span>
                )}
              </div>
            ) : (
              <button
                onClick={handleOpenArchiveModal}
                disabled={isLoadingTopics}
                className="btn-primary text-sm flex items-center gap-2 flex-shrink-0"
              >
                {isLoadingTopics ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                )}
                <span>Archive to Topic</span>
              </button>
            )}
          </div>

          {/* Metadata */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-16">From:</span>
              <span className="text-gray-900">
                {email.senderName && <span className="font-medium">{email.senderName}</span>}
                {email.senderName && ' '}
                <span className="text-gray-500">&lt;{email.sender}&gt;</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-16">To:</span>
              <span className="text-gray-900">{email.recipients?.join(', ')}</span>
            </div>

            {email.cc && email.cc.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-16">CC:</span>
                <span className="text-gray-900">{email.cc.join(', ')}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-16">Date:</span>
              <span className="text-gray-900">
                {email.receivedAt
                  ? format(new Date(email.receivedAt), 'EEEE, MMMM d, yyyy h:mm a')
                  : email.sentAt
                    ? format(new Date(email.sentAt), 'EEEE, MMMM d, yyyy h:mm a')
                    : 'Unknown'
                }
              </span>
            </div>
          </div>

          {/* Attachments */}
          {email.hasAttachments && email.attachmentNames && email.attachmentNames.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span>{email.attachmentCount} attachment(s)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {email.attachmentNames.map((name, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded text-xs text-gray-700"
                  >
                    <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 relative">
          {isLoadingDetails && (
            <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-10">
              <div className="w-48 mb-3">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-600 rounded-full"
                    style={{
                      animation: 'emailLoadingBar 1.2s ease-in-out infinite'
                    }}
                  />
                </div>
              </div>
              <p className="text-sm text-gray-600 font-medium">Loading email content...</p>
              <style>{`
                @keyframes emailLoadingBar {
                  0% { width: 0%; margin-left: 0%; }
                  50% { width: 70%; margin-left: 15%; }
                  100% { width: 0%; margin-left: 100%; }
                }
              `}</style>
            </div>
          )}
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">
            {email.body || email.bodyPreview || '(No content)'}
          </div>
        </div>
      </div>

      {/* Archive Modal */}
      {showArchiveModal && (
        <Modal
          title="Archive Email to Topic"
          onClose={() => {
            setShowArchiveModal(false)
            setSelectedTopic('')
            setSelectedSubcategory('')
          }}
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Select a topic to archive this email to:
            </p>

            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
              {topics.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No topics available. Create a topic first.
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {topics.map((topic) => (
                    <label
                      key={topic.id}
                      className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                        selectedTopic === topic.id
                          ? 'bg-primary-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="topic"
                        value={topic.id}
                        checked={selectedTopic === topic.id}
                        onChange={(e) => {
                          setSelectedTopic(e.target.value)
                          setSelectedSubcategory('')
                        }}
                        className="text-primary-600 focus:ring-primary-500"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{topic.title}</p>
                        {topic.description && (
                          <p className="text-xs text-gray-500 truncate">{topic.description}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Subcategory Selection */}
            {selectedTopic && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subcategory (optional)
                </label>
                {isLoadingSubcategories ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Loading subcategories...
                  </div>
                ) : subcategories.length === 0 ? (
                  <p className="text-sm text-gray-500 py-2">
                    No subcategories in this topic.
                  </p>
                ) : (
                  <select
                    value={selectedSubcategory}
                    onChange={(e) => setSelectedSubcategory(e.target.value)}
                    className="input"
                  >
                    <option value="">General (No subcategory)</option>
                    {subcategories.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={() => {
                  setShowArchiveModal(false)
                  setSelectedTopic('')
                  setSelectedSubcategory('')
                }}
                className="btn-secondary"
                disabled={isArchiving}
              >
                Cancel
              </button>
              <button
                onClick={handleArchive}
                disabled={!selectedTopic || isArchiving}
                className="btn-primary flex items-center gap-2"
              >
                {isArchiving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Archiving...</span>
                  </>
                ) : (
                  <span>Archive Email</span>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
