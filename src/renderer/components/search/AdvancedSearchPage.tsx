import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SearchFiltersPanel } from './SearchFilters'
import { SavedSearches } from './SavedSearches'
import { SearchSuggestions } from './SearchSuggestions'
import { SearchHistory } from './SearchHistory'
import { HighlightedText } from './HighlightedText'
import { ExportButton } from '../common/ExportButton'
import { useAuth } from '../../context/AuthContext'
import { formatRelativeTime } from '../../utils/formatters'

interface SearchFilters {
  query: string
  types: string[]
  status: string[]
  dateFrom: string
  dateTo: string
  createdBy: string
  topicId: string
  tagIds: string[]
  importance: string
}

interface SearchResult {
  id: string
  type: string
  title: string
  description?: string
  status?: string
  date?: string
  creator_name?: string
  topic_id?: string
  topic_title?: string
}

const defaultFilters: SearchFilters = {
  query: '',
  types: [],
  status: [],
  dateFrom: '',
  dateTo: '',
  createdBy: '',
  topicId: '',
  tagIds: [],
  importance: ''
}

const typeIcons: Record<string, React.ReactNode> = {
  topic: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  record: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  letter: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  mom: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  issue: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  ),
  secure_reference: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}

const typeColors: Record<string, string> = {
  topic: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  record: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  letter: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  mom: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
  issue: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  secure_reference: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
}

export function AdvancedSearchPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters)
  const [results, setResults] = useState<SearchResult[]>([])
  const [searchTerms, setSearchTerms] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [page, setPage] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const pageSize = 20

  const handleSearch = async (resetPage = true) => {
    if (resetPage) setPage(0)
    setLoading(true)
    setHasSearched(true)
    setShowSuggestions(false)

    try {
      const searchFilters = {
        ...filters,
        types: filters.types.length > 0 ? filters.types : undefined,
        status: filters.status.length > 0 ? filters.status : undefined,
        tagIds: filters.tagIds.length > 0 ? filters.tagIds : undefined,
        limit: pageSize,
        offset: resetPage ? 0 : page * pageSize
      }

      const result = await window.electronAPI.advancedSearch.search(searchFilters, user?.id)
      setResults(result.results as SearchResult[])
      setTotal(result.total)
      setSearchTerms(result.searchTerms || [])
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setFilters(defaultFilters)
    setResults([])
    setTotal(0)
    setHasSearched(false)
    setPage(0)
  }

  const handleLoadSavedSearch = (savedFilters: any) => {
    setFilters({
      ...defaultFilters,
      ...savedFilters
    })
  }

  const handleResultClick = (result: SearchResult) => {
    // Build highlight state to pass to destination
    const highlightState = {
      highlightType: result.type,
      highlightId: result.id,
      highlightParentId: result.topic_id
    }

    switch (result.type) {
      case 'topic':
        navigate(`/topics/${result.id}`)
        break
      case 'record':
        if (result.topic_id) {
          navigate(`/topics/${result.topic_id}`, { state: highlightState })
        }
        break
      case 'letter':
        navigate('/letters', { state: highlightState })
        break
      case 'mom':
        navigate('/mom', { state: highlightState })
        break
      case 'issue':
        navigate('/issues', { state: highlightState })
        break
      case 'secure_reference':
        navigate('/secure-resources', { state: highlightState })
        break
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="p-6">
      <div className="flex gap-6">
        {/* Filters Sidebar */}
        <div className="w-80 flex-shrink-0">
          <div className="card p-4 sticky top-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('search.advancedSearch', 'Advanced Search')}
              </h2>
              <SearchFiltersPanel
                filters={filters}
                onChange={setFilters}
                onSearch={() => handleSearch(true)}
                onReset={handleReset}
              />
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <SavedSearches
                onLoadSearch={handleLoadSavedSearch}
                currentFilters={filters}
              />
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <SearchHistory
                onSelect={(query, savedFilters) => {
                  setFilters({ ...filters, query, ...(savedFilters || {}) } as SearchFilters)
                }}
                limit={5}
              />
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1">
          {/* Results Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              {hasSearched && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('search.resultsFound', '{{count}} result(s) found', { count: total })}
                </p>
              )}
            </div>
            {results.length > 0 && (
              <ExportButton exportType="searchResults" results={results} />
            )}
          </div>

          {/* Results List */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full" />
            </div>
          ) : !hasSearched ? (
            <div className="card p-12 text-center">
              <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                {t('search.searchYourArchive', 'Search Your Archive')}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {t('search.useFilters', 'Use the filters on the left to search across topics, records, letters, MOMs, and issues')}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {t('search.operatorTip', 'Tip: Use AND, OR, NOT operators or "quotes" for exact phrase matching')}
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="card p-12 text-center">
              <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                {t('search.noResults', 'No Results Found')}
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {t('search.tryAdjusting', 'Try adjusting your search criteria or filters')}
              </p>
            </div>
          ) : (
            <>
              <ul className="space-y-3">
                {results.map((result) => (
                  <li
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleResultClick(result)}
                    className="card p-4 hover:shadow-md cursor-pointer transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${typeColors[result.type]}`}>
                        {typeIcons[result.type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                            {result.type}
                          </span>
                          {result.status && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              result.status === 'open' || result.status === 'pending' || result.status === 'active'
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            }`}>
                              {result.status}
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          <HighlightedText
                            text={result.title}
                            searchTerms={searchTerms}
                            maxLength={100}
                          />
                        </h3>
                        {result.description && (
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                            <HighlightedText
                              text={result.description}
                              searchTerms={searchTerms}
                              maxLength={200}
                            />
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                          {result.topic_title && (
                            <span>{result.topic_title}</span>
                          )}
                          {result.creator_name && (
                            <span>{t('common.by', 'by')} {result.creator_name}</span>
                          )}
                          {result.date && (
                            <span>{formatRelativeTime(result.date)}</span>
                          )}
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button
                    onClick={() => {
                      setPage(p => p - 1)
                      handleSearch(false)
                    }}
                    disabled={page === 0}
                    className="btn btn-secondary btn-sm"
                  >
                    {t('common.previous', 'Previous')}
                  </button>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {t('common.pageOf', 'Page {{current}} of {{total}}', { current: page + 1, total: totalPages })}
                  </span>
                  <button
                    onClick={() => {
                      setPage(p => p + 1)
                      handleSearch(false)
                    }}
                    disabled={page >= totalPages - 1}
                    className="btn btn-secondary btn-sm"
                  >
                    {t('common.next', 'Next')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
