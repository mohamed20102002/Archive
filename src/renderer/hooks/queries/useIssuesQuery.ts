import { useQuery, useMutation } from '@tanstack/react-query'
import { queryKeys, invalidateQueries } from '../../lib/queryClient'

interface Issue {
  id: string
  title: string
  description: string | null
  topic_id: string | null
  subcategory_id: string | null
  importance: string
  status: string
  closure_note: string | null
  completed_at: string | null
  completed_by: string | null
  reminder_date: string | null
  reminder_notified: number
  linked_letter_id: string | null
  linked_email_id: string | null
  linked_record_id: string | null
  created_by: string
  created_at: string
  updated_at: string
  topic_title?: string
  creator_name?: string
  completer_name?: string
}

interface IssueHistory {
  id: string
  issue_id: string
  action: string
  field_name: string | null
  old_value: string | null
  new_value: string | null
  comment: string | null
  created_by: string
  created_at: string
  creator_name?: string
}

interface IssueFilters {
  topicId?: string
  status?: string
  importance?: string
  query?: string
  limit?: number
  offset?: number
}

interface PaginatedIssues {
  data: Issue[]
  total: number
  hasMore: boolean
}

// Get all issues with filters
export function useIssuesQuery(filters?: IssueFilters) {
  return useQuery({
    queryKey: queryKeys.issues.list(filters || {}),
    queryFn: async (): Promise<PaginatedIssues> => {
      return window.electronAPI.issues.getAll(filters)
    }
  })
}

// Get open issues
export function useOpenIssuesQuery() {
  return useQuery({
    queryKey: queryKeys.issues.open(),
    queryFn: async (): Promise<Issue[]> => {
      return window.electronAPI.issues.getOpen()
    }
  })
}

// Get single issue by ID
export function useIssueQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.issues.detail(id || ''),
    queryFn: async (): Promise<Issue | null> => {
      if (!id) return null
      return window.electronAPI.issues.getById(id)
    },
    enabled: !!id
  })
}

// Get issue history
export function useIssueHistoryQuery(issueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.issues.history(issueId || ''),
    queryFn: async (): Promise<IssueHistory[]> => {
      if (!issueId) return []
      return window.electronAPI.issues.getHistory(issueId)
    },
    enabled: !!issueId
  })
}

// Create issue mutation
export function useCreateIssueMutation() {
  return useMutation({
    mutationFn: async (data: Partial<Issue>) => {
      return window.electronAPI.issues.create(data)
    },
    onSuccess: () => {
      invalidateQueries.issues()
      invalidateQueries.dashboard()
    }
  })
}

// Update issue mutation
export function useUpdateIssueMutation() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Issue> }) => {
      return window.electronAPI.issues.update(id, data)
    },
    onSuccess: () => {
      invalidateQueries.issues()
    }
  })
}

// Add comment to issue mutation
export function useAddIssueCommentMutation() {
  return useMutation({
    mutationFn: async ({ issueId, comment }: { issueId: string; comment: string }) => {
      return window.electronAPI.issues.addComment(issueId, comment)
    },
    onSuccess: (_data, variables) => {
      invalidateQueries.issues()
    }
  })
}

// Close issue mutation
export function useCloseIssueMutation() {
  return useMutation({
    mutationFn: async ({ id, closureNote }: { id: string; closureNote?: string }) => {
      return window.electronAPI.issues.close(id, closureNote)
    },
    onSuccess: () => {
      invalidateQueries.issues()
      invalidateQueries.dashboard()
    }
  })
}

// Reopen issue mutation
export function useReopenIssueMutation() {
  return useMutation({
    mutationFn: async (id: string) => {
      return window.electronAPI.issues.reopen(id)
    },
    onSuccess: () => {
      invalidateQueries.issues()
      invalidateQueries.dashboard()
    }
  })
}

// Delete issue mutation
export function useDeleteIssueMutation() {
  return useMutation({
    mutationFn: async (id: string) => {
      return window.electronAPI.issues.delete(id)
    },
    onSuccess: () => {
      invalidateQueries.issues()
      invalidateQueries.dashboard()
    }
  })
}
