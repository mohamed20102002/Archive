/**
 * Tag Cloud Component
 *
 * Displays tags in a cloud format with varying sizes based on usage count.
 * Supports filtering by clicking on tags.
 */

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface TagWithCount {
  id: string
  name: string
  color: string
  count: number
}

interface TagCloudProps {
  onTagClick?: (tagId: string, tagName: string) => void
  selectedTagIds?: string[]
  entityType?: 'all' | 'records' | 'letters' | 'issues'
  maxTags?: number
  className?: string
}

export function TagCloud({
  onTagClick,
  selectedTagIds = [],
  entityType = 'all',
  maxTags = 30,
  className = ''
}: TagCloudProps) {
  const { t } = useTranslation()
  const [tags, setTags] = useState<TagWithCount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTags()
  }, [entityType])

  async function loadTags() {
    setLoading(true)
    try {
      const allTags = await window.electronAPI.tags.getAll() as any[]

      // Get counts for each tag based on entity type
      const tagsWithCounts: TagWithCount[] = await Promise.all(
        allTags.map(async (tag: any) => {
          let count = 0

          if (entityType === 'all' || entityType === 'records') {
            const records = await window.electronAPI.tags.getRecordsByTag(tag.id)
            count += (records as any[]).length
          }
          if (entityType === 'all' || entityType === 'letters') {
            const letters = await window.electronAPI.tags.getLettersByTag(tag.id)
            count += (letters as any[]).length
          }
          if (entityType === 'all' || entityType === 'issues') {
            const issues = await window.electronAPI.tags.getIssuesByTag(tag.id)
            count += (issues as any[]).length
          }

          return {
            id: tag.id,
            name: tag.name,
            color: tag.color,
            count
          }
        })
      )

      // Sort by count and filter out tags with no items
      const sortedTags = tagsWithCounts
        .filter(t => t.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, maxTags)

      setTags(sortedTags)
    } catch (error) {
      console.error('Error loading tags:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate font size based on count
  const getTagSize = (count: number) => {
    if (tags.length === 0) return 'text-sm'

    const maxCount = Math.max(...tags.map(t => t.count))
    const minCount = Math.min(...tags.map(t => t.count))
    const range = maxCount - minCount || 1

    const normalized = (count - minCount) / range

    if (normalized >= 0.8) return 'text-xl font-semibold'
    if (normalized >= 0.6) return 'text-lg font-medium'
    if (normalized >= 0.4) return 'text-base'
    if (normalized >= 0.2) return 'text-sm'
    return 'text-xs'
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="animate-spin w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (tags.length === 0) {
    return (
      <div className={`text-center p-8 text-gray-500 dark:text-gray-400 ${className}`}>
        {t('tags.noTags', 'No tags found')}
      </div>
    )
  }

  return (
    <div className={`flex flex-wrap gap-3 p-4 ${className}`}>
      {tags.map(tag => {
        const isSelected = selectedTagIds.includes(tag.id)

        return (
          <button
            key={tag.id}
            onClick={() => onTagClick?.(tag.id, tag.name)}
            className={`
              ${getTagSize(tag.count)}
              px-3 py-1 rounded-full transition-all
              ${isSelected
                ? 'ring-2 ring-offset-2 ring-primary-500 dark:ring-offset-gray-800'
                : 'hover:scale-105'
              }
            `}
            style={{
              backgroundColor: `${tag.color}20`,
              color: tag.color,
              borderColor: tag.color,
              borderWidth: '1px'
            }}
            title={`${tag.name}: ${tag.count} item${tag.count !== 1 ? 's' : ''}`}
          >
            {tag.name}
            <span className="ml-1 opacity-60">({tag.count})</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Tag Statistics Component
 *
 * Shows tag usage statistics in a compact format
 */
export function TagStats() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<{
    totalTags: number
    totalUsage: number
    topTags: { name: string; count: number }[]
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    try {
      const allTags = await window.electronAPI.tags.getAll() as any[]

      let totalUsage = 0
      const tagCounts: { name: string; count: number }[] = []

      for (const tag of allTags) {
        const records = await window.electronAPI.tags.getRecordsByTag(tag.id) as any[]
        const letters = await window.electronAPI.tags.getLettersByTag(tag.id) as any[]
        const issues = await window.electronAPI.tags.getIssuesByTag(tag.id) as any[]

        const count = records.length + letters.length + issues.length
        totalUsage += count

        tagCounts.push({ name: tag.name, count })
      }

      const topTags = tagCounts
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      setStats({
        totalTags: allTags.length,
        totalUsage,
        topTags
      })
    } catch (error) {
      console.error('Error loading tag stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32" />
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400">{t('tags.totalTags', 'Total Tags')}:</span>
          <span className="ml-1 font-medium text-gray-900 dark:text-gray-100">{stats.totalTags}</span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">{t('tags.totalUsage', 'Total Usage')}:</span>
          <span className="ml-1 font-medium text-gray-900 dark:text-gray-100">{stats.totalUsage}</span>
        </div>
      </div>

      {stats.topTags.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('tags.topTags', 'Top Tags')}:</p>
          <div className="flex flex-wrap gap-1">
            {stats.topTags.map(tag => (
              <span
                key={tag.name}
                className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
              >
                {tag.name} ({tag.count})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default TagCloud
