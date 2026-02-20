import { getDatabase } from '../database/connection'
import {
  parseAdvancedQuery,
  escapeFts5Query as escapeFts5QueryEnhanced,
  recordSearchHistory,
  highlightMatches,
  HighlightedText
} from './search-enhanced.service'

// Re-export enhanced search utilities
export {
  parseAdvancedQuery,
  highlightMatches,
  getSearchSuggestions,
  getSearchHistory,
  clearSearchHistory,
  deleteSearchHistoryEntry,
  rebuildFtsIndexes,
  getFtsStats
} from './search-enhanced.service'

export type { SearchSuggestion, SearchHistoryEntry, HighlightedText } from './search-enhanced.service'

export interface SearchResult {
  id: string
  type: 'topic' | 'record' | 'letter' | 'mom' | 'mom_action' | 'issue' | 'credential' | 'secure_reference' | 'contact' | 'authority'
  title: string
  subtitle?: string
  description?: string
  date?: string
  status?: string
  parentId?: string
  parentTitle?: string
}

// Query result cache for performance optimization
interface CacheEntry<T> {
  data: T
  timestamp: number
}

const queryCache = new Map<string, CacheEntry<any>>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCached<T>(key: string): T | null {
  const entry = queryCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    queryCache.delete(key)
    return null
  }
  return entry.data
}

function setCache<T>(key: string, data: T): void {
  queryCache.set(key, { data, timestamp: Date.now() })
}

export function clearSearchCache(): void {
  queryCache.clear()
}

// Escape special FTS5 characters for safe search (uses enhanced version)
function escapeFts5Query(query: string): string {
  return escapeFts5QueryEnhanced(query)
}

// Parse advanced query with operators (AND, OR, NOT, quotes)
function getAdvancedFtsQuery(query: string): { ftsQuery: string; terms: string[] } {
  const parsed = parseAdvancedQuery(query)
  return { ftsQuery: parsed.ftsQuery, terms: parsed.terms }
}

export interface GlobalSearchResults {
  topics: SearchResult[]
  records: SearchResult[]
  letters: SearchResult[]
  moms: SearchResult[]
  momActions: SearchResult[]
  issues: SearchResult[]
  credentials: SearchResult[]
  secureReferences: SearchResult[]
  contacts: SearchResult[]
  authorities: SearchResult[]
  totalCount: number
}

