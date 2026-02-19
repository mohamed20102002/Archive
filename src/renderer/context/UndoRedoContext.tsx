import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { notifyDataChanged } from '../utils/dataEvents'
import type {
  HistoryEntry,
  UndoRedoContextType,
  EntitySnapshot,
  MAX_HISTORY_SIZE,
  generateHistoryId
} from '../types/undoRedo'

// Re-import constants since they're not types
const HISTORY_MAX_SIZE = 50

function createHistoryId(): string {
  return `history_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

const UndoRedoContext = createContext<UndoRedoContextType | undefined>(undefined)

export function UndoRedoProvider({ children }: { children: ReactNode }) {
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([])
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([])
  const { user } = useAuth()
  const toast = useToast()

  // Clear history on logout
  useEffect(() => {
    if (!user) {
      setUndoStack([])
      setRedoStack([])
    }
  }, [user])

  // Record a new operation
  const recordOperation = useCallback((entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => {
    const newEntry: HistoryEntry = {
      ...entry,
      id: createHistoryId(),
      timestamp: Date.now()
    }

    setUndoStack(prev => {
      const updated = [newEntry, ...prev]
      // Trim to max size
      return updated.slice(0, HISTORY_MAX_SIZE)
    })
    // Clear redo stack when new operation is recorded
    setRedoStack([])
  }, [])

  // Undo the last operation
  const undo = useCallback(async (): Promise<{ success: boolean; entry?: HistoryEntry; error?: string }> => {
    if (undoStack.length === 0) {
      return { success: false, error: 'Nothing to undo' }
    }

    const entry = undoStack[0]

    try {
      // Perform the undo operation based on the operation type
      let result: { success: boolean; error?: string }

      switch (entry.operation) {
        case 'create':
          // Undo create = delete the entity
          result = await window.electronAPI.history.undoCreate(
            entry.entityType,
            entry.entityId,
            entry.userId
          )
          break

        case 'update':
          // Undo update = restore beforeState
          if (!entry.beforeState) {
            return { success: false, error: 'No before state to restore' }
          }
          result = await window.electronAPI.history.undoUpdate(
            entry.entityType,
            entry.entityId,
            entry.beforeState.data,
            entry.userId
          )
          break

        case 'delete':
          // Undo delete = restore the entity
          result = await window.electronAPI.history.undoDelete(
            entry.entityType,
            entry.entityId,
            entry.userId
          )
          break

        default:
          return { success: false, error: 'Unknown operation type' }
      }

      if (!result.success) {
        return { success: false, error: result.error }
      }

      // Move entry from undo to redo stack
      setUndoStack(prev => prev.slice(1))
      setRedoStack(prev => [entry, ...prev].slice(0, HISTORY_MAX_SIZE))

      // Notify UI to refresh - map operation to action type
      const action = entry.operation === 'create' ? 'delete'
        : entry.operation === 'delete' ? 'create'
        : 'update'
      notifyDataChanged(entry.entityType, action, entry.entityId)

      return { success: true, entry }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Undo failed'
      return { success: false, error: message }
    }
  }, [undoStack])

  // Redo the last undone operation
  const redo = useCallback(async (): Promise<{ success: boolean; entry?: HistoryEntry; error?: string }> => {
    if (redoStack.length === 0) {
      return { success: false, error: 'Nothing to redo' }
    }

    const entry = redoStack[0]

    try {
      // Perform the redo operation based on the operation type
      let result: { success: boolean; error?: string }

      switch (entry.operation) {
        case 'create':
          // Redo create = restore the entity
          result = await window.electronAPI.history.redoCreate(
            entry.entityType,
            entry.entityId,
            entry.userId
          )
          break

        case 'update':
          // Redo update = apply afterState
          if (!entry.afterState) {
            return { success: false, error: 'No after state to apply' }
          }
          result = await window.electronAPI.history.redoUpdate(
            entry.entityType,
            entry.entityId,
            entry.afterState.data,
            entry.userId
          )
          break

        case 'delete':
          // Redo delete = delete again
          result = await window.electronAPI.history.redoDelete(
            entry.entityType,
            entry.entityId,
            entry.userId
          )
          break

        default:
          return { success: false, error: 'Unknown operation type' }
      }

      if (!result.success) {
        return { success: false, error: result.error }
      }

      // Move entry from redo to undo stack
      setRedoStack(prev => prev.slice(1))
      setUndoStack(prev => [entry, ...prev].slice(0, HISTORY_MAX_SIZE))

      // Notify UI to refresh - redo restores the original action
      notifyDataChanged(entry.entityType, entry.operation, entry.entityId)

      return { success: true, entry }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Redo failed'
      return { success: false, error: message }
    }
  }, [redoStack])

  // Clear all history
  const clearHistory = useCallback(() => {
    setUndoStack([])
    setRedoStack([])
  }, [])

  // Get description of what would be undone
  const getUndoDescription = useCallback((): string | null => {
    if (undoStack.length === 0) return null
    return undoStack[0].description
  }, [undoStack])

  // Get description of what would be redone
  const getRedoDescription = useCallback((): string | null => {
    if (redoStack.length === 0) return null
    return redoStack[0].description
  }, [redoStack])

  // Use refs for stable references in keyboard handler
  const undoRef = useRef(undo)
  const redoRef = useRef(redo)
  const undoStackLengthRef = useRef(undoStack.length)
  const redoStackLengthRef = useRef(redoStack.length)
  const toastRef = useRef(toast)

  // Keep refs updated
  useEffect(() => {
    undoRef.current = undo
    redoRef.current = redo
    undoStackLengthRef.current = undoStack.length
    redoStackLengthRef.current = redoStack.length
    toastRef.current = toast
  }, [undo, redo, undoStack.length, redoStack.length, toast])

  // Global keyboard shortcuts - stable listener that doesn't re-register
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Check if user is typing in an input field
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      // Ctrl+Z for undo
      if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
        e.preventDefault()
        if (undoStackLengthRef.current > 0) {
          const result = await undoRef.current()
          if (result.success && result.entry) {
            toastRef.current.info('Undone', result.entry.description)
          } else if (!result.success && result.error) {
            toastRef.current.error('Undo failed', result.error)
          }
        }
      }

      // Ctrl+Y or Ctrl+Shift+Z for redo
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) {
        e.preventDefault()
        if (redoStackLengthRef.current > 0) {
          const result = await redoRef.current()
          if (result.success && result.entry) {
            toastRef.current.info('Redone', result.entry.description)
          } else if (!result.success && result.error) {
            toastRef.current.error('Redo failed', result.error)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, []) // Empty deps - listener is stable

  const value: UndoRedoContextType = {
    undoStack,
    redoStack,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    recordOperation,
    undo,
    redo,
    clearHistory,
    getUndoDescription,
    getRedoDescription
  }

  return (
    <UndoRedoContext.Provider value={value}>
      {children}
    </UndoRedoContext.Provider>
  )
}

export function useUndoRedo(): UndoRedoContextType {
  const context = useContext(UndoRedoContext)
  if (context === undefined) {
    throw new Error('useUndoRedo must be used within an UndoRedoProvider')
  }
  return context
}
