import { BaseRepository, BaseEntity, QueryOptions } from './base.repository'

/**
 * Letter entity interface
 */
export interface Letter extends BaseEntity {
  letter_id: string
  topic_id: string | null
  subcategory_id: string | null
  authority_id: string
  type: 'incoming' | 'outgoing'
  subject: string
  letter_date: string
  received_date: string | null
  response_deadline: string | null
  status: 'draft' | 'pending' | 'processing' | 'completed' | 'archived'
  notes: string | null
  file_path: string | null
}

/**
 * Data for creating a letter
 */
export interface CreateLetterData {
  letter_id: string
  topic_id?: string | null
  subcategory_id?: string | null
  authority_id: string
  type: 'incoming' | 'outgoing'
  subject: string
  letter_date: string
  received_date?: string | null
  response_deadline?: string | null
  status?: 'draft' | 'pending' | 'processing' | 'completed' | 'archived'
  notes?: string | null
  file_path?: string | null
}

/**
 * Data for updating a letter
 */
export interface UpdateLetterData {
  letter_id?: string
  topic_id?: string | null
  subcategory_id?: string | null
  authority_id?: string
  type?: 'incoming' | 'outgoing'
  subject?: string
  letter_date?: string
  received_date?: string | null
  response_deadline?: string | null
  status?: 'draft' | 'pending' | 'processing' | 'completed' | 'archived'
  notes?: string | null
  file_path?: string | null
}

/**
 * Letter with authority info
 */
export interface LetterWithAuthority extends Letter {
  authority_name: string
  authority_type: 'internal' | 'external'
}

/**
 * Letter filters
 */
export interface LetterFilters {
  type?: 'incoming' | 'outgoing'
  status?: string
  authorityId?: string
  topicId?: string
  dateFrom?: string
  dateTo?: string
  query?: string
}

/**
 * Letter repository for managing letters
 */
export class LetterRepository extends BaseRepository<Letter> {
  protected tableName = 'letters'
  protected columns = [
    'id',
    'letter_id',
    'topic_id',
    'subcategory_id',
    'authority_id',
    'type',
    'subject',
    'letter_date',
    'received_date',
    'response_deadline',
    'status',
    'notes',
    'file_path',
    'created_at',
    'updated_at',
    'deleted_at'
  ]

  /**
   * Create a new letter
   */
  create(data: CreateLetterData): Letter {
    return this.createEntity({
      letter_id: data.letter_id,
      topic_id: data.topic_id ?? null,
      subcategory_id: data.subcategory_id ?? null,
      authority_id: data.authority_id,
      type: data.type,
      subject: data.subject,
      letter_date: data.letter_date,
      received_date: data.received_date ?? null,
      response_deadline: data.response_deadline ?? null,
      status: data.status ?? 'pending',
      notes: data.notes ?? null,
      file_path: data.file_path ?? null
    })
  }

  /**
   * Update a letter
   */
  update(id: string, data: UpdateLetterData): boolean {
    const updateData: Partial<Letter> = {}

    if (data.letter_id !== undefined) updateData.letter_id = data.letter_id
    if (data.topic_id !== undefined) updateData.topic_id = data.topic_id
    if (data.subcategory_id !== undefined) updateData.subcategory_id = data.subcategory_id
    if (data.authority_id !== undefined) updateData.authority_id = data.authority_id
    if (data.type !== undefined) updateData.type = data.type
    if (data.subject !== undefined) updateData.subject = data.subject
    if (data.letter_date !== undefined) updateData.letter_date = data.letter_date
    if (data.received_date !== undefined) updateData.received_date = data.received_date
    if (data.response_deadline !== undefined) updateData.response_deadline = data.response_deadline
    if (data.status !== undefined) updateData.status = data.status
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.file_path !== undefined) updateData.file_path = data.file_path

