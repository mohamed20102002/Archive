import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import type { Credential } from '../../types'

const categoryColors: Record<string, string> = {
  Software: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
  Desktop: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
  Server: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
  Network: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300',
  Other: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
}

const colorClasses: Record<string, string> = {
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-500',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500'
}

interface CredentialCardProps {
  credential: Credential
  onClick: () => void
  highlighted?: boolean
}

export function CredentialCard({ credential, onClick, highlighted }: CredentialCardProps) {
  const { user } = useAuth()
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [passwordValue, setPasswordValue] = useState('')
  const [copying, setCopying] = useState<'username' | 'password' | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  const handleRevealPassword = async (e: React.MouseEvent) => {
    e.stopPropagation()
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
        // Auto-hide after 30 seconds
        hideTimerRef.current = setTimeout(() => {
          setPasswordVisible(false)
          setPasswordValue('')
        }, 30000)
      }
    } catch (err) {
      console.error('Error revealing password:', err)
    }
  }

  const handleCopyUsername = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(credential.username)
      setCopying('username')
      setTimeout(() => setCopying(null), 1500)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleCopyPassword = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) return
    try {
      const result = await window.electronAPI.credentials.getPassword(credential.id, user.id)
      if (result.success && result.password) {
        await navigator.clipboard.writeText(result.password)
        setCopying('password')
        setTimeout(() => setCopying(null), 1500)
      }
    } catch (err) {
      console.error('Failed to copy password:', err)
    }
  }

  const catColorClass = categoryColors[credential.category] || categoryColors.Other

  return (
    <div
      onClick={onClick}
      className={`relative bg-white dark:bg-gray-800 rounded-lg border p-4 hover:shadow-md transition-all cursor-pointer ${
        highlighted
          ? 'border-primary-400 ring-2 ring-primary-300 animate-pulse shadow-lg'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      {/* Color indicator - left border */}
      {credential.color && (
        <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${colorClasses[credential.color]}`} />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {/* Admin-only lock icon */}
          {credential.admin_only && (
            <div className="flex-shrink-0" title="Admin Only">
              <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{credential.system_name}</h3>
            {credential.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{credential.description}</p>
            )}
          </div>
        </div>
        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${catColorClass}`}>
          {credential.category}
        </span>
      </div>

      {/* Username row */}
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1 font-mono">{credential.username}</span>
        <button
          onClick={handleCopyUsername}
          className="p-1 text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors flex-shrink-0"
          title="Copy username"
        >
          {copying === 'username' ? (
            <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>

      {/* Password row */}
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1 font-mono">
          {passwordVisible ? passwordValue : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
        </span>
        <button
          onClick={handleRevealPassword}
          className="p-1 text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors flex-shrink-0"
          title={passwordVisible ? 'Hide password' : 'Show password'}
        >
          {passwordVisible ? (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.5 6.5m7.378 7.378L17.5 17.5M3 3l18 18" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
        <button
          onClick={handleCopyPassword}
          className="p-1 text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors flex-shrink-0"
          title="Copy password"
        >
          {copying === 'password' ? (
            <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
