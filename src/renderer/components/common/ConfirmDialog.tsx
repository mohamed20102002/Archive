import React, { useState, useCallback, createContext, useContext } from 'react'

interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
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

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={handleCancel}
          />
          {/* Dialog */}
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden animate-scale-in">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {state.options.title}
              </h3>
              <p className="text-gray-600">
                {state.options.message}
              </p>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {state.options.cancelText || 'Cancel'}
              </button>
              <button
                onClick={handleConfirm}
                autoFocus
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 ${
                  state.options.danger
                    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                    : 'bg-primary-600 hover:bg-primary-700 focus:ring-primary-500'
                }`}
              >
                {state.options.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
