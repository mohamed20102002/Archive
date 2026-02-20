import { useQuery, useMutation } from '@tanstack/react-query'
import { queryKeys, invalidateQueries } from '../../lib/queryClient'

interface Letter {
  id: string
  letter_id: string
  letter_type: string
  response_type: string | null
  status: string
  priority: string
  incoming_number: string | null
  outgoing_number: string | null
  reference_number: string | null
  subject: string
  summary: string | null
  content: string | null
  authority_id: string | null
  contact_id: string | null
  topic_id: string
  subcategory_id: string | null
  parent_letter_id: string | null
  storage_path: string | null
  original_filename: string | null
  file_type: string | null
  file_size: number | null
  letter_date: string | null
  received_date: string | null
  due_date: string | null
  responded_date: string | null
  is_notification: number
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  authority_name?: string
  contact_name?: string
  topic_title?: string
  creator_name?: string
}

interface LetterFilters {
  topicId?: string
  status?: string
  letterType?: string
  authorityId?: string
  query?: string
  limit?: number
  offset?: number
}

interface PaginatedLetters {
  data: Letter[]
  total: number
  hasMore: boolean
}

// Get all letters with filters
export function useLettersQuery(filters?: LetterFilters) {
  return useQuery({
    queryKey: queryKeys.letters.list(filters || {}),
    queryFn: async (): Promise<PaginatedLetters> => {
      return window.electronAPI.letters.getAll(filters)
    }
  })
}

// Get single letter by ID
export function useLetterQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.letters.detail(id || ''),
    queryFn: async (): Promise<Letter | null> => {
      if (!id) return null
      return window.electronAPI.letters.getById(id)
    },
    enabled: !!id
  })
}

// Get letter drafts
export function useLetterDraftsQuery(letterId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.letters.drafts(letterId || ''),
    queryFn: async () => {
      if (!letterId) return []
      return window.electronAPI.letterDrafts.getByLetter(letterId)
    },
    enabled: !!letterId
  })
}

// Get letter attachments
export function useLetterAttachmentsQuery(letterId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.letters.attachments(letterId || ''),
    queryFn: async () => {
      if (!letterId) return []
      return window.electronAPI.letterAttachments.getByLetter(letterId)
    },
    enabled: !!letterId
  })
}

// Create letter mutation
export function useCreateLetterMutation() {
  return useMutation({
    mutationFn: async (data: Partial<Letter>) => {
      return window.electronAPI.letters.create(data)
    },
    onSuccess: () => {
      invalidateQueries.letters()
      invalidateQueries.dashboard()
    }
  })
}

// Update letter mutation
export function useUpdateLetterMutation() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Letter> }) => {
      return window.electronAPI.letters.update(id, data)
    },
    onSuccess: () => {
      invalidateQueries.letters()
    }
  })
}

// Delete letter mutation
export function useDeleteLetterMutation() {
  return useMutation({
    mutationFn: async (id: string) => {
      return window.electronAPI.letters.delete(id)
    },
    onSuccess: () => {
      invalidateQueries.letters()
      invalidateQueries.dashboard()
    }
  })
}
