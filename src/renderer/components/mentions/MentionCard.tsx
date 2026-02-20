import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import type { Mention, MentionEntityType } from '../../types'
import { notifyMentionDataChanged } from './MentionsBadge'

interface MentionCardProps {
  mention: Mention
  onRefresh: () => void
  showActions?: boolean
}

const entityTypeLabels: Record<MentionEntityType, string> = {
  record: 'Record',
  mom: 'MOM',
  letter: 'Letter',
  issue: 'Issue'
}

const entityTypeColors: Record<MentionEntityType, string> = {
  record: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  mom: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  letter: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  issue: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'
}

export function MentionCard({ mention, onRefresh, showActions = true }: MentionCardProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { formatDate } = useSettings()
  const [isLoading, setIsLoading] = useState(false)
  const [isEditingNote, setIsEditingNote] = useState(false)
  const [noteValue, setNoteValue] = useState(mention.note || '')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const isMentionedUser = user?.id === mention.mentioned_user_id
  const isCreator = user?.id === mention.created_by
  const isPending = mention.status === 'pending'
  const isAcknowledged = mention.status === 'acknowledged'

  const handleAcknowledge = async () => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const result = await window.electronAPI.mentions.acknowledge(mention.id, user.id)
      if (result.success) {
        notifyMentionDataChanged()
        onRefresh()
      } else {
        console.error('Failed to acknowledge mention:', result.error)
      }
    } catch (error) {
      console.error('Error acknowledging mention:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleArchive = async () => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const result = await window.electronAPI.mentions.archive(mention.id, user.id)
      if (result.success) {
        notifyMentionDataChanged()
        onRefresh()
      } else {
        console.error('Failed to archive mention:', result.error)
      }
    } catch (error) {
      console.error('Error archiving mention:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateNote = async () => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const result = await window.electronAPI.mentions.updateNote(mention.id, noteValue, user.id)
      if (result.success) {
        setIsEditingNote(false)
        onRefresh()
      } else {
        console.error('Failed to update note:', result.error)
      }
    } catch (error) {
      console.error('Error updating note:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const result = await window.electronAPI.mentions.delete(mention.id, user.id)
      if (result.success) {
        notifyMentionDataChanged()
        onRefresh()
      } else {
        console.error('Failed to delete mention:', result.error)
      }
    } catch (error) {
      console.error('Error deleting mention:', error)
    } finally {
      setIsLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleNavigateToEntity = () => {
    // Don't navigate if entity is deleted
    if (mention.entity_deleted) return

    switch (mention.entity_type) {
      case 'record':
        if (mention.topic_id) {
          navigate(`/topics/${mention.topic_id}?recordId=${mention.entity_id}`)
        } else {
          console.warn('Cannot navigate to record: missing topic_id')
        }
        break
      case 'mom':
        navigate(`/mom?highlightId=${mention.entity_id}`)
        break
      case 'letter':
        navigate(`/letters?highlightId=${mention.entity_id}`)
        break
      case 'issue':
        navigate(`/issues?highlightId=${mention.entity_id}`)
        break
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${entityTypeColors[mention.entity_type]}`}>
            {entityTypeLabels[mention.entity_type]}
          </span>
          <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{formatDate(mention.created_at, 'withTime')}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mention.status === 'pending' && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300">
              Pending
            </span>
          )}
          {mention.status === 'acknowledged' && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
              Acknowledged
            </span>
          )}
          {mention.status === 'archived' && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
              Archived
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        {/* Entity title */}
        {mention.entity_deleted ? (
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-400 dark:text-gray-500 line-clamp-2 line-through">
              {mention.entity_title || `${entityTypeLabels[mention.entity_type]} #${mention.entity_id.substring(0, 8)}`}
            </h3>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400">
              Deleted
            </span>
          </div>
        ) : (
          <button
            onClick={handleNavigateToEntity}
            className="text-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <h3 className="font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
              {mention.entity_title || `${entityTypeLabels[mention.entity_type]} #${mention.entity_id.substring(0, 8)}`}
            </h3>
          </button>
        )}

        {/* Deleted notice */}
        {mention.entity_deleted && (
          <p className="mt-2 text-sm text-red-500 dark:text-red-400 italic">
            This {entityTypeLabels[mention.entity_type].toLowerCase()} has been deleted and is no longer available.
          </p>
        )}

        {/* From/To info */}
        <div className="mt-2 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <span className="text-gray-400">From:</span>
            <span className="font-medium text-gray-700 dark:text-gray-300">{mention.creator_name || 'Unknown'}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-400">To:</span>
            <span className="font-medium text-gray-700 dark:text-gray-300">{mention.mentioned_user_name || 'Unknown'}</span>
          </div>
        </div>

        {/* Note */}
        {isEditingNote ? (
          <div className="mt-3">
            <textarea
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              placeholder="Add a note..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none bg-white dark:bg-gray-700 dark:text-gray-100"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => {
                  setIsEditingNote(false)
                  setNoteValue(mention.note || '')
                }}
                disabled={isLoading}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateNote}
                disabled={isLoading}
                className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : mention.note ? (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 italic">"{mention.note}"</p>
            {isCreator && isPending && showActions && (
              <button
                onClick={() => setIsEditingNote(true)}
                className="mt-2 text-xs text-blue-500 hover:text-blue-600"
              >
                Edit note
              </button>
            )}
          </div>
        ) : null}

        {/* Acknowledged at */}
        {mention.acknowledged_at && (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Acknowledged: {formatDate(mention.acknowledged_at, 'withTime')}
          </div>
        )}
      </div>

      {/* Actions */}
      {showActions && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Mentioned user actions */}
            {isMentionedUser && isPending && (
              <button
                onClick={handleAcknowledge}
                disabled={isLoading}
                className="btn-primary text-sm"
              >
                {isLoading ? 'Processing...' : 'Acknowledge'}
              </button>
            )}
            {isMentionedUser && isAcknowledged && (
              <button
                onClick={handleArchive}
                disabled={isLoading}
                className="btn-secondary text-sm"
              >
                {isLoading ? 'Processing...' : 'Archive'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Creator actions */}
            {isCreator && isPending && (
              <>
                {!mention.note && (
                  <button
                    onClick={() => setIsEditingNote(true)}
                    className="text-sm text-blue-500 hover:text-blue-600"
                  >
                    Add note
                  </button>
                )}
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Delete?</span>
                    <button
                      onClick={handleDelete}
                      disabled={isLoading}
                      className="text-sm text-red-500 hover:text-red-600"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="text-sm text-gray-500 hover:text-gray-600"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-sm text-red-500 hover:text-red-600"
                  >
                    Delete
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
