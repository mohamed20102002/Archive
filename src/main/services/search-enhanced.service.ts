/**
 * Enhanced Search Service
 *
 * Provides:
 * - Advanced FTS5 query parsing with AND, OR, NOT operators
 * - Search suggestions/autocomplete
 * - Match highlighting
 * - Search history tracking
 */

import { getDatabase } from '../database/connection'
import { randomUUID } from 'crypto'

// ===== Advanced Query Parsing =====

interface ParsedQuery {
  ftsQuery: string
  terms: string[]
  operators: ('AND' | 'OR' | 'NOT')[]
}

/**
 * Parse a search query with advanced operators
 * Supports: AND, OR, NOT, quotes for exact phrases
 *
 * Examples:
 * - "project management" → exact phrase search
 * - budget AND report → both terms required
 * - meeting OR conference → either term
 * - proposal NOT draft → exclude draft
 * - "quarterly report" AND finance NOT budget → complex query
 */
export function parseAdvancedQuery(query: string): ParsedQuery {
  const terms: string[] = []
  const operators: ('AND' | 'OR' | 'NOT')[] = []

  if (!query || query.trim().length === 0) {
    return { ftsQuery: '', terms: [], operators: [] }
  }

  // Tokenize while preserving quoted phrases
  const tokens: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < query.length; i++) {
    const char = query[i]

    if (char === '"') {
      if (inQuotes) {
        if (current.trim()) {
          tokens.push(`"${current.trim()}"`)
        }
        current = ''
        inQuotes = false
      } else {
        if (current.trim()) {
          tokens.push(current.trim())
        }
        current = ''
        inQuotes = true
      }
    } else if (char === ' ' && !inQuotes) {
      if (current.trim()) {
        tokens.push(current.trim())
      }
      current = ''
    } else {
      current += char
    }
  }

  if (current.trim()) {
    tokens.push(inQuotes ? `"${current.trim()}"` : current.trim())
  }

  // Process tokens to identify operators and terms
  const ftsTerms: string[] = []
  let nextIsNot = false

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].toUpperCase()

    if (token === 'AND') {
      operators.push('AND')
      continue
    }

    if (token === 'OR') {
      operators.push('OR')
      continue
    }

    if (token === 'NOT') {
      nextIsNot = true
      operators.push('NOT')
      continue
    }

    // It's a search term
    const term = tokens[i]
    terms.push(term.replace(/"/g, ''))

    // Build FTS query part
    if (term.startsWith('"') && term.endsWith('"')) {
      // Exact phrase
      const phrase = term.slice(1, -1)
      if (nextIsNot) {
        ftsTerms.push(`NOT "${phrase}"`)
        nextIsNot = false
      } else {
        ftsTerms.push(`"${phrase}"`)
      }
    } else {
      // Prefix search for individual words
      const cleanTerm = term.replace(/[^\w\u0600-\u06FF\u0400-\u04FF]/g, '')
      if (cleanTerm.length > 0) {
        if (nextIsNot) {
          ftsTerms.push(`NOT "${cleanTerm}"*`)
          nextIsNot = false
        } else {
          ftsTerms.push(`"${cleanTerm}"*`)
        }
      }
    }
  }

  // Join terms with appropriate operators
  let ftsQuery = ''
  for (let i = 0; i < ftsTerms.length; i++) {
    if (i > 0) {
      // Check if previous operator was OR
      const prevOp = operators[i - 1]
      if (prevOp === 'OR') {
        ftsQuery += ' OR '
      } else {
        // Default to AND
        ftsQuery += ' '
      }
    }
    ftsQuery += ftsTerms[i]
  }

  return { ftsQuery: ftsQuery.trim(), terms, operators }
}

/**
 * Escape special FTS5 characters for safe search
 * Used as fallback when advanced parsing fails
 */
