import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys, invalidateQueries } from '../../lib/queryClient'

interface Record {
  id: string
  topic_id: string
  subcategory_id: string | null
  type: string
  title: string
  content: string | null
  email_id: string | null
  linked_mom_id: string | null
  linked_letter_id: string | null
  record_date: string
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  creator_name?: string
  email_subject?: string
  subcategory_title?: string
  linked_moms?: { id: string; mom_id: string; title: string; deleted?: boolean }[]
  linked_letters?: { id: string; reference_number: string; subject: string; deleted?: boolean }[]
}

interface CreateRecordData {
  topic_id: string
  subcategory_id?: string
  type: string
  title: string
  content?: string
  email_id?: string
  linked_mom_id?: string
  linked_letter_id?: string
  record_date?: string
}

interface UpdateRecordData {
  title?: string
  content?: string
  type?: string
  subcategory_id?: string | null
  linked_mom_id?: string | null
  linked_letter_id?: string | null
  record_date?: string
}

interface RecordStats {
  total: number
  byType: globalThis.Record<string, number>
  recentRecords: Record[]
}

// Get records by topic
export function useRecordsByTopicQuery(topicId: string | undefined, subcategoryId?: string | null) {
  return useQuery({
    queryKey: queryKeys.records.list(topicId || '', { subcategoryId }),
    queryFn: async (): Promise<Record[]> => {
      if (!topicId) return []
      return window.electronAPI.records.getByTopic(topicId, subcategoryId)
    },
    enabled: !!topicId
  })
}

// Get single record by ID
export function useRecordQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.records.detail(id || ''),
    queryFn: async (): Promise<Record | null> => {
      if (!id) return null
      return window.electronAPI.records.getById(id)
    },
    enabled: !!id
  })
}

// Get record stats
export function useRecordStatsQuery(topicId?: string) {
  return useQuery({
    queryKey: queryKeys.records.stats(topicId),
    queryFn: async (): Promise<RecordStats> => {
      return window.electronAPI.records.getStats(topicId)
    }
  })
}

// Search records
export function useSearchRecordsQuery(query: string, topicId?: string) {
  return useQuery({
    queryKey: ['records', 'search', query, topicId],
    queryFn: async (): Promise<Record[]> => {
      return window.electronAPI.records.search(query, topicId)
    },
    enabled: query.length >= 2
  })
}

// Create record mutation
export function useCreateRecordMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateRecordData) => {
      return window.electronAPI.records.create(data)
    },
    onSuccess: (_data, variables) => {
      invalidateQueries.records(variables.topic_id)
      invalidateQueries.topics()
      invalidateQueries.dashboard()
    },
    // Optimistic update
    onMutate: async (newRecord) => {
      const queryKey = queryKeys.records.list(newRecord.topic_id, {})
      await queryClient.cancelQueries({ queryKey })

      const previousRecords = queryClient.getQueryData<Record[]>(queryKey)

      if (previousRecords) {
        const optimisticRecord: Record = {
          id: `temp-${Date.now()}`,
          topic_id: newRecord.topic_id,
          subcategory_id: newRecord.subcategory_id || null,
          type: newRecord.type,
          title: newRecord.title,
          content: newRecord.content || null,
          email_id: newRecord.email_id || null,
          linked_mom_id: newRecord.linked_mom_id || null,
          linked_letter_id: newRecord.linked_letter_id || null,
          record_date: newRecord.record_date || new Date().toISOString().split('T')[0],
          created_by: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null
        }

        queryClient.setQueryData<Record[]>(queryKey, [optimisticRecord, ...previousRecords])
      }

      return { previousRecords, queryKey }
    },
    onError: (_err, _newRecord, context) => {
      if (context?.previousRecords && context?.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousRecords)
      }
    }
  })
}

// Update record mutation
export function useUpdateRecordMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateRecordData }) => {
      return window.electronAPI.records.update(id, data)
    },
    onSuccess: async (_data, variables) => {
      // Get the record to find its topic_id
      const record = await window.electronAPI.records.getById(variables.id)
      if (record) {
        invalidateQueries.records(record.topic_id)
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.records.detail(variables.id)
      })
    }
  })
}

// Delete record mutation
export function useDeleteRecordMutation() {
  return useMutation({
    mutationFn: async (id: string) => {
      return window.electronAPI.records.delete(id)
    },
    onSuccess: () => {
      invalidateQueries.records()
      invalidateQueries.topics()
      invalidateQueries.dashboard()
    }
  })
}

// Link MOM to record mutation
export function useLinkMomToRecordMutation() {
  return useMutation({
    mutationFn: async ({ recordId, momId }: { recordId: string; momId: string }) => {
      return window.electronAPI.records.linkMom(recordId, momId)
    },
    onSuccess: () => {
      invalidateQueries.records()
    }
  })
}

// Link Letter to record mutation
export function useLinkLetterToRecordMutation() {
  return useMutation({
    mutationFn: async ({ recordId, letterId }: { recordId: string; letterId: string }) => {
      return window.electronAPI.records.linkLetter(recordId, letterId)
    },
    onSuccess: () => {
      invalidateQueries.records()
    }
  })
}
