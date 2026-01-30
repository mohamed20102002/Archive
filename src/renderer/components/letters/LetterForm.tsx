import React, { useState, useEffect } from 'react'
import { Letter, Topic, Authority, LetterType, ResponseType, LetterStatus, LetterPriority, Subcategory, ReferenceType, LetterReference } from '../../types'

interface PendingReference {
  targetLetter: Letter
  referenceType: ReferenceType
  notes: string
}

interface LetterFormProps {
  letter?: Letter
  topics: Topic[]
  authorities: Authority[]
  existingReferences?: LetterReference[]
  onSubmit: (data: any, references: PendingReference[]) => void
  onCancel: () => void
}

export function LetterForm({ letter, topics, authorities, existingReferences = [], onSubmit, onCancel }: LetterFormProps) {
  const [letterType, setLetterType] = useState<LetterType>(letter?.letter_type || 'incoming')
  const [responseType, setResponseType] = useState<ResponseType | ''>(letter?.response_type || '')
  const [status, setStatus] = useState<LetterStatus>(letter?.status || 'pending')
  const [priority, setPriority] = useState<LetterPriority>(letter?.priority || 'normal')
  const [subject, setSubject] = useState(letter?.subject || '')
  const [summary, setSummary] = useState(letter?.summary || '')
  const [incomingNumber, setIncomingNumber] = useState(letter?.incoming_number || '')

  // File attachments state (multiple files)
  const [selectedFiles, setSelectedFiles] = useState<{ filename: string; buffer: string; size: number }[]>([])
  const [existingAttachmentCount, setExistingAttachmentCount] = useState<number>(letter?.attachment_count || 0)
  const [outgoingNumber, setOutgoingNumber] = useState(letter?.outgoing_number || '')
  const [referenceNumber, setReferenceNumber] = useState(letter?.reference_number || '')
  const [authorityId, setAuthorityId] = useState(letter?.authority_id || '')
  const [topicId, setTopicId] = useState(letter?.topic_id || '')
  const [subcategoryId, setSubcategoryId] = useState(letter?.subcategory_id || '')
  const [letterDate, setLetterDate] = useState(letter?.letter_date?.split('T')[0] || '')
  const [receivedDate, setReceivedDate] = useState(letter?.received_date?.split('T')[0] || '')
  const [dueDate, setDueDate] = useState(letter?.due_date?.split('T')[0] || '')
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Reference management state
  const [pendingReferences, setPendingReferences] = useState<PendingReference[]>([])
  const [searchRefNumber, setSearchRefNumber] = useState('')
  const [searchRefType, setSearchRefType] = useState<ReferenceType>('reply_to')
  const [searchRefNotes, setSearchRefNotes] = useState('')
  const [searchResult, setSearchResult] = useState<Letter | null>(null)
  const [searchError, setSearchError] = useState('')
  const [searching, setSearching] = useState(false)

  // Load subcategories when topic changes
  useEffect(() => {
    async function loadSubcategories() {
      if (topicId) {
        try {
          const result = await window.electronAPI.subcategories.getByTopic(topicId)
          setSubcategories(result as Subcategory[])
        } catch (error) {
          console.error('Error loading subcategories:', error)
        }
      } else {
        setSubcategories([])
        setSubcategoryId('')
      }
    }
    loadSubcategories()
  }, [topicId])

  // Search for a letter by reference number
  const handleSearchLetter = async () => {
    if (!searchRefNumber.trim()) {
      setSearchError('Please enter a reference number')
      return
    }

    setSearching(true)
    setSearchError('')
    setSearchResult(null)

    try {
      const result = await window.electronAPI.letterReferences.findByRefNumber(searchRefNumber.trim())
      if (result) {
        const foundLetter = result as Letter
        // Check if it's the same letter being edited
        if (letter && foundLetter.id === letter.id) {
          setSearchError('Cannot reference the same letter')
        }
        // Check if already added
        else if (pendingReferences.some(ref => ref.targetLetter.id === foundLetter.id)) {
          setSearchError('This letter is already in your references')
        } else {
          setSearchResult(foundLetter)
        }
      } else {
        setSearchError('No letter found with this reference number')
      }
    } catch (error) {
      console.error('Error searching letter:', error)
      setSearchError('Error searching for letter')
    } finally {
      setSearching(false)
    }
  }

  // Add a reference to the pending list
  const handleAddReference = () => {
    if (!searchResult) return

    setPendingReferences([
      ...pendingReferences,
      {
        targetLetter: searchResult,
        referenceType: searchRefType,
        notes: searchRefNotes.trim()
      }
    ])

    // Reset search form
    setSearchRefNumber('')
    setSearchRefType('reply_to')
    setSearchRefNotes('')
    setSearchResult(null)
    setSearchError('')
  }

  // Remove a pending reference
  const handleRemoveReference = (index: number) => {
    setPendingReferences(pendingReferences.filter((_, i) => i !== index))
  }

  const getReferenceTypeLabel = (type: ReferenceType) => {
    switch (type) {
      case 'reply_to': return 'Reply To'
      case 'related': return 'Related'
      case 'supersedes': return 'Supersedes'
      case 'amends': return 'Amends'
      case 'attachment_to': return 'Attachment To'
      default: return type
    }
  }

  // Handle file selection (multiple files)
  const handleSelectFiles = async () => {
    try {
      const result = await window.electronAPI.dialog.openFile({
        title: 'Select Letter Documents',
        filters: [
          { name: 'Documents', extensions: ['pdf', 'doc', 'docx'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        multiple: true
      })

      if (!result.canceled && result.files && result.files.length > 0) {
        const newFiles = result.files.map(file => ({
          filename: file.filename,
          buffer: file.buffer,
          size: file.size
        }))
        setSelectedFiles([...selectedFiles, ...newFiles])
      }
    } catch (error) {
      console.error('Error selecting files:', error)
    }
  }

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index))
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!subject.trim()) {
      newErrors.subject = 'Subject is required'
    }
    if (!topicId) {
      newErrors.topicId = 'Topic is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    onSubmit({
      letter_type: letterType,
      response_type: responseType || undefined,
      status,
      priority,
      subject: subject.trim(),
      summary: summary.trim() || undefined,
      incoming_number: incomingNumber.trim() || undefined,
      outgoing_number: outgoingNumber.trim() || undefined,
      reference_number: referenceNumber.trim() || undefined,
      authority_id: authorityId || undefined,
      topic_id: topicId,
      subcategory_id: subcategoryId || undefined,
      letter_date: letterDate || undefined,
      received_date: receivedDate || undefined,
      due_date: dueDate || undefined,
      // File attachments data (multiple)
      files: selectedFiles.length > 0 ? selectedFiles : undefined
    }, pendingReferences)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Letter Type */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Letter Type <span className="text-red-500">*</span>
          </label>
          <select
            value={letterType}
            onChange={(e) => setLetterType(e.target.value as LetterType)}
            className="input w-full"
          >
            <option value="incoming">Incoming</option>
            <option value="outgoing">Outgoing</option>
            <option value="internal">Internal</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Response Type
          </label>
          <select
            value={responseType}
            onChange={(e) => setResponseType(e.target.value as ResponseType | '')}
            className="input w-full"
          >
            <option value="">Not specified</option>
            <option value="requires_reply">Requires Reply</option>
            <option value="informational">Informational</option>
            <option value="for_action">For Action</option>
            <option value="for_review">For Review</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Priority
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as LetterPriority)}
            className="input w-full"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      {/* Reference Numbers */}
      <div className="grid grid-cols-3 gap-4">
        {letterType === 'incoming' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Incoming Number
            </label>
            <input
              type="text"
              value={incomingNumber}
              onChange={(e) => setIncomingNumber(e.target.value)}
              className="input w-full"
              placeholder="e.g., IN-2025-001"
            />
          </div>
        )}
        {letterType === 'outgoing' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Outgoing Number
            </label>
            <input
              type="text"
              value={outgoingNumber}
              onChange={(e) => setOutgoingNumber(e.target.value)}
              className="input w-full"
              placeholder="e.g., OUT-2025-001"
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reference Number
          </label>
          <input
            type="text"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            className="input w-full"
            placeholder="External reference"
          />
        </div>
      </div>

      {/* Subject */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Subject <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={`input w-full ${errors.subject ? 'border-red-500' : ''}`}
          placeholder="Letter subject"
        />
        {errors.subject && <p className="text-red-500 text-sm mt-1">{errors.subject}</p>}
      </div>

      {/* Summary */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Summary
        </label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="input w-full"
          rows={3}
          placeholder="Brief summary of the letter content"
        />
      </div>

      {/* File Attachments (Multiple) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Attachments
          {existingAttachmentCount > 0 && (
            <span className="text-gray-500 font-normal ml-2">
              ({existingAttachmentCount} existing file{existingAttachmentCount > 1 ? 's' : ''})
            </span>
          )}
        </label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
          {/* Selected files list */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2 mb-4">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-blue-50 rounded-lg px-4 py-2">
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{file.filename}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(index)}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="Remove file"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add files button */}
          <div className="text-center">
            <svg className="w-10 h-10 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-gray-600 mb-2">
              {selectedFiles.length > 0 ? 'Add more files' : 'Attach documents (PDF, Word, etc.)'}
            </p>
            <button
              type="button"
              onClick={handleSelectFiles}
              className="btn-secondary text-sm"
            >
              {selectedFiles.length > 0 ? 'Add Files' : 'Select Files'}
            </button>
          </div>
        </div>
      </div>

      {/* Authority and Topic */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Authority / Organization
          </label>
          <select
            value={authorityId}
            onChange={(e) => setAuthorityId(e.target.value)}
            className="input w-full"
          >
            <option value="">Select authority...</option>
            {authorities.map((auth) => (
              <option key={auth.id} value={auth.id}>
                {auth.name} {auth.short_name ? `(${auth.short_name})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Topic <span className="text-red-500">*</span>
          </label>
          <select
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            className={`input w-full ${errors.topicId ? 'border-red-500' : ''}`}
          >
            <option value="">Select topic...</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>{topic.title}</option>
            ))}
          </select>
          {errors.topicId && <p className="text-red-500 text-sm mt-1">{errors.topicId}</p>}
        </div>
      </div>

      {/* Subcategory */}
      {subcategories.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subcategory
          </label>
          <select
            value={subcategoryId}
            onChange={(e) => setSubcategoryId(e.target.value)}
            className="input w-full"
          >
            <option value="">No subcategory</option>
            {subcategories.map((sub) => (
              <option key={sub.id} value={sub.id}>{sub.title}</option>
            ))}
          </select>
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Letter Date
          </label>
          <input
            type="date"
            value={letterDate}
            onChange={(e) => setLetterDate(e.target.value)}
            className="input w-full"
          />
        </div>

        {letterType === 'incoming' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Received Date
            </label>
            <input
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
              className="input w-full"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Due Date
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="input w-full"
          />
        </div>
      </div>

      {/* Status (only for edit) */}
      {letter && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as LetterStatus)}
            className="input w-full"
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="replied">Replied</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      )}

      {/* Related Letters / References */}
      <div className="border-t pt-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">
          Related Letters
          <span className="text-gray-500 font-normal ml-2">
            (Link this letter to other letters)
          </span>
        </h3>

        {/* Existing References (read-only display for edit mode) */}
        {existingReferences.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2">Existing references:</p>
            <div className="space-y-2">
              {existingReferences.map((ref) => (
                <div key={ref.id} className="bg-gray-100 rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
                  <span className="text-xs font-medium text-gray-500 uppercase px-2 py-0.5 bg-gray-200 rounded">
                    {getReferenceTypeLabel(ref.reference_type)}
                  </span>
                  <span className="text-gray-700">{ref.target_subject}</span>
                  {ref.target_reference_number && (
                    <span className="text-xs text-gray-500 font-mono">({ref.target_reference_number})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search and Add Reference */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter reference number to search..."
              value={searchRefNumber}
              onChange={(e) => {
                setSearchRefNumber(e.target.value)
                setSearchResult(null)
                setSearchError('')
              }}
              className="input flex-1"
            />
            <button
              type="button"
              onClick={handleSearchLetter}
              disabled={searching || !searchRefNumber.trim()}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>

          {searchError && (
            <p className="text-red-600 text-sm">{searchError}</p>
          )}

          {searchResult && (
            <div className="bg-white border border-green-200 rounded-lg p-3 space-y-3">
              <div>
                <p className="text-sm font-medium text-green-700">Letter found:</p>
                <p className="text-sm text-gray-900">{searchResult.subject}</p>
                <p className="text-xs text-gray-500">
                  <span className="font-mono">
                    {searchResult.reference_number || searchResult.incoming_number || searchResult.outgoing_number}
                  </span>
                  <span className="mx-2">|</span>
                  <span className="capitalize">{searchResult.letter_type}</span>
                  <span className="mx-2">|</span>
                  <span>{searchResult.authority_name || 'No authority'}</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Reference Type
                  </label>
                  <select
                    value={searchRefType}
                    onChange={(e) => setSearchRefType(e.target.value as ReferenceType)}
                    className="input w-full text-sm"
                  >
                    <option value="reply_to">Reply To (this is a reply to that letter)</option>
                    <option value="related">Related (general relationship)</option>
                    <option value="supersedes">Supersedes (this replaces that letter)</option>
                    <option value="amends">Amends (this modifies that letter)</option>
                    <option value="attachment_to">Attachment To</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Notes (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Add a note..."
                    value={searchRefNotes}
                    onChange={(e) => setSearchRefNotes(e.target.value)}
                    className="input w-full text-sm"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddReference}
                className="btn-primary text-sm"
              >
                Add Reference
              </button>
            </div>
          )}
        </div>

        {/* Pending References List */}
        {pendingReferences.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-2">
              References to add ({pendingReferences.length}):
            </p>
            <div className="space-y-2">
              {pendingReferences.map((ref, index) => (
                <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-xs font-medium text-blue-600 uppercase px-2 py-0.5 bg-blue-100 rounded">
                      {getReferenceTypeLabel(ref.referenceType)}
                    </span>
                    <span className="text-gray-700">{ref.targetLetter.subject}</span>
                    <span className="text-xs text-gray-500 font-mono">
                      ({ref.targetLetter.reference_number || ref.targetLetter.incoming_number || ref.targetLetter.outgoing_number})
                    </span>
                    {ref.notes && (
                      <span className="text-xs text-gray-400 italic">- {ref.notes}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveReference(index)}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="Remove reference"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          {letter ? 'Update Letter' : 'Create Letter'}
        </button>
      </div>
    </form>
  )
}
