// Undo/Redo System Types

export type OperationType = 'create' | 'update' | 'delete'
export type EntityType = 'record' | 'topic' | 'letter' | 'mom' | 'issue'

export interface EntitySnapshot {
  entityType: EntityType
  entityId: string
  data: Record<string, unknown>
}

export interface HistoryEntry {
  id: string
  timestamp: number
  operation: OperationType
  entityType: EntityType
  entityId: string
  description: string
  beforeState: EntitySnapshot | null  // null for create operations
  afterState: EntitySnapshot | null   // null for delete operations
  userId: string
}

export interface UndoRedoState {
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
  canUndo: boolean
  canRedo: boolean
  lastUndoneEntry: HistoryEntry | null
  lastRedoneEntry: HistoryEntry | null
}

export interface UndoRedoContextType {
  // State
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
  canUndo: boolean
  canRedo: boolean

  // Actions
  recordOperation: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => void
  undo: () => Promise<{ success: boolean; entry?: HistoryEntry; error?: string }>
  redo: () => Promise<{ success: boolean; entry?: HistoryEntry; error?: string }>
  clearHistory: () => void

  // Helpers
  getUndoDescription: () => string | null
  getRedoDescription: () => string | null
}

// Maximum history size to prevent memory issues
export const MAX_HISTORY_SIZE = 50

// Helper to generate unique IDs for history entries
export function generateHistoryId(): string {
  return `history_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}
