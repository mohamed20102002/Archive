import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { CredentialForm } from './CredentialForm'
import type { Credential, UpdateCredentialData } from '../../types'

const categoryColors: Record<string, string> = {
  Software: 'bg-blue-100 text-blue-700',
  Desktop: 'bg-purple-100 text-purple-700',
  Server: 'bg-green-100 text-green-700',
  Network: 'bg-orange-100 text-orange-700',
  Other: 'bg-gray-100 text-gray-600'
}

interface CredentialDetailProps {
  credential: Credential
  onClose: () => void
  onUpdated: () => void
}

export function CredentialDetail({ credential, onClose, onUpdated }: CredentialDetailProps) {
  const { user } = useAuth()
  const [editing, setEditing] = useState(false)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [passwordValue, setPasswordValue] = useState('')
  const [copying, setCopying] = useState<'username' | 'password' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  const handleRevealPassword = async () => {
    if (!user) return

    if (passwordVisible) {
      setPasswordVisible(false)
      setPasswordValue('')
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      return
    }

    try {
      const result = await window.electronAPI.credentials.getPassword(credential.id, user.id)
      if (result.success && result.password) {
        setPasswordValue(result.password)
        setPasswordVisible(true)
        hideTimerRef.current = setTimeout(() => {
          setPasswordVisible(false)
          setPasswordValue('')
        }, 30000)
      }
    } catch (err) {
      console.error('Error revealing password:', err)
    }
  }

  const handleCopy = async (text: string, field: 'username' | 'password') => {
    try {
      if (field === 'password' && user) {
        const result = await window.electronAPI.credentials.getPassword(credential.id, user.id)
        if (result.success && result.password) {
          await navigator.clipboard.writeText(result.password)
        }
      } else {
        await navigator.clipboard.writeText(text)
      }
      setCopying(field)
      setTimeout(() => setCopying(null), 1500)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleUpdate = async (data: UpdateCredentialData) => {
    if (!user) return
    try {
      const result = await window.electronAPI.credentials.update(credential.id, data, user.id)
      if (result.success) {
        setEditing(false)
        onUpdated()
      } else {
        alert(result.error || 'Failed to update credential')
      }
    } catch (err) {
      console.error('Error updating credential:', err)
    }
  }

  const handleDelete = async () => {
    if (!user) return
    try {
      const result = await window.electronAPI.credentials.delete(credential.id, user.id)
      if (result.success) {
        onClose()
        onUpdated()
      } else {
        alert(result.error || 'Failed to delete credential')
      }
    } catch (err) {
      console.error('Error deleting credential:', err)
    }
  }

  if (editing) {
    return (
      <CredentialForm
        credential={credential}
        onSubmit={(data) => handleUpdate(data as UpdateCredentialData)}
        onCancel={() => setEditing(false)}
      />
    )
  }

  const colorClass = categoryColors[credential.category] || categoryColors.Other

  return (
    <div className="space-y-4">
      {/* System Name + Category */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{credential.system_name}</h3>
          {credential.description && (
            <p className="text-sm text-gray-500 mt-1">{credential.description}</p>
          )}
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colorClass}`}>
          {credential.category}
        </span>
      </div>

      {/* Username */}
      <div className="bg-gray-50 rounded-lg p-3">
        <label className="text-xs text-gray-500 uppercase font-medium">Username</label>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm font-mono text-gray-900 flex-1">{credential.username}</span>
          <button
            onClick={() => handleCopy(credential.username, 'username')}
            className="px-2.5 py-1 text-xs font-medium text-primary-600 bg-primary-50 rounded hover:bg-primary-100 transition-colors"
          >
            {copying === 'username' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Password */}
      <div className="bg-gray-50 rounded-lg p-3">
        <label className="text-xs text-gray-500 uppercase font-medium">Password</label>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm font-mono text-gray-900 flex-1">
            {passwordVisible ? passwordValue : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
          </span>
          <button
            onClick={handleRevealPassword}
            className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
          >
            {passwordVisible ? 'Hide' : 'Reveal'}
          </button>
          <button
            onClick={() => handleCopy('', 'password')}
            className="px-2.5 py-1 text-xs font-medium text-primary-600 bg-primary-50 rounded hover:bg-primary-100 transition-colors"
          >
            {copying === 'password' ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {passwordVisible && (
          <p className="text-xs text-gray-400 mt-1">Auto-hides in 30 seconds</p>
        )}
      </div>

      {/* Notes */}
      {credential.notes && (
        <div className="bg-gray-50 rounded-lg p-3">
          <label className="text-xs text-gray-500 uppercase font-medium">Notes</label>
          <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{credential.notes}</p>
        </div>
      )}

      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-gray-400 pt-2 border-t border-gray-100">
        {credential.creator_name && <span>Created by {credential.creator_name}</span>}
        <span>Created {new Date(credential.created_at).toLocaleDateString()}</span>
        <span>Updated {new Date(credential.updated_at).toLocaleDateString()}</span>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-2">
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-red-600">Delete this credential?</span>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            Delete
          </button>
        )}
        <button
          onClick={() => setEditing(true)}
          className="px-4 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
        >
          Edit
        </button>
      </div>
    </div>
  )
}
