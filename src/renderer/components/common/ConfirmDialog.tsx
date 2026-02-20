import React, { useState, useCallback, useEffect, useMemo, createContext, useContext } from 'react'
import { createPortal } from 'react-dom'

interface ConfirmOptions {
  title: string
  message: string
  description?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  variant?: 'default' | 'danger'
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextType | null>(null)

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider')
  }
  return context.confirm
}

interface ConfirmState {
  isOpen: boolean
  options: ConfirmOptions
  resolve: ((value: boolean) => void) | null
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState>({
    isOpen: false,
    options: { title: '', message: '' },
    resolve: null
  })

  // Create a stable container element for the confirm dialog
  const portalContainer = useMemo(() => {
    const container = document.createElement('div')
    container.className = 'confirm-dialog-portal-container'
    container.style.cssText = 'position: absolute; inset: 0; z-index: 99999; pointer-events: none;'
    return container
  }, [])

  // Mount/unmount the container
  useEffect(() => {
    const parent = document.getElementById('modal-root') || document.body
    parent.appendChild(portalContainer)

    return () => {
      if (portalContainer.parentNode === parent) {
        parent.removeChild(portalContainer)
      }
    }
  }, [portalContainer])

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        options,
        resolve
      })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    state.resolve?.(true)
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }))
  }, [state.resolve])

  const handleCancel = useCallback(() => {
    state.resolve?.(false)
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }))
  }, [state.resolve])

  const dialogContent = state.isOpen ? (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleCancel}
      />
      {/* Dialog */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden animate-scale-in">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {state.options.title}
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            {state.options.message}
          </p>
          {state.options.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {state.options.description}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {state.options.cancelText || 'Cancel'}
          </button>
          <button
            onClick={handleConfirm}
            autoFocus
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 ${
              state.options.danger || state.options.variant === 'danger'
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                : 'bg-primary-600 hover:bg-primary-700 focus:ring-primary-500'
            }`}
          >
            {state.options.confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {dialogContent && createPortal(dialogContent, portalContainer)}
    </ConfirmContext.Provider>
  )
}
