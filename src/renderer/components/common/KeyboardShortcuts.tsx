/**
 * Keyboard Shortcuts Overlay
 *
 * Displays available keyboard shortcuts in a modal overlay.
 * Triggered by Ctrl+/ or ? key.
 */

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { defaultShortcuts, ShortcutGroup } from '../../hooks/useKeyboardNavigation'

interface KeyboardShortcutsProps {
  isOpen: boolean
  onClose: () => void
  customShortcuts?: ShortcutGroup[]
}

export function KeyboardShortcutsOverlay({
  isOpen,
  onClose,
  customShortcuts
}: KeyboardShortcutsProps) {
  const { t } = useTranslation()
  const shortcuts = customShortcuts || defaultShortcuts

  // Close on escape
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[80vh] bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('shortcuts.title', 'Keyboard Shortcuts')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {shortcuts.map((group) => (
              <div key={group.name}>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  {t(`shortcuts.${group.name.toLowerCase()}`, group.name)}
                </h3>
                <ul className="space-y-2">
                  {group.shortcuts.map((shortcut, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {shortcut.description}
                      </span>
                      <KeyCombo keys={shortcut.keys} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 text-center">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t('shortcuts.pressToClose', 'Press')} <KeyCombo keys="Escape" /> {t('shortcuts.toClose', 'to close')}
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Key combination display component
 */
function KeyCombo({ keys }: { keys: string }) {
  // Split keys like "Ctrl + K" or "G then D"
  const parts = keys.split(/\s*[\+,]\s*|\s+then\s+/i)

  return (
    <span className="flex items-center gap-1">
      {parts.map((key, index) => (
        <React.Fragment key={index}>
          {index > 0 && keys.toLowerCase().includes('then') && (
            <span className="text-gray-400 text-xs mx-0.5">then</span>
          )}
          {index > 0 && !keys.toLowerCase().includes('then') && (
            <span className="text-gray-400 text-xs mx-0.5">+</span>
          )}
          <kbd className="px-2 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600 shadow-sm">
            {key.trim()}
          </kbd>
        </React.Fragment>
      ))}
    </span>
  )
}

/**
 * Hook to manage keyboard shortcuts overlay
 */
export function useKeyboardShortcutsOverlay() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger in inputs
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      // Ctrl+/ or ?
      if ((e.ctrlKey && e.key === '/') || (e.key === '?' && !e.ctrlKey)) {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev)
  }
}

/**
 * Keyboard shortcut indicator component
 * Shows a small indicator when Go-to mode is active
 */
export function GoToIndicator({ active }: { active: boolean }) {
  const { t } = useTranslation()

  if (!active) return null

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-gray-900 dark:bg-gray-700 text-white px-4 py-2 rounded-lg shadow-lg animate-pulse">
        <span className="text-sm">
          {t('shortcuts.goToMode', 'Go to...')} <kbd className="ml-2 px-1.5 py-0.5 bg-gray-700 dark:bg-gray-600 rounded text-xs">D</kbd>ashboard <kbd className="px-1.5 py-0.5 bg-gray-700 dark:bg-gray-600 rounded text-xs">T</kbd>opics <kbd className="px-1.5 py-0.5 bg-gray-700 dark:bg-gray-600 rounded text-xs">L</kbd>etters
        </span>
      </div>
    </div>
  )
}

export default KeyboardShortcutsOverlay