export function globalSearch(query: string, limit: number = 10): GlobalSearchResults {
  const db = getDatabase()

  const results: GlobalSearchResults = {
    topics: [],
    records: [],
    letters: [],
    moms: [],
    momActions: [],
    issues: [],
    credentials: [],
    secureReferences: [],
    contacts: [],
    authorities: [],
    totalCount: 0
  }

  if (!query || query.trim().length < 2) {
    return results
  }

  // Check cache first
  const cacheKey = `global:${query}:${limit}`
  const cached = getCached<GlobalSearchResults>(cacheKey)
  if (cached) return cached

  // Limit query length to prevent DoS attacks
  const safeQuery = query.trim().substring(0, 200)
  const ftsQuery = escapeFts5Query(safeQuery)
  const likeSearchTerm = `%${safeQuery}%` // Fallback for non-FTS tables

  // Search Topics using FTS5
  let topics: any[] = []
  if (ftsQuery) {
    try {
      topics = db.prepare(`
        SELECT t.id, t.title, t.description, t.status, t.priority, t.created_at
        FROM topics t
        WHERE t.deleted_at IS NULL
          AND t.rowid IN (SELECT rowid FROM topics_fts WHERE topics_fts MATCH ?)
        ORDER BY t.updated_at DESC
        LIMIT ?
      `).all(ftsQuery, limit) as any[]
    } catch (e) {
      // Fallback to LIKE if FTS fails
      topics = db.prepare(`
        SELECT id, title, description, status, priority, created_at
        FROM topics
        WHERE deleted_at IS NULL
          AND (title LIKE ? OR description LIKE ?)
        ORDER BY updated_at DESC
        LIMIT ?
      `).all(likeSearchTerm, likeSearchTerm, limit) as any[]
    }
  }

  results.topics = topics.map(t => ({
    id: t.id,
    type: 'topic' as const,
    title: t.title,
    description: t.description,
    status: t.status,
    date: t.created_at
  }))

  // Search Records using FTS5 (including attachment filenames via LIKE fallback)
  let records: any[] = []
  if (ftsQuery) {
    try {
      // First try FTS5 for title/content
      const ftsRecords = db.prepare(`
        SELECT DISTINCT r.id, r.title, r.content, r.type, r.created_at, r.topic_id, t.title as topic_title
        FROM records r
        LEFT JOIN topics t ON r.topic_id = t.id
        WHERE r.deleted_at IS NULL
          AND r.rowid IN (SELECT rowid FROM records_fts WHERE records_fts MATCH ?)
        ORDER BY r.updated_at DESC
        LIMIT ?
      `).all(ftsQuery, limit) as any[]

      // Also search attachment filenames (no FTS for this)
      const attachmentRecords = db.prepare(`
        SELECT DISTINCT r.id, r.title, r.content, r.type, r.created_at, r.topic_id, t.title as topic_title
        FROM records r
        LEFT JOIN topics t ON r.topic_id = t.id
        JOIN record_attachments ra ON r.id = ra.record_id
        WHERE r.deleted_at IS NULL
          AND ra.filename LIKE ?
        ORDER BY r.updated_at DESC
        LIMIT ?
      `).all(likeSearchTerm, limit) as any[]

      // Merge and deduplicate
      const seen = new Set<string>()
      for (const r of [...ftsRecords, ...attachmentRecords]) {
        if (!seen.has(r.id)) {
          seen.add(r.id)
          records.push(r)
          if (records.length >= limit) break
        }
      }
    } catch (e) {
      // Fallback to LIKE if FTS fails
      records = db.prepare(`
        SELECT DISTINCT r.id, r.title, r.content, r.type, r.created_at, r.topic_id, t.title as topic_title
        FROM records r
        LEFT JOIN topics t ON r.topic_id = t.id
        LEFT JOIN record_attachments ra ON r.id = ra.record_id
        WHERE r.deleted_at IS NULL
          AND (r.title LIKE ? OR r.content LIKE ? OR ra.filename LIKE ?)
        ORDER BY r.updated_at DESC
        LIMIT ?
      `).all(likeSearchTerm, likeSearchTerm, likeSearchTerm, limit) as any[]
    }
  }

  results.records = records.map(r => ({
    id: r.id,
    type: 'record' as const,
    title: r.title,
    subtitle: r.type,
    description: r.content?.substring(0, 100),
    date: r.created_at,
    parentId: r.topic_id,
    parentTitle: r.topic_title
  }))

  // Search Letters using FTS5 (including attachment filenames via LIKE fallback)
  let letters: any[] = []
  if (ftsQuery) {
    try {
      // First try FTS5 for subject/summary/content/reference numbers
      const ftsLetters = db.prepare(`
        SELECT DISTINCT l.id, l.reference_number, l.subject, l.summary, l.letter_type, l.status, l.letter_date,
               a.name as authority_name
        FROM letters l
        LEFT JOIN authorities a ON l.authority_id = a.id
        WHERE l.deleted_at IS NULL
          AND l.rowid IN (SELECT rowid FROM letters_fts WHERE letters_fts MATCH ?)
        ORDER BY l.updated_at DESC
        LIMIT ?
      `).all(ftsQuery, limit) as any[]

      // Also search attachment filenames (no FTS for this)
      const attachmentLetters = db.prepare(`
        SELECT DISTINCT l.id, l.reference_number, l.subject, l.summary, l.letter_type, l.status, l.letter_date,
               a.name as authority_name
        FROM letters l
        LEFT JOIN authorities a ON l.authority_id = a.id
        JOIN letter_attachments la ON l.id = la.letter_id AND la.deleted_at IS NULL
        WHERE l.deleted_at IS NULL
          AND (l.original_filename LIKE ? OR la.filename LIKE ?)
        ORDER BY l.updated_at DESC
        LIMIT ?
      `).all(likeSearchTerm, likeSearchTerm, limit) as any[]

      // Merge and deduplicate
      const seen = new Set<string>()
      for (const l of [...ftsLetters, ...attachmentLetters]) {
        if (!seen.has(l.id)) {
          seen.add(l.id)
          letters.push(l)
          if (letters.length >= limit) break
        }
      }
    } catch (e) {
      // Fallback to LIKE if FTS fails
      letters = db.prepare(`
        SELECT DISTINCT l.id, l.reference_number, l.subject, l.summary, l.letter_type, l.status, l.letter_date,
               a.name as authority_name
        FROM letters l
        LEFT JOIN authorities a ON l.authority_id = a.id
        LEFT JOIN letter_attachments la ON l.id = la.letter_id AND la.deleted_at IS NULL
        WHERE l.deleted_at IS NULL
          AND (l.reference_number LIKE ? OR l.subject LIKE ? OR l.summary LIKE ? OR l.original_filename LIKE ? OR la.filename LIKE ?)
        ORDER BY l.updated_at DESC
        LIMIT ?
      `).all(likeSearchTerm, likeSearchTerm, likeSearchTerm, likeSearchTerm, likeSearchTerm, limit) as any[]
    }
  }

  results.letters = letters.map(l => ({
    id: l.id,
    type: 'letter' as const,
    title: l.reference_number || l.subject,
    subtitle: `${l.letter_type} - ${l.authority_name || 'Unknown'}`,
    description: l.summary?.substring(0, 100),
    status: l.status,
    date: l.letter_date
  }))

  // Search MOMs using FTS5 (including draft filenames via LIKE fallback)
  let moms: any[] = []
  if (ftsQuery) {
    try {
      // First try FTS5 for mom_id/title/subject
      const ftsMoms = db.prepare(`
        SELECT DISTINCT m.id, m.mom_id, m.title, m.subject, m.status, m.meeting_date,
               ml.name as location_name
        FROM moms m
        LEFT JOIN mom_locations ml ON m.location_id = ml.id
        WHERE m.deleted_at IS NULL
          AND m.rowid IN (SELECT rowid FROM moms_fts WHERE moms_fts MATCH ?)
        ORDER BY m.updated_at DESC
        LIMIT ?
      `).all(ftsQuery, limit) as any[]

      // Also search draft filenames and main file (no FTS for this)
      const draftMoms = db.prepare(`
        SELECT DISTINCT m.id, m.mom_id, m.title, m.subject, m.status, m.meeting_date,
               ml.name as location_name
        FROM moms m
        LEFT JOIN mom_locations ml ON m.location_id = ml.id
        LEFT JOIN mom_drafts md ON m.id = md.mom_internal_id AND md.deleted_at IS NULL
        WHERE m.deleted_at IS NULL
          AND (m.original_filename LIKE ? OR md.original_filename LIKE ?)
        ORDER BY m.updated_at DESC
        LIMIT ?
      `).all(likeSearchTerm, likeSearchTerm, limit) as any[]

      // Merge and deduplicate
      const seen = new Set<string>()
      for (const m of [...ftsMoms, ...draftMoms]) {
        if (!seen.has(m.id)) {
          seen.add(m.id)
          moms.push(m)
          if (moms.length >= limit) break
        }
      }
    } catch (e) {
      // Fallback to LIKE if FTS fails
      moms = db.prepare(`
        SELECT DISTINCT m.id, m.mom_id, m.title, m.subject, m.status, m.meeting_date,
               ml.name as location_name
        FROM moms m
        LEFT JOIN mom_locations ml ON m.location_id = ml.id
        LEFT JOIN mom_drafts md ON m.id = md.mom_internal_id AND md.deleted_at IS NULL
        WHERE m.deleted_at IS NULL
          AND (m.mom_id LIKE ? OR m.title LIKE ? OR m.subject LIKE ? OR m.original_filename LIKE ? OR md.original_filename LIKE ?)
        ORDER BY m.updated_at DESC
        LIMIT ?
      `).all(likeSearchTerm, likeSearchTerm, likeSearchTerm, likeSearchTerm, likeSearchTerm, limit) as any[]
    }
  }

  results.moms = moms.map(m => ({
    id: m.id,
    type: 'mom' as const,
    title: m.mom_id,
    subtitle: m.title,
    description: m.subject?.substring(0, 100),
    status: m.status,
    date: m.meeting_date
  }))

  // Search MOM Actions (no FTS table, use LIKE)
  const momActions = db.prepare(`
    SELECT ma.id, ma.description, ma.responsible_party, ma.status, ma.deadline,
           m.mom_id, m.id as mom_internal_id
    FROM mom_actions ma
    JOIN moms m ON ma.mom_internal_id = m.id
    WHERE m.deleted_at IS NULL
      AND (ma.description LIKE ? OR ma.responsible_party LIKE ?)
    ORDER BY ma.updated_at DESC
    LIMIT ?
  `).all(likeSearchTerm, likeSearchTerm, limit) as any[]

  results.momActions = momActions.map(a => ({
    id: a.id,
    type: 'mom_action' as const,
    title: a.description?.substring(0, 80) || 'Action',
    subtitle: `Assigned to: ${a.responsible_party || 'Unassigned'}`,
    status: a.status,
    date: a.deadline,
    parentId: a.mom_internal_id,
    parentTitle: a.mom_id
  }))

  // Search Issues (no FTS table, use LIKE)
  const issues = db.prepare(`
    SELECT i.id, i.title, i.description, i.status, i.importance, i.created_at,
           t.title as topic_title
    FROM issues i
    LEFT JOIN topics t ON i.topic_id = t.id
    WHERE (i.title LIKE ? OR i.description LIKE ?)
    ORDER BY i.updated_at DESC
    LIMIT ?
  `).all(likeSearchTerm, likeSearchTerm, limit) as any[]

  results.issues = issues.map(i => ({
    id: i.id,
    type: 'issue' as const,
    title: i.title,
    subtitle: i.importance,
    description: i.description?.substring(0, 100),
    status: i.status,
    date: i.created_at,
    parentTitle: i.topic_title
  }))

  // Search Credentials (system names only, not passwords - no FTS)
  const credentials = db.prepare(`
    SELECT id, system_name, username, category, description, created_at
    FROM credentials
    WHERE deleted_at IS NULL
      AND (system_name LIKE ? OR username LIKE ? OR description LIKE ? OR category LIKE ?)
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(likeSearchTerm, likeSearchTerm, likeSearchTerm, likeSearchTerm, limit) as any[]

  results.credentials = credentials.map(c => ({
    id: c.id,
    type: 'credential' as const,
    title: c.system_name,
    subtitle: `${c.category} - ${c.username}`,
    description: c.description?.substring(0, 100),
    date: c.created_at
  }))

  // Search Secure References (including attachment filenames - no FTS)
  const secureRefs = db.prepare(`
    SELECT DISTINCT sr.id, sr.name, sr.description, sr.category, sr.created_at
    FROM secure_references sr
    LEFT JOIN secure_reference_files srf ON sr.id = srf.reference_id
    WHERE sr.deleted_at IS NULL
      AND (sr.name LIKE ? OR sr.description LIKE ? OR sr.category LIKE ? OR srf.filename LIKE ?)
    ORDER BY sr.updated_at DESC
    LIMIT ?
  `).all(likeSearchTerm, likeSearchTerm, likeSearchTerm, likeSearchTerm, limit) as any[]

  results.secureReferences = secureRefs.map(r => ({
    id: r.id,
    type: 'secure_reference' as const,
    title: r.name,
    subtitle: r.category,
    description: r.description?.substring(0, 100),
    date: r.created_at
  }))

  // Search Contacts (no FTS)
  const contacts = db.prepare(`
    SELECT c.id, c.name, c.title, c.email, c.phone,
           a.name as authority_name
    FROM contacts c
    LEFT JOIN authorities a ON c.authority_id = a.id
    WHERE c.deleted_at IS NULL
      AND (c.name LIKE ? OR c.title LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)
    ORDER BY c.updated_at DESC
    LIMIT ?
  `).all(likeSearchTerm, likeSearchTerm, likeSearchTerm, likeSearchTerm, limit) as any[]

  results.contacts = contacts.map(c => ({
    id: c.id,
    type: 'contact' as const,
    title: c.name,
    subtitle: c.title,
    description: c.email || c.phone,
    parentTitle: c.authority_name
  }))

  // Search Authorities (no FTS)
  const authorities = db.prepare(`
    SELECT id, name, short_name, type, contact_email
    FROM authorities
    WHERE deleted_at IS NULL
      AND (name LIKE ? OR short_name LIKE ? OR contact_email LIKE ?)
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(likeSearchTerm, likeSearchTerm, likeSearchTerm, limit) as any[]

  results.authorities = authorities.map(a => ({
    id: a.id,
    type: 'authority' as const,
    title: a.name,
    subtitle: a.short_name,
    description: a.contact_email
  }))

  // Calculate total count
  results.totalCount =
    results.topics.length +
    results.records.length +
    results.letters.length +
    results.moms.length +
    results.momActions.length +
    results.issues.length +
    results.credentials.length +
    results.secureReferences.length +
    results.contacts.length +
    results.authorities.length

  // Cache the results
  setCache(cacheKey, results)

  return results
}

// ===== Advanced Search =====

export interface AdvancedSearchFilters {
  query?: string
  types?: ('topic' | 'record' | 'letter' | 'mom' | 'issue' | 'secure_reference')[]
  status?: string[]
  dateFrom?: string
  dateTo?: string
  createdBy?: string
  topicId?: string
  tagIds?: string[]
  importance?: string
  limit?: number
  offset?: number
}

export interface AdvancedSearchResult {
  id: string
  type: string
  title: string
  description?: string
  status?: string
  date?: string
  created_by?: string
  creator_name?: string
  topic_id?: string
  topic_title?: string
  tags?: { id: string; name: string; color: string }[]
}

export interface AdvancedSearchResponse {
  results: AdvancedSearchResult[]
  total: number
  offset: number
  limit: number
  searchTerms?: string[] // Terms for highlighting
}

export function advancedSearch(filters: AdvancedSearchFilters, userId?: string): AdvancedSearchResponse {
  const db = getDatabase()
  const results: AdvancedSearchResult[] = []
  const limit = filters.limit || 50
  const offset = filters.offset || 0
  // Limit query length to prevent DoS attacks
  const safeQuery = filters.query ? filters.query.trim().substring(0, 200) : null

  // Use advanced query parsing for AND, OR, NOT support
  const { ftsQuery, terms: searchTerms } = safeQuery
    ? getAdvancedFtsQuery(safeQuery)
    : { ftsQuery: null, terms: [] }
  const likeSearchTerm = safeQuery ? `%${safeQuery}%` : null

  // Types that support tag filtering
  const tagSupportedTypes = ['record', 'letter', 'mom', 'issue']

  let types = filters.types && filters.types.length > 0
    ? filters.types
    : ['topic', 'record', 'letter', 'mom', 'issue', 'secure_reference']

  // When tag filter is active but no types specified, only search tag-supported types
  if (filters.tagIds && filters.tagIds.length > 0 && (!filters.types || filters.types.length === 0)) {
    types = tagSupportedTypes
  }

  console.log('[Search] advancedSearch called with:', JSON.stringify(filters))
  console.log('[Search] Parsed FTS query:', ftsQuery, 'Terms:', searchTerms)

  // Search Topics using FTS5
  if (types.includes('topic')) {
    let query = `
      SELECT t.id, 'topic' as type, t.title, t.description, t.status, t.created_at as date,
             t.created_by, u.display_name as creator_name
      FROM topics t
      LEFT JOIN users u ON u.id = t.created_by
      WHERE t.deleted_at IS NULL
    `
    const params: any[] = []

    if (ftsQuery) {
      // Use FTS5 for text search
      query += ' AND t.rowid IN (SELECT rowid FROM topics_fts WHERE topics_fts MATCH ?)'
      params.push(ftsQuery)
    }
    if (filters.status && filters.status.length > 0) {
      query += ` AND t.status IN (${filters.status.map(() => '?').join(',')})`
      params.push(...filters.status)
    }
    if (filters.dateFrom) {
      query += ' AND date(t.created_at) >= ?'
      params.push(filters.dateFrom)
    }
    if (filters.dateTo) {
      query += ' AND date(t.created_at) <= ?'
      params.push(filters.dateTo)
    }
    if (filters.createdBy) {
      query += ' AND t.created_by = ?'
      params.push(filters.createdBy)
    }

    query += ' ORDER BY t.created_at DESC'

    try {
      const topics = db.prepare(query).all(...params) as AdvancedSearchResult[]
      results.push(...topics)
    } catch (e) {
      // Fallback to LIKE if FTS fails
      let fallbackQuery = `
        SELECT t.id, 'topic' as type, t.title, t.description, t.status, t.created_at as date,
               t.created_by, u.display_name as creator_name
        FROM topics t
        LEFT JOIN users u ON u.id = t.created_by
        WHERE t.deleted_at IS NULL
      `
      const fallbackParams: any[] = []
      if (likeSearchTerm) {
        fallbackQuery += ' AND (t.title LIKE ? OR t.description LIKE ?)'
        fallbackParams.push(likeSearchTerm, likeSearchTerm)
      }
      if (filters.status && filters.status.length > 0) {
        fallbackQuery += ` AND t.status IN (${filters.status.map(() => '?').join(',')})`
        fallbackParams.push(...filters.status)
      }
      if (filters.dateFrom) {
        fallbackQuery += ' AND date(t.created_at) >= ?'
        fallbackParams.push(filters.dateFrom)
      }
      if (filters.dateTo) {
        fallbackQuery += ' AND date(t.created_at) <= ?'
        fallbackParams.push(filters.dateTo)
      }
      if (filters.createdBy) {
        fallbackQuery += ' AND t.created_by = ?'
        fallbackParams.push(filters.createdBy)
      }
      fallbackQuery += ' ORDER BY t.created_at DESC'
      const topics = db.prepare(fallbackQuery).all(...fallbackParams) as AdvancedSearchResult[]
      results.push(...topics)
    }
  }

  // Search Records using FTS5 (including attachment filenames)
  if (types.includes('record')) {
    try {
      let query = `
        SELECT DISTINCT r.id, 'record' as type, r.title, r.content as description, NULL as status,
               r.created_at as date, r.created_by, u.display_name as creator_name,
               r.topic_id, t.title as topic_title
        FROM records r
        LEFT JOIN users u ON u.id = r.created_by
        LEFT JOIN topics t ON t.id = r.topic_id
        WHERE r.deleted_at IS NULL
      `
      const params: any[] = []

      if (ftsQuery) {
        // Use FTS5 for text search, also check attachment filenames with LIKE
        query += ` AND (r.rowid IN (SELECT rowid FROM records_fts WHERE records_fts MATCH ?)
                  OR EXISTS (SELECT 1 FROM record_attachments ra WHERE ra.record_id = r.id AND ra.filename LIKE ?))`
        params.push(ftsQuery, likeSearchTerm)
      }
      if (filters.topicId) {
        query += ' AND r.topic_id = ?'
        params.push(filters.topicId)
      }
      if (filters.dateFrom) {
        query += ' AND date(r.created_at) >= ?'
        params.push(filters.dateFrom)
      }
      if (filters.dateTo) {
        query += ' AND date(r.created_at) <= ?'
        params.push(filters.dateTo)
      }
      if (filters.createdBy) {
        query += ' AND r.created_by = ?'
        params.push(filters.createdBy)
      }
      if (filters.tagIds && filters.tagIds.length > 0) {
        query += ` AND EXISTS (
          SELECT 1 FROM record_tags rt
          WHERE rt.record_id = r.id AND rt.tag_id IN (${filters.tagIds.map(() => '?').join(',')})
        )`
        params.push(...filters.tagIds)
      }

      query += ' ORDER BY r.created_at DESC'

      const records = db.prepare(query).all(...params) as AdvancedSearchResult[]
      console.log('[Search] Records found:', records.length)
      results.push(...records)
    } catch (err) {
      console.error('[Search] Error searching records:', err)
      // Fallback to LIKE
      try {
        let fallbackQuery = `
          SELECT DISTINCT r.id, 'record' as type, r.title, r.content as description, NULL as status,
                 r.created_at as date, r.created_by, u.display_name as creator_name,
                 r.topic_id, t.title as topic_title
          FROM records r
          LEFT JOIN users u ON u.id = r.created_by
          LEFT JOIN topics t ON t.id = r.topic_id
          LEFT JOIN record_attachments ra ON r.id = ra.record_id
          WHERE r.deleted_at IS NULL
        `
        const fallbackParams: any[] = []
        if (likeSearchTerm) {
          fallbackQuery += ' AND (r.title LIKE ? OR r.content LIKE ? OR ra.filename LIKE ?)'
          fallbackParams.push(likeSearchTerm, likeSearchTerm, likeSearchTerm)
        }
        if (filters.topicId) {
          fallbackQuery += ' AND r.topic_id = ?'
          fallbackParams.push(filters.topicId)
        }
        if (filters.dateFrom) {
          fallbackQuery += ' AND date(r.created_at) >= ?'
          fallbackParams.push(filters.dateFrom)
        }
        if (filters.dateTo) {
          fallbackQuery += ' AND date(r.created_at) <= ?'
          fallbackParams.push(filters.dateTo)
        }
        if (filters.createdBy) {
          fallbackQuery += ' AND r.created_by = ?'
          fallbackParams.push(filters.createdBy)
        }
        if (filters.tagIds && filters.tagIds.length > 0) {
          fallbackQuery += ` AND EXISTS (
            SELECT 1 FROM record_tags rt
            WHERE rt.record_id = r.id AND rt.tag_id IN (${filters.tagIds.map(() => '?').join(',')})
          )`
          fallbackParams.push(...filters.tagIds)
        }
        fallbackQuery += ' ORDER BY r.created_at DESC'
        const records = db.prepare(fallbackQuery).all(...fallbackParams) as AdvancedSearchResult[]
        results.push(...records)
      } catch (fallbackErr) {
        console.error('[Search] Fallback error searching records:', fallbackErr)
      }
    }
  }

  // Search Letters using FTS5 (including attachment filenames)
  if (types.includes('letter')) {
    try {
      let query = `
        SELECT DISTINCT l.id, 'letter' as type, l.subject as title, l.summary as description, l.status,
               l.created_at as date, l.created_by, u.display_name as creator_name,
               l.topic_id, t.title as topic_title
        FROM letters l
        LEFT JOIN users u ON u.id = l.created_by
        LEFT JOIN topics t ON t.id = l.topic_id
        WHERE l.deleted_at IS NULL
      `
      const params: any[] = []

      if (ftsQuery) {
        // Use FTS5 for text search, also check attachment filenames with LIKE
        query += ` AND (l.rowid IN (SELECT rowid FROM letters_fts WHERE letters_fts MATCH ?)
                  OR l.original_filename LIKE ?
                  OR EXISTS (SELECT 1 FROM letter_attachments la WHERE la.letter_id = l.id AND la.deleted_at IS NULL AND la.filename LIKE ?))`
        params.push(ftsQuery, likeSearchTerm, likeSearchTerm)
      }
      if (filters.status && filters.status.length > 0) {
        query += ` AND l.status IN (${filters.status.map(() => '?').join(',')})`
        params.push(...filters.status)
      }
      if (filters.topicId) {
        query += ' AND l.topic_id = ?'
        params.push(filters.topicId)
      }
      if (filters.dateFrom) {
        query += ' AND date(l.created_at) >= ?'
        params.push(filters.dateFrom)
      }
      if (filters.dateTo) {
        query += ' AND date(l.created_at) <= ?'
        params.push(filters.dateTo)
      }
      if (filters.createdBy) {
        query += ' AND l.created_by = ?'
        params.push(filters.createdBy)
      }
      if (filters.tagIds && filters.tagIds.length > 0) {
        query += ` AND EXISTS (
          SELECT 1 FROM letter_tags lt
          WHERE lt.letter_id = l.id AND lt.tag_id IN (${filters.tagIds.map(() => '?').join(',')})
        )`
        params.push(...filters.tagIds)
      }

      query += ' ORDER BY l.created_at DESC'

      const letters = db.prepare(query).all(...params) as AdvancedSearchResult[]
      console.log('[Search] Letters found:', letters.length)
      results.push(...letters)
    } catch (err) {
      console.error('[Search] Error searching letters:', err)
      // Fallback to LIKE
      try {
        let fallbackQuery = `
          SELECT DISTINCT l.id, 'letter' as type, l.subject as title, l.summary as description, l.status,
                 l.created_at as date, l.created_by, u.display_name as creator_name,
                 l.topic_id, t.title as topic_title
          FROM letters l
          LEFT JOIN users u ON u.id = l.created_by
          LEFT JOIN topics t ON t.id = l.topic_id
          LEFT JOIN letter_attachments la ON l.id = la.letter_id AND la.deleted_at IS NULL
          WHERE l.deleted_at IS NULL
        `
        const fallbackParams: any[] = []
        if (likeSearchTerm) {
          fallbackQuery += ' AND (l.subject LIKE ? OR l.summary LIKE ? OR l.reference_number LIKE ? OR l.original_filename LIKE ? OR la.filename LIKE ?)'
          fallbackParams.push(likeSearchTerm, likeSearchTerm, likeSearchTerm, likeSearchTerm, likeSearchTerm)
        }
        if (filters.status && filters.status.length > 0) {
          fallbackQuery += ` AND l.status IN (${filters.status.map(() => '?').join(',')})`
          fallbackParams.push(...filters.status)
        }
        if (filters.topicId) {
          fallbackQuery += ' AND l.topic_id = ?'
          fallbackParams.push(filters.topicId)
        }
        if (filters.dateFrom) {
          fallbackQuery += ' AND date(l.created_at) >= ?'
          fallbackParams.push(filters.dateFrom)
        }
        if (filters.dateTo) {
          fallbackQuery += ' AND date(l.created_at) <= ?'
          fallbackParams.push(filters.dateTo)
        }
        if (filters.createdBy) {
          fallbackQuery += ' AND l.created_by = ?'
          fallbackParams.push(filters.createdBy)
        }
        if (filters.tagIds && filters.tagIds.length > 0) {
          fallbackQuery += ` AND EXISTS (
            SELECT 1 FROM letter_tags lt
            WHERE lt.letter_id = l.id AND lt.tag_id IN (${filters.tagIds.map(() => '?').join(',')})
          )`
          fallbackParams.push(...filters.tagIds)
        }
        fallbackQuery += ' ORDER BY l.created_at DESC'
        const letters = db.prepare(fallbackQuery).all(...fallbackParams) as AdvancedSearchResult[]
        results.push(...letters)
      } catch (fallbackErr) {
        console.error('[Search] Fallback error searching letters:', fallbackErr)
      }
    }
  }

  // Search MOMs using FTS5 (including attachment filenames)
  if (types.includes('mom')) {
    try {
      let query = `
        SELECT DISTINCT m.id, 'mom' as type, m.title, m.subject as description, m.status,
               m.created_at as date, m.created_by, u.display_name as creator_name
        FROM moms m
        LEFT JOIN users u ON u.id = m.created_by
        WHERE m.deleted_at IS NULL
      `
      const params: any[] = []

      if (ftsQuery) {
        // Use FTS5 for text search, also check filenames with LIKE
        query += ` AND (m.rowid IN (SELECT rowid FROM moms_fts WHERE moms_fts MATCH ?)
                  OR m.original_filename LIKE ?
                  OR EXISTS (SELECT 1 FROM mom_drafts md WHERE md.mom_internal_id = m.id AND md.deleted_at IS NULL AND md.original_filename LIKE ?))`
        params.push(ftsQuery, likeSearchTerm, likeSearchTerm)
      }
      if (filters.status && filters.status.length > 0) {
        query += ` AND m.status IN (${filters.status.map(() => '?').join(',')})`
        params.push(...filters.status)
      }
      if (filters.dateFrom) {
        query += ' AND date(m.meeting_date) >= ?'
        params.push(filters.dateFrom)
      }
      if (filters.dateTo) {
        query += ' AND date(m.meeting_date) <= ?'
        params.push(filters.dateTo)
      }
      if (filters.createdBy) {
        query += ' AND m.created_by = ?'
        params.push(filters.createdBy)
      }
      if (filters.tagIds && filters.tagIds.length > 0) {
        query += ` AND EXISTS (
          SELECT 1 FROM mom_tags mt
          WHERE mt.mom_id = m.id AND mt.tag_id IN (${filters.tagIds.map(() => '?').join(',')})
        )`
        params.push(...filters.tagIds)
      }

      query += ' ORDER BY m.meeting_date DESC'

      const moms = db.prepare(query).all(...params) as AdvancedSearchResult[]
      console.log('[Search] MOMs found:', moms.length)
      results.push(...moms)
    } catch (err) {
      console.error('[Search] Error searching MOMs:', err)
    }
  }

  // Search Issues (no FTS table, use LIKE)
  if (types.includes('issue')) {
    let query = `
      SELECT i.id, 'issue' as type, i.title, i.description, i.status,
             i.created_at as date, i.created_by, u.display_name as creator_name,
             i.topic_id, t.title as topic_title
      FROM issues i
      LEFT JOIN users u ON u.id = i.created_by
      LEFT JOIN topics t ON t.id = i.topic_id
      WHERE 1=1
    `
    const params: any[] = []

    if (likeSearchTerm) {
      query += ' AND (i.title LIKE ? OR i.description LIKE ?)'
      params.push(likeSearchTerm, likeSearchTerm)
    }
    if (filters.status && filters.status.length > 0) {
      query += ` AND i.status IN (${filters.status.map(() => '?').join(',')})`
      params.push(...filters.status)
    }
    if (filters.topicId) {
      query += ' AND i.topic_id = ?'
      params.push(filters.topicId)
    }
    if (filters.dateFrom) {
      query += ' AND date(i.created_at) >= ?'
      params.push(filters.dateFrom)
    }
    if (filters.dateTo) {
      query += ' AND date(i.created_at) <= ?'
      params.push(filters.dateTo)
    }
    if (filters.createdBy) {
      query += ' AND i.created_by = ?'
      params.push(filters.createdBy)
    }
    if (filters.importance) {
      query += ' AND i.importance = ?'
      params.push(filters.importance)
    }
    if (filters.tagIds && filters.tagIds.length > 0) {
      query += ` AND EXISTS (
        SELECT 1 FROM issue_tags it
        WHERE it.issue_id = i.id AND it.tag_id IN (${filters.tagIds.map(() => '?').join(',')})
      )`
      params.push(...filters.tagIds)
    }

    query += ' ORDER BY i.created_at DESC'

    const issues = db.prepare(query).all(...params) as AdvancedSearchResult[]
    console.log('[Search] Issues found:', issues.length)
    results.push(...issues)
  }

  // Search Secure References (no FTS, use LIKE)
  if (types.includes('secure_reference')) {
    try {
      let query = `
        SELECT DISTINCT sr.id, 'secure_reference' as type, sr.name as title, sr.description, NULL as status,
               sr.created_at as date, sr.created_by, u.display_name as creator_name,
               NULL as topic_id, sr.category as topic_title
        FROM secure_references sr
        LEFT JOIN users u ON u.id = sr.created_by
        LEFT JOIN secure_reference_files srf ON sr.id = srf.reference_id
        WHERE sr.deleted_at IS NULL
      `
      const params: any[] = []

      if (likeSearchTerm) {
        query += ' AND (sr.name LIKE ? OR sr.description LIKE ? OR sr.category LIKE ? OR srf.filename LIKE ?)'
        params.push(likeSearchTerm, likeSearchTerm, likeSearchTerm, likeSearchTerm)
      }
      if (filters.dateFrom) {
        query += ' AND date(sr.created_at) >= ?'
        params.push(filters.dateFrom)
      }
      if (filters.dateTo) {
        query += ' AND date(sr.created_at) <= ?'
        params.push(filters.dateTo)
      }
      if (filters.createdBy) {
        query += ' AND sr.created_by = ?'
        params.push(filters.createdBy)
      }

      query += ' ORDER BY sr.created_at DESC'

      const secureRefs = db.prepare(query).all(...params) as AdvancedSearchResult[]
      console.log('[Search] Secure References found:', secureRefs.length)
      results.push(...secureRefs)
    } catch (err) {
      console.error('[Search] Error searching secure references:', err)
    }
  }

  // Sort all results by date
  results.sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0
    const dateB = b.date ? new Date(b.date).getTime() : 0
    return dateB - dateA
  })

  const total = results.length
  const paginatedResults = results.slice(offset, offset + limit)

  // Record search history if query was provided and user is authenticated
  if (safeQuery && userId) {
    try {
      recordSearchHistory(userId, safeQuery, filters, total)
    } catch (error) {
      console.error('[Search] Error recording search history:', error)
    }
  }

  return {
    results: paginatedResults,
    total,
    offset,
    limit,
    searchTerms
  }
}