    return this.updateEntity(id, updateData)
  }

  /**
   * Find letter by letter_id
   */
  findByLetterId(letterId: string): Letter | null {
    return this.findOne(
      `SELECT ${this.getSelectColumns()}
       FROM ${this.tableName}
       WHERE letter_id = ? AND deleted_at IS NULL`,
      [letterId]
    )
  }

  /**
   * Get all letters with filters
   */
  getAllWithFilters(filters: LetterFilters = {}): LetterWithAuthority[] {
    const db = this.getDb()

    let sql = `
      SELECT
        l.id, l.letter_id, l.topic_id, l.subcategory_id, l.authority_id,
        l.type, l.subject, l.letter_date, l.received_date, l.response_deadline,
        l.status, l.notes, l.file_path, l.created_at, l.updated_at, l.deleted_at,
        a.name as authority_name,
        a.type as authority_type
      FROM letters l
      JOIN authorities a ON a.id = l.authority_id
      WHERE l.deleted_at IS NULL
    `
    const params: unknown[] = []

    if (filters.type) {
      sql += ' AND l.type = ?'
      params.push(filters.type)
    }

    if (filters.status) {
      sql += ' AND l.status = ?'
      params.push(filters.status)
    }

    if (filters.authorityId) {
      sql += ' AND l.authority_id = ?'
      params.push(filters.authorityId)
    }

    if (filters.topicId) {
      sql += ' AND l.topic_id = ?'
      params.push(filters.topicId)
    }

    if (filters.dateFrom) {
      sql += ' AND l.letter_date >= ?'
      params.push(filters.dateFrom)
    }

    if (filters.dateTo) {
      sql += ' AND l.letter_date <= ?'
      params.push(filters.dateTo)
    }

    if (filters.query) {
      sql += ' AND (l.subject LIKE ? OR l.letter_id LIKE ?)'
      params.push(`%${filters.query}%`, `%${filters.query}%`)
    }

    sql += ' ORDER BY l.letter_date DESC'

    const stmt = db.prepare(sql)
    return stmt.all(...params) as LetterWithAuthority[]
  }

  /**
   * Get letters by topic
   */
  getByTopic(topicId: string, subcategoryId?: string | null): Letter[] {
    const where: Record<string, unknown> = { topic_id: topicId }
    if (subcategoryId !== undefined) {
      where.subcategory_id = subcategoryId
    }

    return this.findAll({
      where,
      orderBy: 'letter_date',
      orderDirection: 'DESC'
    })
  }

  /**
   * Get letters by authority
   */
  getByAuthority(authorityId: string): Letter[] {
    return this.findAll({
      where: { authority_id: authorityId },
      orderBy: 'letter_date',
      orderDirection: 'DESC'
    })
  }

  /**
   * Get incoming letters
   */
  getIncoming(): Letter[] {
    return this.findAll({
      where: { type: 'incoming' },
      orderBy: 'letter_date',
      orderDirection: 'DESC'
    })
  }

  /**
   * Get outgoing letters
   */
  getOutgoing(): Letter[] {
    return this.findAll({
      where: { type: 'outgoing' },
      orderBy: 'letter_date',
      orderDirection: 'DESC'
    })
  }

  /**
   * Get pending letters (awaiting response)
   */
  getPending(): LetterWithAuthority[] {
    const db = this.getDb()

    const stmt = db.prepare(`
      SELECT
        l.id, l.letter_id, l.topic_id, l.subcategory_id, l.authority_id,
        l.type, l.subject, l.letter_date, l.received_date, l.response_deadline,
        l.status, l.notes, l.file_path, l.created_at, l.updated_at, l.deleted_at,
        a.name as authority_name,
        a.type as authority_type
      FROM letters l
      JOIN authorities a ON a.id = l.authority_id
      WHERE l.deleted_at IS NULL
        AND l.status = 'pending'
      ORDER BY l.response_deadline ASC, l.letter_date DESC
    `)

    return stmt.all() as LetterWithAuthority[]
  }

  /**
   * Get overdue letters (past response deadline)
   */
  getOverdue(): LetterWithAuthority[] {
    const db = this.getDb()
    const today = new Date().toISOString().split('T')[0]

    const stmt = db.prepare(`
      SELECT
        l.id, l.letter_id, l.topic_id, l.subcategory_id, l.authority_id,
        l.type, l.subject, l.letter_date, l.received_date, l.response_deadline,
        l.status, l.notes, l.file_path, l.created_at, l.updated_at, l.deleted_at,
        a.name as authority_name,
        a.type as authority_type
      FROM letters l
      JOIN authorities a ON a.id = l.authority_id
      WHERE l.deleted_at IS NULL
        AND l.status NOT IN ('completed', 'archived')
        AND l.response_deadline IS NOT NULL
        AND l.response_deadline < ?
      ORDER BY l.response_deadline ASC
    `)

    return stmt.all(today) as LetterWithAuthority[]
  }

  /**
   * Update letter status
   */
  updateStatus(id: string, status: 'draft' | 'pending' | 'processing' | 'completed' | 'archived'): boolean {
    return this.update(id, { status })
  }

  /**
   * Set file path
   */
  setFilePath(id: string, filePath: string): boolean {
    return this.update(id, { file_path: filePath })
  }

  /**
   * Search letters using FTS5
   */
  searchFts(query: string, limit = 50): LetterWithAuthority[] {
    const db = this.getDb()

    try {
      const escapedQuery = query
        .replace(/['"]/g, '')
        .replace(/[\\]/g, '')
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 0)
        .map(w => `"${w}"*`)
        .join(' ')

      if (!escapedQuery) {
        return this.getAllWithFilters({ query })
      }

      const stmt = db.prepare(`
        SELECT
          l.id, l.letter_id, l.topic_id, l.subcategory_id, l.authority_id,
          l.type, l.subject, l.letter_date, l.received_date, l.response_deadline,
          l.status, l.notes, l.file_path, l.created_at, l.updated_at, l.deleted_at,
          a.name as authority_name,
          a.type as authority_type
        FROM letters l
        JOIN letters_fts fts ON l.rowid = fts.rowid
        JOIN authorities a ON a.id = l.authority_id
        WHERE letters_fts MATCH ?
          AND l.deleted_at IS NULL
        ORDER BY rank
        LIMIT ?
      `)

      return stmt.all(escapedQuery, limit) as LetterWithAuthority[]
    } catch {
      return this.getAllWithFilters({ query })
    }
  }

  /**
   * Get letter statistics
   */
  getStats(): {
    total: number
    incoming: number
    outgoing: number
    pending: number
    overdue: number
    thisMonth: number
  } {
    const db = this.getDb()
    const today = new Date().toISOString().split('T')[0]
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const stmt = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN type = 'incoming' THEN 1 ELSE 0 END) as incoming,
        SUM(CASE WHEN type = 'outgoing' THEN 1 ELSE 0 END) as outgoing,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN response_deadline < ? AND status NOT IN ('completed', 'archived') THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as this_month
      FROM letters
      WHERE deleted_at IS NULL
    `)

    const result = stmt.get(today, monthStart.toISOString()) as {
      total: number
      incoming: number
      outgoing: number
      pending: number
      overdue: number
      this_month: number
    }

    return {
      total: result.total,
      incoming: result.incoming,
      outgoing: result.outgoing,
      pending: result.pending,
      overdue: result.overdue,
      thisMonth: result.this_month
    }
  }

  /**
   * Check if letter_id exists
   */
  letterIdExists(letterId: string, excludeId?: string): boolean {
    const db = this.getDb()

    let sql = `
      SELECT 1 FROM letters
      WHERE letter_id = ? AND deleted_at IS NULL
    `
    const params: unknown[] = [letterId]

    if (excludeId) {
      sql += ' AND id != ?'
      params.push(excludeId)
    }

    const stmt = db.prepare(sql)
    return stmt.get(...params) !== undefined
  }
}

// Export singleton instance
export const letterRepository = new LetterRepository()
