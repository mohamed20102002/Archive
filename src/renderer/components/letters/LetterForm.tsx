import React, { useState, useEffect } from 'react'
import { Letter, Topic, Authority, Contact, LetterType, ResponseType, LetterStatus, LetterPriority, Subcategory, ReferenceType, LetterReference } from '../../types'

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
  // Authority selection first (determines internal/external)
  const [authorityId, setAuthorityId] = useState(letter?.authority_id || '')
  const [selectedAuthority, setSelectedAuthority] = useState<Authority | null>(null)

  // Letter type and notification
  const [letterType, setLetterType] = useState<LetterType>(letter?.letter_type || 'incoming')
  const [isNotification, setIsNotification] = useState(letter?.is_notification || false)

  // Importance status (renamed from priority)
  const [priority, setPriority] = useState<LetterPriority>(letter?.priority || 'normal')

  // Numbers - depends on internal/external
  const [incomingNumber, setIncomingNumber] = useState(letter?.incoming_number || '')
  const [outgoingNumber, setOutgoingNumber] = useState(letter?.outgoing_number || '')
  const [referenceNumber, setReferenceNumber] = useState(letter?.reference_number || '')

  // Other fields
  const [subject, setSubject] = useState(letter?.subject || '')
  const [summary, setSummary] = useState(letter?.summary || '')
  const [topicId, setTopicId] = useState(letter?.topic_id || '')
  const [subcategoryId, setSubcategoryId] = useState(letter?.subcategory_id || '')
  const [letterDate, setLetterDate] = useState(letter?.letter_date?.split('T')[0] || '')
  const [receivedDate, setReceivedDate] = useState(letter?.received_date?.split('T')[0] || '')
  const [status, setStatus] = useState<LetterStatus>(letter?.status || 'pending')

  // Contact (Att) for external
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactId, setContactId] = useState(letter?.contact_id || '')

  // Subcategories
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])

  // File attachments
  const [selectedFiles, setSelectedFiles] = useState<{ filename: string; buffer: string; size: number }[]>([])
  const [existingAttachmentCount] = useState<number>(letter?.attachment_count || 0)

  // References
  const [pendingReferences, setPendingReferences] = useState<PendingReference[]>([])
  const [searchRefNumber, setSearchRefNumber] = useState('')
  const [searchRefType, setSearchRefType] = useState<ReferenceType>('reply_to')
  const [searchRefNotes, setSearchRefNotes] = useState('')
  const [searchResult, setSearchResult] = useState<Letter | null>(null)
  const [searchError, setSearchError] = useState('')
  const [searching, setSearching] = useState(false)

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Computed: is the selected authority internal or external?
  const isInternal = selectedAuthority?.is_internal ?? true
  const isExternal = selectedAuthority ? !selectedAuthority.is_internal : false

  // Track selected authority
  useEffect(() => {
    if (authorityId) {
      const auth = authorities.find(a => a.id === authorityId)
      setSelectedAuthority(auth || null)
    } else {
      setSelectedAuthority(null)
      setContactId('')
      setContacts([])
    }
  }, [authorityId, authorities])

  // Load contacts when authority is external
  useEffect(() => {
    async function loadContacts() {
      if (selectedAuthority && !selectedAuthority.is_internal) {
        try {
          const result = await window.electronAPI.contacts.getByAuthority(selectedAuthority.id)
          if ((result as Contact[]).length > 0) {
            setContacts(result as Contact[])
          } else {
            const allContacts = await window.electronAPI.contacts.getAll()
            setContacts(allContacts as Contact[])
          }
        } catch (error) {
          console.error('Error loading contacts:', error)
        }
      } else {
        setContacts([])
        setContactId('')
      }
    }
    loadContacts()
  }, [selectedAuthority])

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
        if (letter && foundLetter.id === letter.id) {
          setSearchError('Cannot reference the same letter')
        } else if (pendingReferences.some(ref => ref.targetLetter.id === foundLetter.id)) {
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
    setSearchRefNumber('')
    setSearchRefType('reply_to')
    setSearchRefNotes('')
    setSearchResult(null)
    setSearchError('')
  }

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
    if (!authorityId) {
      newErrors.authorityId = 'Organization is required'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    onSubmit({
      letter_type: letterType,
      status,
      priority,
      subject: subject.trim(),
      summary: summary.trim() || undefined,
      // Internal: use incoming/outgoing numbers; External: use reference number
      incoming_number: isInternal && letterType === 'incoming' ? incomingNumber.trim() || undefined : undefined,
      outgoing_number: isInternal && letterType === 'outgoing' ? outgoingNumber.trim() || undefined : undefined,
      reference_number: isExternal ? referenceNumber.trim() || undefined : undefined,
      authority_id: authorityId || undefined,
      contact_id: isExternal ? contactId || undefined : undefined,
      topic_id: topicId,
      subcategory_id: subcategoryId || undefined,
      is_notification: letterType === 'internal' ? isNotification : false,
      letter_date: letterDate || undefined,
      received_date: letterType === 'incoming' ? receivedDate || undefined : undefined,
      files: selectedFiles.length > 0 ? selectedFiles : undefined
    }, pendingReferences)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Section 1: Organization Selection (determines internal/external) */}
      <div className="bg-gray-50 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Organization / Party <span className="text-red-500">*</span>
        </label>
        <select
          value={authorityId}
          onChange={(e) => setAuthorityId(e.target.value)}
          className={`input w-full ${errors.authorityId ? 'border-red-500' : ''}`}
        >
          <option value="">Select organization...</option>
          <optgroup label="Internal Parties">
            {authorities.filter(a => a.is_internal).map((auth) => (
              <option key={auth.id} value={auth.id}>
                {auth.name} {auth.short_name ? `(${auth.short_name})` : ''}
              </option>
            ))}
          </optgroup>
          <optgroup label="External Parties">
            {authorities.filter(a => !a.is_internal).map((auth) => (
              <option key={auth.id} value={auth.id}>
                {auth.name} {auth.short_name ? `(${auth.short_name})` : ''}
              </option>
            ))}
          </optgroup>
        </select>
        {errors.authorityId && <p className="text-red-500 text-sm mt-1">{errors.authorityId}</p>}
        {selectedAuthority && (
          <p className={`text-xs mt-2 font-medium ${isInternal ? 'text-blue-600' : 'text-amber-600'}`}>
            {isInternal ? 'Internal Party (Government / Department)' : 'External Party (Outside Organization)'}
          </p>
        )}
      </div>

      {/* Section 2: Letter Type & Importance */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Letter Type <span className="text-red-500">*</span>
          </label>
          <select
            value={letterType}
            onChange={(e) => {
              setLetterType(e.target.value as LetterType)
              if (e.target.value !== 'internal') {
                setIsNotification(false)
              }
            }}
            className="input w-full"
          >
            <option value="incoming">Incoming (Received by us)</option>
            <option value="outgoing">Outgoing (Sent by us)</option>
            <option value="internal">Internal Notification</option>
          </select>
          {letterType === 'internal' && (
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isNotification}
                onChange={(e) => setIsNotification(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">Mark as Internal Notification</span>
            </label>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Importance Status <span className="text-red-500">*</span>
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as LetterPriority)}
            className="input w-full"
          >
            <option value="low">Low</option>
            <option value="normal">Medium</option>
            <option value="high">Important</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      {/* Section 3: Number Fields - Based on Internal/External */}
      {selectedAuthority && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          {isInternal ? (
            // Internal: Show Incoming or Outgoing Number
            <div>
              <label className="block text-sm font-medium text-blue-800 mb-2">
                {letterType === 'incoming' ? 'Incoming Number' : letterType === 'outgoing' ? 'Outgoing Number' : 'Internal Number'}
              </label>
              {letterType === 'incoming' && (
                <input
                  type="text"
                  value={incomingNumber}
                  onChange={(e) => setIncomingNumber(e.target.value)}
                  className="input w-full"
                  placeholder="e.g., 122, 498, 146"
                />
              )}
              {letterType === 'outgoing' && (
                <input
                  type="text"
                  value={outgoingNumber}
                  onChange={(e) => setOutgoingNumber(e.target.value)}
                  className="input w-full"
                  placeholder="e.g., 188, 7346, 172"
                />
              )}
              {letterType === 'internal' && (
                <input
                  type="text"
                  value={incomingNumber}
                  onChange={(e) => setIncomingNumber(e.target.value)}
                  className="input w-full"
                  placeholder="Internal reference number"
                />
              )}
              <p className="text-xs text-blue-600 mt-1">
                Internal letters use numeric numbering system
              </p>
            </div>
          ) : (
            // External: Show Reference Code
            <div>
              <label className="block text-sm font-medium text-amber-800 mb-2">
                Reference Code
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="input w-full"
                placeholder="e.g., O/ASE/04012026/6339"
              />
              <p className="text-xs text-amber-600 mt-1">
                External letters use unique reference codes
              </p>
            </div>
          )}
        </div>
      )}

      {/* Section 4: Att (Contact Person) - Only for External */}
      {isExternal && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <label className="text-sm font-medium text-amber-800">
              Att (Attention - Contact Person)
            </label>
          </div>
          <select
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            className="input w-full"
          >
            <option value="">Select contact person...</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name} {contact.title ? `- ${contact.title}` : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-amber-600 mt-1">
            The person this letter is addressed to
          </p>
        </div>
      )}

      {/* Section 5: Subject */}
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

      {/* Section 5b: Dates */}
      <div className="grid grid-cols-2 gap-4">
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
      </div>

      {/* Section 6: Topic & Subcategory */}
      <div className="grid grid-cols-2 gap-4">
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
      </div>

      {/* Section 7: Summary */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Summary
        </label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="input w-full"
          rows={2}
          placeholder="Brief summary of the letter content"
        />
      </div>

      {/* Section 8: Attachments */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Attachments
          {existingAttachmentCount > 0 && (
            <span className="text-gray-500 font-normal ml-2">
              ({existingAttachmentCount} existing)
            </span>
          )}
        </label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-3">
          {selectedFiles.length > 0 && (
            <div className="space-y-2 mb-3">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-blue-50 rounded px-3 py-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm text-gray-900">{file.filename}</span>
                    <span className="text-xs text-gray-500">({formatFileSize(file.size)})</span>
                  </div>
                  <button type="button" onClick={() => handleRemoveFile(index)} className="text-red-500 hover:text-red-700">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="text-center">
            <button type="button" onClick={handleSelectFiles} className="btn-secondary text-sm">
              {selectedFiles.length > 0 ? 'Add More Files' : 'Select Files'}
            </button>
          </div>
        </div>
      </div>

      {/* Section 9: References */}
      <div className="border-t pt-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">
          References (Related Letters)
        </h3>

        {existingReferences.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-2">Existing references:</p>
            <div className="space-y-1">
              {existingReferences.map((ref) => (
                <div key={ref.id} className="bg-gray-100 rounded px-3 py-2 flex items-center gap-2 text-sm">
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

        <div className="bg-gray-50 rounded-lg p-3 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search by incoming/outgoing number or reference code..."
              value={searchRefNumber}
              onChange={(e) => {
                setSearchRefNumber(e.target.value)
                setSearchResult(null)
                setSearchError('')
              }}
              className="input flex-1 text-sm"
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

          {searchError && <p className="text-red-600 text-sm">{searchError}</p>}

          {searchResult && (
            <div className="bg-white border border-green-200 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-green-700">Letter found:</p>
              <p className="text-sm text-gray-900">{searchResult.subject}</p>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={searchRefType}
                  onChange={(e) => setSearchRefType(e.target.value as ReferenceType)}
                  className="input text-sm"
                >
                  <option value="related">Related Reference</option>
                  <option value="reply_to">Reply To</option>
                </select>
                <button type="button" onClick={handleAddReference} className="btn-primary text-sm">
                  Add Reference
                </button>
              </div>
            </div>
          )}
        </div>

        {pendingReferences.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-2">References to add:</p>
            <div className="space-y-1">
              {pendingReferences.map((ref, index) => (
                <div key={index} className="bg-blue-50 border border-blue-200 rounded px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-xs font-medium text-blue-600 uppercase px-2 py-0.5 bg-blue-100 rounded">
                      {getReferenceTypeLabel(ref.referenceType)}
                    </span>
                    <span className="text-gray-700">{ref.targetLetter.subject}</span>
                  </div>
                  <button type="button" onClick={() => handleRemoveReference(index)} className="text-red-500 hover:text-red-700">
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

      {/* Section 10: Status (edit only) */}
      {letter && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as LetterStatus)} className="input w-full">
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="replied">Replied</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary">{letter ? 'Update Letter' : 'Create Letter'}</button>
      </div>
    </form>
  )
}
