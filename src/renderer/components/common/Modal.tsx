import React, { useEffect, useRef, useMemo, ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  title: string
  children: ReactNode
  onClose: () => void
  isOpen?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
  /** If true, renders to document.body covering entire screen. If false (default), renders to #modal-root covering only main content */
  fullScreen?: boolean
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl'
}

export function Modal({
  title,
  children,
  onClose,
  isOpen = true,
  size = 'md',
  closeOnOverlayClick = false,
  closeOnEscape = false,
  fullScreen = false
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Create a stable container element for this modal instance
  const portalContainer = useMemo(() => {
    const container = document.createElement('div')
    container.className = 'modal-portal-container'
    container.style.cssText = 'position: absolute; inset: 0; z-index: 9999; pointer-events: none;'
    return container
  }, [])

  // Mount/unmount the container to the appropriate parent
  useEffect(() => {
    const parent = fullScreen
      ? document.body
      : (document.getElementById('modal-root') || document.body)

    parent.appendChild(portalContainer)

    return () => {
      // Safe cleanup - check if container is still a child before removing
      if (portalContainer.parentNode === parent) {
        parent.removeChild(portalContainer)
      }
    }
  }, [fullScreen, portalContainer])

  // Handle escape key (only if enabled)
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose, isOpen, closeOnEscape])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return

    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Focus trap
  useEffect(() => {
    if (!isOpen) return

    const focusableElements = contentRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )

    if (focusableElements && focusableElements.length > 0) {
      (focusableElements[0] as HTMLElement).focus()
    }
  }, [isOpen])

  // Handle click outside (only if enabled)
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === overlayRef.current) {
      onClose()
    }
  }

  // Don't render if not open (after all hooks)
  if (!isOpen) return null

  const modalContent = (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="modal-overlay absolute inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in pointer-events-auto"
    >
      <div
        ref={contentRef}
        className={`modal-content w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-2xl animate-slide-in`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 id="modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 px-6 py-4 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )

  // Use portal to render - to modal-root (main content only) or document.body (fullScreen)
  return createPortal(modalContent, portalContainer)
}
