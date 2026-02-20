import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys, invalidateQueries } from '../../lib/queryClient'

interface Topic {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  record_count?: number
  last_activity?: string
  creator_name?: string
}

interface TopicFilters {
  query?: string
  status?: string
  priority?: string
  limit?: number
  offset?: number
}

interface PaginatedTopics {
  data: Topic[]
  total: number
  hasMore: boolean
}

interface CreateTopicData {
  title: string
  description?: string
  status?: string
  priority?: string
}

interface UpdateTopicData {
  title?: string
  description?: string
  status?: string
  priority?: string
}

// Get all topics with filters
export function useTopicsQuery(filters?: TopicFilters) {
  return useQuery({
    queryKey: queryKeys.topics.list(filters || {}),
    queryFn: async (): Promise<PaginatedTopics> => {
      return window.electronAPI.topics.getAll(filters)
    }
  })
}

// Get single topic by ID
export function useTopicQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.topics.detail(id || ''),
    queryFn: async (): Promise<Topic | null> => {
      if (!id) return null
      return window.electronAPI.topics.getById(id)
    },
    enabled: !!id
  })
}

// Get topic stats
export function useTopicStatsQuery() {
  return useQuery({
    queryKey: queryKeys.topics.stats(),
    queryFn: async () => {
      return window.electronAPI.topics.getStats()
    }
  })
}

// Create topic mutation
export function useCreateTopicMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateTopicData) => {
      return window.electronAPI.topics.create(data)
    },
    onSuccess: () => {
      invalidateQueries.topics()
      invalidateQueries.dashboard()
    },
    // Optimistic update
    onMutate: async (newTopic) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.topics.lists() })

      const previousTopics = queryClient.getQueryData<PaginatedTopics>(
        queryKeys.topics.list({})
      )

      if (previousTopics) {
        const optimisticTopic: Topic = {
          id: `temp-${Date.now()}`,
          title: newTopic.title,
          description: newTopic.description || null,
          status: newTopic.status || 'active',
          priority: newTopic.priority || 'normal',
          created_by: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
          record_count: 0
        }

        queryClient.setQueryData<PaginatedTopics>(
          queryKeys.topics.list({}),
          {
            ...previousTopics,
            data: [optimisticTopic, ...previousTopics.data],
            total: previousTopics.total + 1
          }
        )
      }

      return { previousTopics }
    },
    onError: (_err, _newTopic, context) => {
      if (context?.previousTopics) {
        queryClient.setQueryData(
          queryKeys.topics.list({}),
          context.previousTopics
        )
      }
    }
  })
}

// Update topic mutation
export function useUpdateTopicMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTopicData }) => {
      return window.electronAPI.topics.update(id, data)
    },
    onSuccess: (_data, variables) => {
      invalidateQueries.topics()
      queryClient.invalidateQueries({
        queryKey: queryKeys.topics.detail(variables.id)
      })
      invalidateQueries.dashboard()
    }
  })
}

// Delete topic mutation
export function useDeleteTopicMutation() {
  return useMutation({
    mutationFn: async (id: string) => {
      return window.electronAPI.topics.delete(id)
    },
    onSuccess: () => {
      invalidateQueries.topics()
      invalidateQueries.records()
      invalidateQueries.dashboard()
    }
  })
}
