import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../common/ConfirmDialog'
import { Letter, LetterDraft, LetterReference, LetterAttachment, LetterStatus, LetterPriority, DraftStatus, ReferenceType, LetterMomLink, Mom } from '../../types'
import { ProcessFlowGraph } from './ProcessFlowGraph'

interface LetterDetailProps {
  letter: Letter
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
  onRefresh: () => void
}

type TabMode = 'details' | 'drafts' | 'references' | 'moms' | 'flow'

export function LetterDetail({ letter, onEdit, onDelete, onClose, onRefresh }: LetterDetailProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [tabMode, setTabMode] = useState<TabMode>('details')
  const [drafts, setDrafts] = useState<LetterDraft[]>([])
  const [attachments, setAttachments] = useState<LetterAttachment[]>([])
  const [references, setReferences] = useState<{ from: LetterReference[], to: LetterReference[] }>({ from: [], to: [] })
  const [loading, setLoading] = useState(false)

  // Draft form state
  const [showDraftForm, setShowDraftForm] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftEdits, setDraftEdits] = useState('')
  const [draftFile, setDraftFile] = useState<{ filename: string; buffer: string; size: number } | null>(null)

  // Reference form state
  const [showRefForm, setShowRefForm] = useState(false)
  const [refNumber, setRefNumber] = useState('')
  const [refType, setRefType] = useState<ReferenceType>('related')
  const [refNotes, setRefNotes] = useState('')
  const [refError, setRefError] = useState('')
  const [refSearching, setRefSearching] = useState(false)
  const [foundLetter, setFoundLetter] = useState<Letter | null>(null)

  // Copyable ID state
  const [copied, setCopied] = useState(false)
  const [copiedRef, setCopiedRef] = useState(false)

  // MOM linking state
  const [linkedMoms, setLinkedMoms] = useState<LetterMomLink[]>([])
  const [momIdSearch, setMomIdSearch] = useState('')
  const [foundMom, setFoundMom] = useState<Mom | null>(null)
  const [momSearchError, setMomSearchError] = useState('')

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(letter.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }

  const handleCopyRef = async () => {
    const refValue = letter.reference_number || letter.incoming_number || letter.outgoing_number
    if (!refValue) return
    try {
      await navigator.clipboard.writeText(refValue)
      setCopiedRef(true)
      setTimeout(() => setCopiedRef(false), 1500)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadDraftsAndReferences()
  }, [letter.id])

  const loadDraftsAndReferences = async () => {
    setLoading(true)
    try {
      const [draftsResult, attachmentsResult, refsResult, momsResult] = await Promise.all([
        window.electronAPI.letterDrafts.getByLetter(letter.id),
        window.electronAPI.letterAttachments.getByLetter(letter.id),
        window.electronAPI.letterReferences.getAll(letter.id),
        window.electronAPI.letters.getLinkedMoms(letter.id)
      ])
      setDrafts(Array.isArray(draftsResult) ? draftsResult as LetterDraft[] : [])
      setAttachments(Array.isArray(attachmentsResult) ? attachmentsResult as LetterAttachment[] : [])
      const refs = refsResult as { from: LetterReference[], to: LetterReference[] }
      setReferences({
        from: Array.isArray(refs?.from) ? refs.from : [],
        to: Array.isArray(refs?.to) ? refs.to : []
      })
      setLinkedMoms(Array.isArray(momsResult) ? momsResult as LetterMomLink[] : [])
    } catch (error) {
      console.error('Error loading letter data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!user) return
    const confirmed = await confirm({
      title: 'Delete Attachment',
      message: 'Are you sure you want to delete this attachment?',
      confirmText: 'Delete',
      danger: true
    })
    if (!confirmed) return

    try {
      const result = await window.electronAPI.letterAttachments.delete(attachmentId, user.id)
      if (result.success) {
        loadDraftsAndReferences()
        onRefresh()
      } else {
        toast.error('Error', result.error || 'Failed to delete attachment')
      }
    } catch (error) {
      console.error('Error deleting attachment:', error)
    }
  }

  const getStatusColor = (status: LetterStatus | DraftStatus) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300'
      case 'in_progress': return 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300'
      case 'replied': return 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300'
      case 'closed': return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
      case 'archived': return 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300'
      case 'draft': return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
      case 'review': return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300'
      case 'approved': return 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300'
      case 'sent': return 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300'
      case 'superseded': return 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300'
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
    }
  }

  const getPriorityColor = (priority: LetterPriority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300'
      case 'high': return 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300'
      case 'normal': return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
      case 'low': return 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300'
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
    }
  }

  const handleCreateDraft = async () => {
    if (!user || !draftTitle.trim()) return

    try {
      const result = await window.electronAPI.letterDrafts.create({
        letter_id: letter.id,
        title: draftTitle.trim(),
        content: draftEdits.trim() || undefined
      }, user.id)

      if (result.success && result.draft) {
        // Upload file if attached (pass base64 string directly)
        if (draftFile) {
          await window.electronAPI.letterDrafts.saveFile(result.draft.id, draftFile.buffer, draftFile.filename, user.id)
        }

        setShowDraftForm(false)
        setDraftTitle('')
        setDraftEdits('')
        setDraftFile(null)
        loadDraftsAndReferences()
        onRefresh()
      } else {
        toast.error('Error', result.error || 'Failed to create draft')
      }
    } catch (error) {
      console.error('Error creating draft:', error)
    }
  }

  const handleSelectDraftFile = async () => {
    try {
      const result = await window.electronAPI.dialog.openFile({
        title: 'Select Draft Document',
        filters: [
          { name: 'Documents', extensions: ['pdf', 'doc', 'docx'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        multiple: false
      })

      if (!result.canceled && result.files && result.files.length > 0) {
        const file = result.files[0]
        setDraftFile({
          filename: file.filename,
          buffer: file.buffer,
          size: file.size
        })
      }
    } catch (error) {
      console.error('Error selecting file:', error)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleOpenFile = async (filePath: string) => {
    try {
      await window.electronAPI.file.openExternal(filePath)
    } catch (error) {
      console.error('Error opening file:', error)
    }
  }

  const handleDraftAction = async (draftId: string, action: 'approve' | 'send' | 'delete') => {
    if (!user) return

    try {
      let result
      switch (action) {
        case 'approve':
          result = await window.electronAPI.letterDrafts.approve(draftId, user.id)
          break
        case 'send':
          result = await window.electronAPI.letterDrafts.markAsSent(draftId, user.id)
          break
        case 'delete':
          const confirmed = await confirm({
            title: 'Delete Draft',
            message: 'Are you sure you want to delete this draft?',
            confirmText: 'Delete',
            danger: true
          })
          if (!confirmed) return
          result = await window.electronAPI.letterDrafts.delete(draftId, user.id)
          break
      }

      if (result?.success) {
        loadDraftsAndReferences()
        onRefresh()
      } else {
        toast.error('Error', result?.error || `Failed to ${action} draft`)
      }
    } catch (error) {
      console.error(`Error ${action} draft:`, error)
    }
  }

  // Search for letter by reference number
  const handleSearchReference = async () => {
    if (!refNumber.trim()) {
      setRefError('Please enter a reference number')
      return
    }

    setRefSearching(true)
    setRefError('')
    setFoundLetter(null)

    try {
      const result = await window.electronAPI.letterReferences.findByRefNumber(refNumber.trim())
      if (result) {
        if ((result as Letter).id === letter.id) {
          setRefError('Cannot reference the same letter')
        } else {
          setFoundLetter(result as Letter)
        }
      } else {
        setRefError('No letter found with this reference number')
      }
    } catch (error) {
      console.error('Error searching reference:', error)
      setRefError('Error searching for letter')
    } finally {
      setRefSearching(false)
    }
  }

  // Create reference by reference number
  const handleCreateReference = async () => {
    if (!user || !foundLetter) return

    try {
      const result = await window.electronAPI.letterReferences.createByRefNumber(
        letter.id,
        refNumber.trim(),
        refType,
        refNotes.trim() || null,
        user.id
      )

      if (result.success) {
        setShowRefForm(false)
        setRefNumber('')
        setRefType('related')
        setRefNotes('')
        setFoundLetter(null)
        setRefError('')
        loadDraftsAndReferences()
        onRefresh()
      } else {
        setRefError(result.error || 'Failed to create reference')
      }
    } catch (error) {
      console.error('Error creating reference:', error)
      setRefError('Error creating reference')
    }
  }

  // Delete reference
  const handleDeleteReference = async (refId: string) => {
    if (!user) return
    const confirmed = await confirm({
      title: 'Remove Reference',
      message: 'Are you sure you want to remove this reference?',
      confirmText: 'Remove',
      danger: true
    })
    if (!confirmed) return

    try {
      const result = await window.electronAPI.letterReferences.delete(refId, user.id)
      if (result.success) {
        loadDraftsAndReferences()
        onRefresh()
      } else {
        toast.error('Error', result.error || 'Failed to delete reference')
      }
    } catch (error) {
      console.error('Error deleting reference:', error)
    }
  }

  // MOM search
  useEffect(() => {
    if (!momIdSearch.trim()) {
      setFoundMom(null)
      setMomSearchError('')
      return
    }
    const timer = setTimeout(async () => {
      try {
        const result = await window.electronAPI.moms.getById(momIdSearch.trim())
        if (result) {
          setFoundMom(result as Mom)
          setMomSearchError('')
        } else {
          setFoundMom(null)
          setMomSearchError('No MOM found with this ID')
        }
      } catch {
        setFoundMom(null)
        setMomSearchError('Error searching')
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [momIdSearch])

  const handleLinkMom = async () => {
    if (!user || !foundMom) return
    try {
      const result = await window.electronAPI.moms.linkLetter(foundMom.id, letter.id, user.id)
      if (result.success) {
        setMomIdSearch('')
        setFoundMom(null)
        setMomSearchError('')
        loadDraftsAndReferences()
      } else {
        setMomSearchError(result.error || 'Failed to link MOM')
      }
    } catch (err) {
      console.error('Error linking MOM:', err)
    }
  }

  const handleUnlinkMom = async (momInternalId: string) => {
    if (!user) return
    try {
      const result = await window.electronAPI.moms.unlinkLetter(momInternalId, letter.id, user.id)
      if (result.success) {
        loadDraftsAndReferences()
      } else {
        toast.error('Error', result.error || 'Failed to unlink MOM')
      }
    } catch (err) {
      console.error('Error unlinking MOM:', err)
    }
  }

  const linkedMomIds = new Set(linkedMoms.map(m => m.mom_internal_id))

  const isOverdue = letter.due_date && new Date(letter.due_date) < new Date() && letter.status !== 'replied' && letter.status !== 'closed'

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      {/* Header */}
      <div className="flex items-start justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full capitalize ${
              letter.letter_type === 'incoming' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300' :
              letter.letter_type === 'outgoing' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' :
              'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300'
            }`}>
              {letter.letter_type}
            </span>
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(letter.status)}`}>
              {letter.status.replace('_', ' ')}
            </span>
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(letter.priority)}`}>
              {letter.priority}
            </span>
            {isOverdue && (
              <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300">
                OVERDUE
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{letter.subject}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="inline-flex items-center gap-1 text-sm font-mono font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/50 px-2 py-0.5 rounded">
              {letter.id.slice(0, 8)}
              <button
                onClick={handleCopyId}
                className="p-0.5 rounded hover:bg-primary-100 dark:hover:bg-primary-800 transition-colors"
                title="Copy letter ID"
              >
                {copied ? (
                  <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </span>
            {(letter.reference_number || letter.incoming_number || letter.outgoing_number) && (
              <span className="inline-flex items-center gap-1 text-sm font-mono text-gray-500 dark:text-gray-400">
                Ref: {letter.reference_number || letter.incoming_number || letter.outgoing_number}
                <button
                  onClick={handleCopyRef}
                  className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  title="Copy reference number"
                >
                  {copiedRef ? (
                    <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onEdit} className="btn-secondary text-sm">
            Edit
          </button>
          <button onClick={onDelete} className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 py-3 border-b border-gray-200 dark:border-gray-700">
        {(['details', 'drafts', 'references', 'moms', 'flow'] as TabMode[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setTabMode(tab)}
            className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
              tabMode === tab
                ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {tab === 'details' ? 'Details' :
             tab === 'drafts' ? `Drafts (${drafts.length})` :
             tab === 'references' ? `References (${references.from.length + references.to.length})` :
             tab === 'moms' ? `MOMs (${linkedMoms.length})` :
             'Process Flow'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto py-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full" />
          </div>
        ) : tabMode === 'details' ? (
          <div className="space-y-6">
            {/* Summary */}
            {letter.summary && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Summary</h3>
                <p className="text-gray-600 dark:text-gray-400">{letter.summary}</p>
              </div>
            )}

            {/* Attachments */}
            {attachments.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Attachments ({attachments.length})
                </h3>
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg px-4 py-2">
                      <svg className="w-6 h-6 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{attachment.filename}</p>
                        {attachment.file_size && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(attachment.file_size)}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => window.electronAPI.letterAttachments.showInFolder(attachment.id)}
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                          title="Open folder"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        </button>
                        <button
                          onClick={async () => {
                            const path = await window.electronAPI.letterAttachments.getFilePath(attachment.id)
                            if (path) handleOpenFile(path)
                          }}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => handleDeleteAttachment(attachment.id)}
                          className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Organization</h4>
                <p className="text-gray-900 dark:text-gray-100">
                  {letter.authority_name || 'Not specified'}
                  {letter.authority_short_name && ` (${letter.authority_short_name})`}
                </p>
              </div>
              {letter.contact_name && (
                <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3">
                  <h4 className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase mb-2">Att (Contact Person)</h4>
                  <p className="text-gray-900 dark:text-gray-100">{letter.contact_name}</p>
                  {letter.contact_title && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{letter.contact_title}</p>
                  )}
                </div>
              )}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Topic</h4>
                <p className="text-gray-900 dark:text-gray-100">{letter.topic_title || 'Not specified'}</p>
                {letter.subcategory_title && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{letter.subcategory_title}</p>
                )}
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Letter Date</h4>
                <p className="text-gray-900 dark:text-gray-100">
                  {letter.letter_date ? new Date(letter.letter_date).toLocaleDateString() : 'Not set'}
                </p>
              </div>
              {letter.letter_type === 'incoming' && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Received Date</h4>
                  <p className="text-gray-900 dark:text-gray-100">
                    {letter.received_date ? new Date(letter.received_date).toLocaleDateString() : 'Not set'}
                  </p>
                </div>
              )}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Response Type</h4>
                <p className="text-gray-900 dark:text-gray-100 capitalize">
                  {letter.response_type?.replace('_', ' ') || 'Not specified'}
                </p>
              </div>
            </div>

            {/* Timestamps */}
            <div className="text-sm text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p>Created by {letter.creator_name} on {new Date(letter.created_at).toLocaleString()}</p>
              <p>Last updated: {new Date(letter.updated_at).toLocaleString()}</p>
            </div>
          </div>
        ) : tabMode === 'drafts' ? (
          <div className="space-y-4">
            {/* Create Draft Button/Form */}
            {!showDraftForm ? (
              <button
                onClick={() => setShowDraftForm(true)}
                className="btn-primary text-sm"
              >
                Create New Draft
              </button>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">New Draft</h4>
                <input
                  type="text"
                  placeholder="Draft title"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <textarea
                  placeholder="Draft edits / notes"
                  value={draftEdits}
                  onChange={(e) => setDraftEdits(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  rows={3}
                />
                {/* Draft File Attachment */}
                <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-3">
                  {draftFile ? (
                    <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/30 rounded px-3 py-2">
                      <div className="flex items-center gap-2">
                        <svg className="w-6 h-6 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{draftFile.filename}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(draftFile.size)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setDraftFile(null)}
                        className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Attach draft document</p>
                      <button
                        type="button"
                        onClick={handleSelectDraftFile}
                        className="btn-secondary text-sm"
                      >
                        Select File
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCreateDraft} className="btn-primary text-sm">
                    Create Draft
                  </button>
                  <button onClick={() => {
                    setShowDraftForm(false)
                    setDraftTitle('')
                    setDraftEdits('')
                    setDraftFile(null)
                  }} className="btn-secondary text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Draft List */}
            {drafts.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">No drafts yet</p>
            ) : (
              <div className="space-y-3">
                {drafts.map((draft) => (
                  <div key={draft.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 dark:text-gray-100">{draft.title}</span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">v{draft.version}</span>
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(draft.status)}`}>
                            {draft.status}
                          </span>
                          {draft.is_final && (
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300">
                              FINAL
                            </span>
                          )}
                        </div>
                        {draft.content && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">{draft.content}</p>
                        )}
                        {draft.original_filename && (
                          <div className="flex items-center gap-2 mt-2">
                            <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <button
                              onClick={async () => {
                                const path = await window.electronAPI.letterDrafts.getFilePath(draft.id)
                                if (path) handleOpenFile(path)
                              }}
                              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline"
                            >
                              {draft.original_filename}
                            </button>
                            <button
                              onClick={() => window.electronAPI.letterDrafts.showInFolder(draft.id)}
                              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                              title="Open folder"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                              </svg>
                            </button>
                          </div>
                        )}
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                          By {draft.creator_name} on {new Date(draft.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {draft.status === 'draft' && (
                          <>
                            <button
                              onClick={() => handleDraftAction(draft.id, 'approve')}
                              className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 text-sm"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleDraftAction(draft.id, 'delete')}
                              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm"
                            >
                              Delete
                            </button>
                          </>
                        )}
                        {draft.status === 'approved' && (
                          <button
                            onClick={() => handleDraftAction(draft.id, 'send')}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
                          >
                            Mark as Sent
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : tabMode === 'references' ? (
          <div className="space-y-6">
            {/* Add Reference Form */}
            {!showRefForm ? (
              <button
                onClick={() => setShowRefForm(true)}
                className="btn-primary text-sm"
              >
                Add Reference
              </button>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Add Reference by Reference Number</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter reference number..."
                    value={refNumber}
                    onChange={(e) => {
                      setRefNumber(e.target.value)
                      setFoundLetter(null)
                      setRefError('')
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    onClick={handleSearchReference}
                    disabled={refSearching}
                    className="btn-secondary text-sm"
                  >
                    {refSearching ? 'Searching...' : 'Search'}
                  </button>
                </div>

                {refError && (
                  <p className="text-red-600 dark:text-red-400 text-sm">{refError}</p>
                )}

                {foundLetter && (
                  <div className="bg-white dark:bg-gray-800 border border-green-200 dark:border-green-700 rounded-lg p-3">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">Letter found:</p>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{foundLetter.subject}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {foundLetter.reference_number || foundLetter.incoming_number || foundLetter.outgoing_number}
                    </p>

                    <div className="mt-3 space-y-2">
                      <select
                        value={refType}
                        onChange={(e) => setRefType(e.target.value as ReferenceType)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="related">Related</option>
                        <option value="reply_to">Reply To</option>
                        <option value="supersedes">Supersedes</option>
                        <option value="amends">Amends</option>
                        <option value="attachment_to">Attachment To</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Notes (optional)"
                        value={refNotes}
                        onChange={(e) => setRefNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleCreateReference}
                    disabled={!foundLetter}
                    className="btn-primary text-sm disabled:opacity-50"
                  >
                    Create Reference
                  </button>
                  <button
                    onClick={() => {
                      setShowRefForm(false)
                      setRefNumber('')
                      setRefType('related')
                      setRefNotes('')
                      setFoundLetter(null)
                      setRefError('')
                    }}
                    className="btn-secondary text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* References From (this letter references) */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                References ({references.from.length})
              </h4>
              {references.from.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">This letter doesn't reference any other letters</p>
              ) : (
                <div className="space-y-2">
                  {references.from.map((ref) => (
                    <div key={ref.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">
                          {ref.reference_type.replace('_', ' ')}
                        </span>
                        <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                        <div>
                          <span className="text-sm text-gray-900 dark:text-gray-100">
                            {ref.target_subject || 'Unknown letter'}
                          </span>
                          {ref.target_reference_number && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono ml-2">
                              ({ref.target_reference_number})
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteReference(ref.id)}
                        className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1"
                        title="Remove reference"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Referenced By (letters that reference this one) */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                Referenced By ({references.to.length})
              </h4>
              {references.to.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No other letters reference this one</p>
              ) : (
                <div className="space-y-2">
                  {references.to.map((ref) => (
                    <div key={ref.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <span className="text-sm text-gray-900 dark:text-gray-100">
                            {ref.source_subject || 'Unknown letter'}
                          </span>
                          {ref.source_reference_number && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono ml-2">
                              ({ref.source_reference_number})
                            </span>
                          )}
                        </div>
                        <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">
                          {ref.reference_type.replace('_', ' ')}
                        </span>
                      </div>
                      {ref.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{ref.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : tabMode === 'moms' ? (
          /* Linked MOMs Tab */
          <div className="space-y-4">
            {/* Linked MOMs list */}
            {linkedMoms.length > 0 ? (
              <div className="space-y-2">
                {linkedMoms.map((link) => (
                  <div key={link.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg group">
                    <div
                      className="flex items-center gap-3 min-w-0 cursor-pointer hover:text-primary-700 dark:hover:text-primary-400"
                      onClick={() => {
                        onClose()
                        navigate(`/mom?momId=${link.mom_internal_id}`)
                      }}
                    >
                      {link.mom_display_id && (
                        <span className="text-xs font-mono font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded flex-shrink-0">
                          {link.mom_display_id}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                        link.mom_status === 'open' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        {link.mom_status}
                      </span>
                      <span className="text-sm text-gray-900 dark:text-gray-100 truncate">{link.mom_title}</span>
                    </div>
                    <button
                      onClick={() => handleUnlinkMom(link.mom_internal_id)}
                      className="p-1 rounded text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                      title="Unlink MOM"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No MOMs linked to this letter.</p>
            )}

            {/* Search MOM by ID */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Link a MOM</h4>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={momIdSearch}
                  onChange={(e) => setMomIdSearch(e.target.value)}
                  placeholder="Paste MOM ID to link..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              {momSearchError && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">{momSearchError}</p>
              )}
              {foundMom && !linkedMomIds.has(foundMom.id) && (
                <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {foundMom.mom_id && (
                          <span className="text-xs font-mono font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded">
                            {foundMom.mom_id}
                          </span>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          foundMom.status === 'open' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>
                          {foundMom.status}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{foundMom.title}</p>
                    </div>
                    <button
                      onClick={handleLinkMom}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors flex-shrink-0 ml-2"
                    >
                      Link
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Process Flow Tab */
          <ProcessFlowGraph
            letterId={letter.id}
            onNodeClick={(nodeId, nodeType) => {
              console.log('Clicked node:', nodeId, nodeType)
              // Could open a modal or navigate to the letter/draft
            }}
          />
        )}
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
        <button onClick={onClose} className="btn-secondary">
          Close
        </button>
      </div>
    </div>
  )
}