// ===== Saved Searches =====

export interface SavedSearch {
  id: string
  user_id: string
  name: string
  filters: string // JSON string
  created_at: string
  updated_at: string
}

export function createSavedSearch(
  userId: string,
  name: string,
  filters: AdvancedSearchFilters
): { success: boolean; search?: SavedSearch; error?: string } {
  const db = getDatabase()
  const id = require('crypto').randomUUID()
  const now = new Date().toISOString()

  try {
    db.prepare(`
      INSERT INTO saved_searches (id, user_id, name, filters, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, userId, name.trim(), JSON.stringify(filters), now, now)

    return {
      success: true,
      search: {
        id,
        user_id: userId,
        name: name.trim(),
        filters: JSON.stringify(filters),
        created_at: now,
        updated_at: now
      }
    }
  } catch (error) {
    console.error('Error creating saved search:', error)
    return { success: false, error: 'Failed to save search' }
  }
}

export function getSavedSearches(userId: string): SavedSearch[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM saved_searches
    WHERE user_id = ?
    ORDER BY updated_at DESC
  `).all(userId) as SavedSearch[]
}

export function getSavedSearchById(id: string): SavedSearch | null {
  const db = getDatabase()
  return db.prepare('SELECT * FROM saved_searches WHERE id = ?').get(id) as SavedSearch | null
}

export function updateSavedSearch(
  id: string,
  name: string,
  filters: AdvancedSearchFilters
): { success: boolean; error?: string } {
  const db = getDatabase()
  const now = new Date().toISOString()

  try {
    db.prepare(`
      UPDATE saved_searches
      SET name = ?, filters = ?, updated_at = ?
      WHERE id = ?
    `).run(name.trim(), JSON.stringify(filters), now, id)

    return { success: true }
  } catch (error) {
    console.error('Error updating saved search:', error)
    return { success: false, error: 'Failed to update search' }
  }
}

export function deleteSavedSearch(id: string): { success: boolean; error?: string } {
  const db = getDatabase()

  try {
    db.prepare('DELETE FROM saved_searches WHERE id = ?').run(id)
    return { success: true }
  } catch (error) {
    console.error('Error deleting saved search:', error)
    return { success: false, error: 'Failed to delete search' }
  }
}
