/**
 * Optimistic Mutation Hook
 *
 * Provides optimistic updates for CRUD operations with automatic rollback on failure.
 * Shows immediate UI feedback while the actual operation is in progress.
 */

import { useState, useCallback, useRef } from 'react'
import { useToast } from '../context/ToastContext'

export type MutationStatus = 'idle' | 'pending' | 'success' | 'error'

interface OptimisticMutationOptions<TData, TVariables> {
  /** The actual mutation function to call */
  mutationFn: (variables: TVariables) => Promise<TData>
  /** Called immediately before mutation with optimistic data */
  onMutate?: (variables: TVariables) => TData | Promise<TData>
  /** Called on successful mutation */
  onSuccess?: (data: TData, variables: TVariables) => void
  /** Called on mutation error with rollback data */
  onError?: (error: Error, variables: TVariables, rollbackData?: TData) => void
  /** Called after mutation completes (success or error) */
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables) => void
  /** Show toast notifications */
  showToast?: boolean
  /** Success message */
  successMessage?: string
  /** Error message prefix */
  errorMessage?: string
}

interface OptimisticMutationResult<TData, TVariables> {
  /** Current mutation status */
  status: MutationStatus
  /** Whether mutation is in progress */
  isPending: boolean
  /** Whether mutation succeeded */
  isSuccess: boolean
  /** Whether mutation failed */
  isError: boolean
  /** Error if mutation failed */
  error: Error | null
  /** Result data from mutation */
  data: TData | null
  /** Execute the mutation */
  mutate: (variables: TVariables) => Promise<TData | undefined>
  /** Reset mutation state */
  reset: () => void
}

export function useOptimisticMutation<TData, TVariables = void>(
  options: OptimisticMutationOptions<TData, TVariables>
): OptimisticMutationResult<TData, TVariables> {
  const [status, setStatus] = useState<MutationStatus>('idle')
  const [data, setData] = useState<TData | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const rollbackDataRef = useRef<TData | undefined>(undefined)
  const toast = useToast()

  const mutate = useCallback(async (variables: TVariables): Promise<TData | undefined> => {
    setStatus('pending')
    setError(null)

    try {
      // Execute optimistic update if provided
      if (options.onMutate) {
        const optimisticData = await options.onMutate(variables)
        rollbackDataRef.current = optimisticData
      }

      // Execute actual mutation
      const result = await options.mutationFn(variables)

      setData(result)
      setStatus('success')

      // Success callback
      options.onSuccess?.(result, variables)

      // Show success toast
      if (options.showToast && options.successMessage) {
        toast.success(options.successMessage)
      }

      // Settled callback
      options.onSettled?.(result, null, variables)

      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))

      setError(error)
      setStatus('error')

      // Error callback with rollback data
      options.onError?.(error, variables, rollbackDataRef.current)

      // Show error toast
      if (options.showToast) {
        const message = options.errorMessage
          ? `${options.errorMessage}: ${error.message}`
          : error.message
        toast.error(message)
      }

      // Settled callback
      options.onSettled?.(undefined, error, variables)

      return undefined
    }
  }, [options, toast])

  const reset = useCallback(() => {
    setStatus('idle')
    setData(null)
    setError(null)
    rollbackDataRef.current = undefined
  }, [])

  return {
    status,
    isPending: status === 'pending',
    isSuccess: status === 'success',
    isError: status === 'error',
    error,
    data,
    mutate,
    reset
  }
}

/**
 * Hook for optimistic list operations (add, update, delete)
 */
interface OptimisticListOptions<TItem> {
  /** Initial list of items */
  initialItems?: TItem[]
  /** Key field for item identification */
  keyField?: keyof TItem
}

interface OptimisticListResult<TItem> {
  /** Current list of items */
  items: TItem[]
  /** Set items directly */
  setItems: React.Dispatch<React.SetStateAction<TItem[]>>
  /** Optimistically add an item */
  optimisticAdd: (item: TItem) => { rollback: () => void }
  /** Optimistically update an item */
  optimisticUpdate: (key: string | number, updates: Partial<TItem>) => { rollback: () => void }
  /** Optimistically remove an item */
  optimisticRemove: (key: string | number) => { rollback: () => void; removedItem: TItem | undefined }
  /** Pending operations count */
  pendingCount: number
  /** Whether any operation is pending */
  hasPending: boolean
}

export function useOptimisticList<TItem extends Record<string, any>>(
  options: OptimisticListOptions<TItem> = {}
): OptimisticListResult<TItem> {
  const { initialItems = [], keyField = 'id' as keyof TItem } = options
  const [items, setItems] = useState<TItem[]>(initialItems)
  const [pendingCount, setPendingCount] = useState(0)

  const optimisticAdd = useCallback((item: TItem) => {
    const previousItems = [...items]
    setItems(prev => [...prev, item])
    setPendingCount(prev => prev + 1)

    return {
      rollback: () => {
        setItems(previousItems)
        setPendingCount(prev => Math.max(0, prev - 1))
      }
    }
  }, [items])

  const optimisticUpdate = useCallback((key: string | number, updates: Partial<TItem>) => {
    const previousItems = [...items]
    setItems(prev => prev.map(item =>
      item[keyField] === key ? { ...item, ...updates } : item
    ))
    setPendingCount(prev => prev + 1)

    return {
      rollback: () => {
        setItems(previousItems)
        setPendingCount(prev => Math.max(0, prev - 1))
      }
    }
  }, [items, keyField])

  const optimisticRemove = useCallback((key: string | number) => {
    const previousItems = [...items]
    const removedItem = items.find(item => item[keyField] === key)
    setItems(prev => prev.filter(item => item[keyField] !== key))
    setPendingCount(prev => prev + 1)

    return {
      rollback: () => {
        setItems(previousItems)
        setPendingCount(prev => Math.max(0, prev - 1))
      },
      removedItem
    }
  }, [items, keyField])

  return {
    items,
    setItems,
    optimisticAdd,
    optimisticUpdate,
    optimisticRemove,
    pendingCount,
    hasPending: pendingCount > 0
  }
}

/**
 * Sync indicator component for showing pending state
 */
export function SyncIndicator({
  syncing,
  error,
  className = ''
}: {
  syncing: boolean
  error?: boolean
  className?: string
}) {
  if (!syncing && !error) return null

  return (
    <div className={`inline-flex items-center gap-1.5 text-xs ${className}`}>
      {syncing && !error && (
        <>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <span className="text-blue-600 dark:text-blue-400">Saving...</span>
        </>
      )}
      {error && (
        <>
          <div className="w-2 h-2 bg-red-500 rounded-full" />
          <span className="text-red-600 dark:text-red-400">Failed to save</span>
        </>
      )}
    </div>
  )
}

export default useOptimisticMutation
