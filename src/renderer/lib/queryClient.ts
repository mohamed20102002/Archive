import { QueryClient } from '@tanstack/react-query'

// Create a query client with optimized defaults for an Electron app
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: 5 minutes - data is considered fresh for this duration
      staleTime: 5 * 60 * 1000,

      // Cache time: 30 minutes - unused data stays in cache for this duration
      gcTime: 30 * 60 * 1000,

      // Retry failed queries up to 2 times
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),

      // Disable refetch on window focus for desktop app
      refetchOnWindowFocus: false,

      // Disable refetch on reconnect (we're offline-first)
      refetchOnReconnect: false,

      // Keep previous data while fetching new data
      placeholderData: (previousData: unknown) => previousData
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1
    }
  }
})

// Query key factories for type-safe and consistent cache keys
export const queryKeys = {
  // Topics
  topics: {
    all: ['topics'] as const,
    lists: () => [...queryKeys.topics.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.topics.lists(), filters] as const,
    details: () => [...queryKeys.topics.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.topics.details(), id] as const,
    stats: () => [...queryKeys.topics.all, 'stats'] as const
  },

  // Records
  records: {
    all: ['records'] as const,
    lists: () => [...queryKeys.records.all, 'list'] as const,
    list: (topicId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.records.lists(), topicId, filters] as const,
    details: () => [...queryKeys.records.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.records.details(), id] as const,
    byTopic: (topicId: string) => [...queryKeys.records.all, 'topic', topicId] as const,
    stats: (topicId?: string) => [...queryKeys.records.all, 'stats', topicId] as const
  },

  // Letters
  letters: {
    all: ['letters'] as const,
    lists: () => [...queryKeys.letters.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.letters.lists(), filters] as const,
    details: () => [...queryKeys.letters.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.letters.details(), id] as const,
    drafts: (letterId: string) => [...queryKeys.letters.all, 'drafts', letterId] as const,
    attachments: (letterId: string) => [...queryKeys.letters.all, 'attachments', letterId] as const
  },

  // MOMs
  moms: {
    all: ['moms'] as const,
    lists: () => [...queryKeys.moms.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.moms.lists(), filters] as const,
    details: () => [...queryKeys.moms.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.moms.details(), id] as const,
    actions: (momId: string) => [...queryKeys.moms.all, 'actions', momId] as const,
    drafts: (momId: string) => [...queryKeys.moms.all, 'drafts', momId] as const
  },

  // Issues
  issues: {
    all: ['issues'] as const,
    lists: () => [...queryKeys.issues.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.issues.lists(), filters] as const,
    details: () => [...queryKeys.issues.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.issues.details(), id] as const,
    history: (issueId: string) => [...queryKeys.issues.all, 'history', issueId] as const,
    open: () => [...queryKeys.issues.all, 'open'] as const
  },

  // Reminders
  reminders: {
    all: ['reminders'] as const,
    lists: () => [...queryKeys.reminders.all, 'list'] as const,
    upcoming: () => [...queryKeys.reminders.all, 'upcoming'] as const,
    overdue: () => [...queryKeys.reminders.all, 'overdue'] as const
  },

  // Search
  search: {
    all: ['search'] as const,
    global: (query: string) => [...queryKeys.search.all, 'global', query] as const,
    advanced: (filters: Record<string, unknown>) => [...queryKeys.search.all, 'advanced', filters] as const
  },

  // Users
  users: {
    all: ['users'] as const,
    list: () => [...queryKeys.users.all, 'list'] as const,
    current: () => [...queryKeys.users.all, 'current'] as const
  },

  // Settings
  settings: {
    all: ['settings'] as const
  },

  // Dashboard
  dashboard: {
    all: ['dashboard'] as const,
    stats: () => [...queryKeys.dashboard.all, 'stats'] as const
  },

  // Attendance
  attendance: {
    all: ['attendance'] as const,
    month: (year: number, month: number) => [...queryKeys.attendance.all, year, month] as const,
    conditions: () => [...queryKeys.attendance.all, 'conditions'] as const,
    shifts: () => [...queryKeys.attendance.all, 'shifts'] as const
  },

  // Authorities
  authorities: {
    all: ['authorities'] as const,
    list: () => [...queryKeys.authorities.all, 'list'] as const
  },

  // Contacts
  contacts: {
    all: ['contacts'] as const,
    list: () => [...queryKeys.contacts.all, 'list'] as const,
    byAuthority: (authorityId: string) => [...queryKeys.contacts.all, 'authority', authorityId] as const
  },

  // Tags
  tags: {
    all: ['tags'] as const,
    list: () => [...queryKeys.tags.all, 'list'] as const
  },

  // Secure Resources
  secureResources: {
    credentials: {
      all: ['credentials'] as const,
      list: () => [...queryKeys.secureResources.credentials.all, 'list'] as const
    },
    references: {
      all: ['secureReferences'] as const,
      list: () => [...queryKeys.secureResources.references.all, 'list'] as const
    }
  }
} as const

// Invalidation helpers
export const invalidateQueries = {
  topics: () => queryClient.invalidateQueries({ queryKey: queryKeys.topics.all }),
  records: (topicId?: string) => {
    if (topicId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.records.byTopic(topicId) })
    } else {
      queryClient.invalidateQueries({ queryKey: queryKeys.records.all })
    }
  },
  letters: () => queryClient.invalidateQueries({ queryKey: queryKeys.letters.all }),
  moms: () => queryClient.invalidateQueries({ queryKey: queryKeys.moms.all }),
  issues: () => queryClient.invalidateQueries({ queryKey: queryKeys.issues.all }),
  reminders: () => queryClient.invalidateQueries({ queryKey: queryKeys.reminders.all }),
  search: () => queryClient.invalidateQueries({ queryKey: queryKeys.search.all }),
  dashboard: () => queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
  all: () => queryClient.invalidateQueries()
}

export default queryClient
