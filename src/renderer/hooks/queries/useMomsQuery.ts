import { useQuery, useMutation } from '@tanstack/react-query'
import { queryKeys, invalidateQueries } from '../../lib/queryClient'

interface MOM {
  id: string
  mom_id: string | null
  title: string
  subject: string | null
  meeting_date: string | null
  location_id: string | null
  status: string
  storage_path: string | null
  original_filename: string | null
  file_type: string | null
  file_size: number | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  location_name?: string
  creator_name?: string
  action_count?: number
  open_action_count?: number
}

interface MOMAction {
  id: string
  mom_internal_id: string
  description: string
  responsible_party: string | null
  deadline: string | null
  reminder_date: string | null
  status: string
  resolution_note: string | null
  resolution_file_path: string | null
  resolution_filename: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

interface MOMFilters {
  status?: string
  locationId?: string
  query?: string
  limit?: number
  offset?: number
}

interface PaginatedMOMs {
  data: MOM[]
  total: number
  hasMore: boolean
}

// Get all MOMs with filters
export function useMOMsQuery(filters?: MOMFilters) {
  return useQuery({
    queryKey: queryKeys.moms.list(filters || {}),
    queryFn: async (): Promise<PaginatedMOMs> => {
      return window.electronAPI.moms.getAll(filters)
    }
  })
}

// Get single MOM by ID
export function useMOMQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.moms.detail(id || ''),
    queryFn: async (): Promise<MOM | null> => {
      if (!id) return null
      return window.electronAPI.moms.getById(id)
    },
    enabled: !!id
  })
}

// Get MOM actions
export function useMOMActionsQuery(momId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.moms.actions(momId || ''),
    queryFn: async (): Promise<MOMAction[]> => {
      if (!momId) return []
      return window.electronAPI.momActions.getByMom(momId)
    },
    enabled: !!momId
  })
}

// Get MOM drafts
export function useMOMDraftsQuery(momId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.moms.drafts(momId || ''),
    queryFn: async () => {
      if (!momId) return []
      return window.electronAPI.momDrafts.getByMom(momId)
    },
    enabled: !!momId
  })
}

// Create MOM mutation
export function useCreateMOMMutation() {
  return useMutation({
    mutationFn: async (data: Partial<MOM>) => {
      return window.electronAPI.moms.create(data)
    },
    onSuccess: () => {
      invalidateQueries.moms()
      invalidateQueries.dashboard()
    }
  })
}

// Update MOM mutation
export function useUpdateMOMMutation() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MOM> }) => {
      return window.electronAPI.moms.update(id, data)
    },
    onSuccess: () => {
      invalidateQueries.moms()
    }
  })
}

// Delete MOM mutation
export function useDeleteMOMMutation() {
  return useMutation({
    mutationFn: async (id: string) => {
      return window.electronAPI.moms.delete(id)
    },
    onSuccess: () => {
      invalidateQueries.moms()
      invalidateQueries.dashboard()
    }
  })
}

// Create MOM action mutation
export function useCreateMOMActionMutation() {
  return useMutation({
    mutationFn: async (data: Partial<MOMAction> & { mom_internal_id: string }) => {
      return window.electronAPI.momActions.create(data)
    },
    onSuccess: (_data, variables) => {
      invalidateQueries.moms()
    }
  })
}

// Update MOM action mutation
export function useUpdateMOMActionMutation() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MOMAction> }) => {
      return window.electronAPI.momActions.update(id, data)
    },
    onSuccess: () => {
      invalidateQueries.moms()
    }
  })
}

// Resolve MOM action mutation
export function useResolveMOMActionMutation() {
  return useMutation({
    mutationFn: async ({
      id,
      resolutionNote,
      resolutionFile
    }: {
      id: string
      resolutionNote?: string
      resolutionFile?: { path: string; filename: string }
    }) => {
      return window.electronAPI.momActions.resolve(id, resolutionNote, resolutionFile)
    },
    onSuccess: () => {
      invalidateQueries.moms()
    }
  })
}