export function escapeFts5Query(query: string): string {
  const cleaned = query
    .replace(/['"]/g, '')
    .replace(/[\\]/g, '')
    .trim()

  if (!cleaned) return ''

  const words = cleaned.split(/\s+/).filter(w => w.length > 0)
  if (words.length === 0) return ''

  return words.map(w => `"${w}"*`).join(' ')
}

// ===== Search Suggestions / Autocomplete =====

export interface SearchSuggestion {
  text: string
  type: 'recent' | 'topic' | 'letter' | 'record' | 'tag'
  count?: number
}

/**
 * Get search suggestions based on partial query
 */
export function getSearchSuggestions(
  partialQuery: string,
  userId: string,
  limit: number = 10
): SearchSuggestion[] {
  const db = getDatabase()
  const suggestions: SearchSuggestion[] = []
  const seen = new Set<string>()

  if (!partialQuery || partialQuery.trim().length < 2) {
    // Return recent searches only
    try {
      const recentSearches = db.prepare(`
        SELECT DISTINCT query
        FROM search_history
        WHERE user_id = ?
        ORDER BY searched_at DESC
        LIMIT ?
      `).all(userId, limit) as { query: string }[]

      for (const s of recentSearches) {
        if (!seen.has(s.query.toLowerCase())) {
          seen.add(s.query.toLowerCase())
          suggestions.push({ text: s.query, type: 'recent' })
        }
      }
    } catch {
      // Search history table may not exist yet
    }

    return suggestions
  }

  const searchTerm = `${partialQuery.trim()}%`
  const likeTerm = `%${partialQuery.trim()}%`

  // Get recent searches matching the query
  try {
    const recentSearches = db.prepare(`
      SELECT DISTINCT query
      FROM search_history
      WHERE user_id = ?
        AND query LIKE ?
      ORDER BY searched_at DESC
      LIMIT 3
    `).all(userId, likeTerm) as { query: string }[]

    for (const s of recentSearches) {
      if (!seen.has(s.query.toLowerCase())) {
        seen.add(s.query.toLowerCase())
        suggestions.push({ text: s.query, type: 'recent' })
      }
    }
  } catch {
    // Search history table may not exist
  }

  // Get matching topic titles
  const topics = db.prepare(`
    SELECT title, COUNT(*) as count
    FROM topics
    WHERE deleted_at IS NULL
      AND title LIKE ?
    GROUP BY title
    ORDER BY count DESC
    LIMIT 3
  `).all(likeTerm) as { title: string; count: number }[]

  for (const t of topics) {
    if (!seen.has(t.title.toLowerCase())) {
      seen.add(t.title.toLowerCase())
      suggestions.push({ text: t.title, type: 'topic', count: t.count })
    }
  }

  // Get matching letter subjects
  const letters = db.prepare(`
    SELECT subject, COUNT(*) as count
    FROM letters
    WHERE deleted_at IS NULL
      AND subject LIKE ?
    GROUP BY subject
    ORDER BY count DESC
    LIMIT 3
  `).all(likeTerm) as { subject: string; count: number }[]

  for (const l of letters) {
    if (!seen.has(l.subject.toLowerCase())) {
      seen.add(l.subject.toLowerCase())
      suggestions.push({ text: l.subject, type: 'letter', count: l.count })
    }
  }

  // Get matching record titles
  const records = db.prepare(`
    SELECT title, COUNT(*) as count
    FROM records
    WHERE deleted_at IS NULL
      AND title LIKE ?
    GROUP BY title
    ORDER BY count DESC
    LIMIT 3
  `).all(likeTerm) as { title: string; count: number }[]

  for (const r of records) {
    if (!seen.has(r.title.toLowerCase())) {
      seen.add(r.title.toLowerCase())
      suggestions.push({ text: r.title, type: 'record', count: r.count })
    }
  }

  // Get matching tags
  try {
    const tags = db.prepare(`
      SELECT name, (
        SELECT COUNT(*) FROM record_tags WHERE tag_id = tags.id
      ) + (
        SELECT COUNT(*) FROM letter_tags WHERE tag_id = tags.id
      ) as count
      FROM tags
      WHERE name LIKE ?
      ORDER BY count DESC
      LIMIT 3
    `).all(likeTerm) as { name: string; count: number }[]

    for (const tag of tags) {
      if (!seen.has(tag.name.toLowerCase())) {
        seen.add(tag.name.toLowerCase())
        suggestions.push({ text: tag.name, type: 'tag', count: tag.count })
      }
    }
  } catch {
    // Tags table may not exist
  }

  return suggestions.slice(0, limit)
}

// ===== Match Highlighting =====

export interface HighlightedText {
  text: string
  highlighted: boolean
}

/**
 * Highlight matching terms in text
 */
export function highlightMatches(
  text: string,
  searchTerms: string[],
  maxLength: number = 200
): HighlightedText[] {
  if (!text || !searchTerms || searchTerms.length === 0) {
    return [{ text: text?.substring(0, maxLength) || '', highlighted: false }]
  }

  // Normalize terms
  const normalizedTerms = searchTerms
    .map(t => t.toLowerCase().replace(/['"]/g, '').trim())
    .filter(t => t.length > 0)

  if (normalizedTerms.length === 0) {
    return [{ text: text.substring(0, maxLength), highlighted: false }]
  }

  // Find the first match position for context
  const lowerText = text.toLowerCase()
  let firstMatchPos = -1

  for (const term of normalizedTerms) {
    const pos = lowerText.indexOf(term)
    if (pos !== -1 && (firstMatchPos === -1 || pos < firstMatchPos)) {
      firstMatchPos = pos
    }
  }

  // Extract context around first match
  let startPos = 0
  let extractedText = text

  if (firstMatchPos > 50) {
    startPos = firstMatchPos - 40
    extractedText = '...' + text.substring(startPos)
  }

  if (extractedText.length > maxLength) {
    extractedText = extractedText.substring(0, maxLength) + '...'
  }

  // Build highlighted segments
  const segments: HighlightedText[] = []
  const lowerExtracted = extractedText.toLowerCase()
  let currentPos = 0

  // Create a map of all match positions
  const matches: { start: number; end: number; term: string }[] = []

  for (const term of normalizedTerms) {
    let searchPos = 0
    while (searchPos < lowerExtracted.length) {
      const pos = lowerExtracted.indexOf(term, searchPos)
      if (pos === -1) break

      matches.push({ start: pos, end: pos + term.length, term })
      searchPos = pos + 1
    }
  }

  // Sort matches by position
  matches.sort((a, b) => a.start - b.start)

  // Merge overlapping matches
  const mergedMatches: { start: number; end: number }[] = []
  for (const match of matches) {
    if (mergedMatches.length === 0) {
      mergedMatches.push({ start: match.start, end: match.end })
    } else {
      const last = mergedMatches[mergedMatches.length - 1]
      if (match.start <= last.end) {
        last.end = Math.max(last.end, match.end)
      } else {
        mergedMatches.push({ start: match.start, end: match.end })
      }
    }
  }

  // Build segments
  for (const match of mergedMatches) {
    if (match.start > currentPos) {
      segments.push({
        text: extractedText.substring(currentPos, match.start),
        highlighted: false
      })
    }
    segments.push({
      text: extractedText.substring(match.start, match.end),
      highlighted: true
    })
    currentPos = match.end
  }

  if (currentPos < extractedText.length) {
    segments.push({
      text: extractedText.substring(currentPos),
      highlighted: false
    })
  }

  return segments.length > 0 ? segments : [{ text: extractedText, highlighted: false }]
}

// ===== Search History =====

export interface SearchHistoryEntry {
  id: string
  user_id: string
  query: string
  filters: string // JSON
  result_count: number
  searched_at: string
}

/**
 * Record a search in history
 */
export function recordSearchHistory(
  userId: string,
  query: string,
  filters: object,
  resultCount: number
): void {
  const db = getDatabase()

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS search_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      query TEXT NOT NULL,
      filters TEXT,
      result_count INTEGER DEFAULT 0,
      searched_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // Add index if not exists
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_search_history_user_date
    ON search_history(user_id, searched_at DESC)
  `)

  const id = randomUUID()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO search_history (id, user_id, query, filters, result_count, searched_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, query.trim(), JSON.stringify(filters), resultCount, now)

  // Clean up old entries (keep last 100 per user)
  db.prepare(`
    DELETE FROM search_history
    WHERE user_id = ?
      AND id NOT IN (
        SELECT id FROM search_history
        WHERE user_id = ?
        ORDER BY searched_at DESC
        LIMIT 100
      )
  `).run(userId, userId)
}

/**
 * Get recent search history for a user
 */
export function getSearchHistory(
  userId: string,
  limit: number = 20
): SearchHistoryEntry[] {
  const db = getDatabase()

  try {
    return db.prepare(`
      SELECT * FROM search_history
      WHERE user_id = ?
      ORDER BY searched_at DESC
      LIMIT ?
    `).all(userId, limit) as SearchHistoryEntry[]
  } catch {
    return []
  }
}

/**
 * Clear search history for a user
 */
export function clearSearchHistory(userId: string): void {
  const db = getDatabase()

  try {
    db.prepare('DELETE FROM search_history WHERE user_id = ?').run(userId)
  } catch {
    // Table may not exist
  }
}

/**
 * Delete a specific search history entry
 */
export function deleteSearchHistoryEntry(id: string, userId: string): boolean {
  const db = getDatabase()

  try {
    const result = db.prepare(
      'DELETE FROM search_history WHERE id = ? AND user_id = ?'
    ).run(id, userId)
    return result.changes > 0
  } catch {
    return false
  }
}

// ===== FTS5 Index Maintenance =====

/**
 * Rebuild FTS5 indexes for optimal performance
 */
export function rebuildFtsIndexes(): { success: boolean; error?: string } {
  const db = getDatabase()

  try {
    // Rebuild topics_fts
    db.exec(`
      INSERT INTO topics_fts(topics_fts) VALUES('rebuild');
    `)

    // Rebuild records_fts
    db.exec(`
      INSERT INTO records_fts(records_fts) VALUES('rebuild');
    `)

    // Rebuild letters_fts if exists
    try {
      db.exec(`
        INSERT INTO letters_fts(letters_fts) VALUES('rebuild');
      `)
    } catch {
      // Table may not exist
    }

    // Rebuild moms_fts if exists
    try {
      db.exec(`
        INSERT INTO moms_fts(moms_fts) VALUES('rebuild');
      `)
    } catch {
      // Table may not exist
    }

    // Optimize
    db.exec(`
      INSERT INTO topics_fts(topics_fts) VALUES('optimize');
      INSERT INTO records_fts(records_fts) VALUES('optimize');
    `)

    return { success: true }
  } catch (error: any) {
    console.error('Error rebuilding FTS indexes:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get FTS index statistics
 */
export function getFtsStats(): {
  topics_fts: { documents: number; terms: number }
  records_fts: { documents: number; terms: number }
  letters_fts: { documents: number; terms: number } | null
  moms_fts: { documents: number; terms: number } | null
} {
  const db = getDatabase()

  const getStats = (tableName: string) => {
    try {
      const result = db.prepare(`
        SELECT COUNT(*) as documents FROM ${tableName.replace('_fts', '')}
        WHERE deleted_at IS NULL
      `).get() as { documents: number }

      return { documents: result.documents, terms: 0 }
    } catch {
      return null
    }
  }

  return {
    topics_fts: getStats('topics_fts') || { documents: 0, terms: 0 },
    records_fts: getStats('records_fts') || { documents: 0, terms: 0 },
    letters_fts: getStats('letters_fts'),
    moms_fts: getStats('moms_fts')
  }
}
