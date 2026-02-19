import React from 'react'
import { useUndoRedo } from '../../context/UndoRedoContext'
import { useToast } from '../../context/ToastContext'

export function UndoRedoButtons() {
  const { canUndo, canRedo, undo, redo, getUndoDescription, getRedoDescription } = useUndoRedo()
  const toast = useToast()

  const handleUndo = async () => {
    const result = await undo()
    if (result.success && result.entry) {
      toast.info('Undone', result.entry.description)
    } else if (!result.success && result.error) {
      toast.error('Undo failed', result.error)
    }
  }

  const handleRedo = async () => {
    const result = await redo()
    if (result.success && result.entry) {
      toast.info('Redone', result.entry.description)
    } else if (!result.success && result.error) {
      toast.error('Redo failed', result.error)
    }
  }

  const undoDescription = getUndoDescription()
  const redoDescription = getRedoDescription()

  return (
    <div className="flex items-center gap-1">
      {/* Undo Button */}
      <button
        onClick={handleUndo}
        disabled={!canUndo}
        className={`p-2 rounded-lg transition-colors ${
          canUndo
            ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
            : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
        }`}
        title={canUndo ? `Undo: ${undoDescription} (Ctrl+Z)` : 'Nothing to undo'}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
          />
        </svg>
      </button>

      {/* Redo Button */}
      <button
        onClick={handleRedo}
        disabled={!canRedo}
        className={`p-2 rounded-lg transition-colors ${
          canRedo
            ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
            : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
        }`}
        title={canRedo ? `Redo: ${redoDescription} (Ctrl+Y)` : 'Nothing to redo'}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"
          />
        </svg>
      </button>
    </div>
  )
}
