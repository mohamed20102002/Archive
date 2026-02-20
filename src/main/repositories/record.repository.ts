import { BaseRepository, BaseEntity, QueryOptions } from './base.repository'

/**
 * Record entity interface
 */
export interface Record extends BaseEntity {
  topic_id: string
  subcategory_id: string | null
  title: string
  content: string | null
  record_date: string
  status: 'pending' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
}

/**
 * Data for creating a record
 */
export interface CreateRecordData {
  topic_id: string
  subcategory_id?: string | null
  title: string
  content?: string | null
  record_date?: string
  status?: 'pending' | 'in_progress' | 'resolved' | 'closed'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
}

/**
 * Data for updating a record
 */
export interface UpdateRecordData {
  topic_id?: string
  subcategory_id?: string | null
  title?: string
  content?: string | null
  record_date?: string
  status?: 'pending' | 'in_progress' | 'resolved' | 'closed'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
}

/**
 * Record with topic info
 */
export interface RecordWithTopic extends Record {
  topic_title: string
  subcategory_name: string | null
}

/**
 * Record repository for managing records
 */
export class RecordRepository extends BaseRepository<Record> {
  protected tableName = 'records'
  protected columns = [
    'id',
    'topic_id',
    'subcategory_id',
    'title',
    'content',
    'record_date',
    'status',
    'priority',
    'created_at',
    'updated_at',
    'deleted_at'
  ]

  /**
   * Create a new record
   */
  create(data: CreateRecordData): Record {
    return this.createEntity({
      topic_id: data.topic_id,
      subcategory_id: data.subcategory_id ?? null,
      title: data.title,
      content: data.content ?? null,
      record_date: data.record_date ?? new Date().toISOString().split('T')[0],
      status: data.status ?? 'pending',
      priority: data.priority ?? 'medium'
    })
  }

  /**
   * Update a record
   */
  update(id: string, data: UpdateRecordData): boolean {
    const updateData: Partial<Record> = {}

    if (data.topic_id !== undefined) updateData.topic_id = data.topic_id
    if (data.subcategory_id !== undefined) updateData.subcategory_id = data.subcategory_id
    if (data.title !== undefined) updateData.title = data.title
    if (data.content !== undefined) updateData.content = data.content
    if (data.record_date !== undefined) updateData.record_date = data.record_date
    if (data.status !== undefined) updateData.status = data.status
    if (data.priority !== undefined) updateData.priority = data.priority

    return this.updateEntity(id, updateData)
  }

  /**
   * Get records by topic ID
   */
  getByTopic(topicId: string, subcategoryId?: string | null): Record[] {
    const where: Record<string, unknown> = { topic_id: topicId }
    if (subcategoryId !== undefined) {
      where.subcategory_id = subcategoryId
    }

    return this.findAll({
      where,
      orderBy: 'record_date',
      orderDirection: 'DESC'
    })
  }

  /**
   * Get records by topic with full details
   */
  getByTopicWithDetails(topicId: string, subcategoryId?: string | null): RecordWithTopic[] {
    const db = this.getDb()

    let sql = `
      SELECT
        r.id, r.topic_id, r.subcategory_id, r.title, r.content,
        r.record_date, r.status, r.priority, r.created_at, r.updated_at, r.deleted_at,
        t.title as topic_title,
        s.name as subcategory_name
      FROM records r
      JOIN topics t ON t.id = r.topic_id
      LEFT JOIN subcategories s ON s.id = r.subcategory_id
      WHERE r.deleted_at IS NULL
        AND r.topic_id = ?
    `
    const params: unknown[] = [topicId]

    if (subcategoryId !== undefined) {
      if (subcategoryId === null) {
        sql += ' AND r.subcategory_id IS NULL'
      } else {
        sql += ' AND r.subcategory_id = ?'
        params.push(subcategoryId)
      }
    }

    sql += ' ORDER BY r.record_date DESC'

    const stmt = db.prepare(sql)
    return stmt.all(...params) as RecordWithTopic[]
  }

  /**
   * Search records
   */
  search(query: string, topicId?: string, limit = 50): Record[] {
    const db = this.getDb()

    let sql = `
      SELECT ${this.getSelectColumns()}
      FROM ${this.tableName}
      WHERE deleted_at IS NULL
        AND (title LIKE ? OR content LIKE ?)
    `
    const params: unknown[] = [`%${query}%`, `%${query}%`]

    if (topicId) {
      sql += ' AND topic_id = ?'
      params.push(topicId)
    }

    sql += ' ORDER BY record_date DESC LIMIT ?'
    params.push(limit)

    const stmt = db.prepare(sql)
    return stmt.all(...params) as Record[]
  }

  /**
   * Search records using FTS5
   */
  searchFts(query: string, topicId?: string, limit = 50): RecordWithTopic[] {
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
        // Fall back to regular search
        const records = this.search(query, topicId, limit)
        return records.map(r => ({
          ...r,
          topic_title: '',
          subcategory_name: null
        }))
      }

      let sql = `
        SELECT
          r.id, r.topic_id, r.subcategory_id, r.title, r.content,
          r.record_date, r.status, r.priority, r.created_at, r.updated_at, r.deleted_at,
          t.title as topic_title,
          s.name as subcategory_name
        FROM records r
        JOIN records_fts fts ON r.rowid = fts.rowid
        JOIN topics t ON t.id = r.topic_id
        LEFT JOIN subcategories s ON s.id = r.subcategory_id
        WHERE records_fts MATCH ?
          AND r.deleted_at IS NULL
      `
      const params: unknown[] = [escapedQuery]

      if (topicId) {
        sql += ' AND r.topic_id = ?'
        params.push(topicId)
      }

      sql += ' ORDER BY rank LIMIT ?'
      params.push(limit)

      const stmt = db.prepare(sql)
      return stmt.all(...params) as RecordWithTopic[]
    } catch {
      // Fallback to LIKE search
      const records = this.search(query, topicId, limit)
      return records.map(r => ({
        ...r,
        topic_title: '',
        subcategory_name: null
      }))
    }
  }

  /**
   * Get records by status
   */
  getByStatus(status: 'pending' | 'in_progress' | 'resolved' | 'closed'): Record[] {
    return this.findAll({
      where: { status },
      orderBy: 'record_date',
      orderDirection: 'DESC'
    })
  }

  /**
   * Get records by priority
   */
  getByPriority(priority: 'low' | 'medium' | 'high' | 'urgent'): Record[] {
    return this.findAll({
      where: { priority },
      orderBy: 'record_date',
      orderDirection: 'DESC'
    })
  }

  /**
   * Get recent records
   */
  getRecent(days = 7, limit = 100): RecordWithTopic[] {
    const db = this.getDb()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    const stmt = db.prepare(`
      SELECT
        r.id, r.topic_id, r.subcategory_id, r.title, r.content,
        r.record_date, r.status, r.priority, r.created_at, r.updated_at, r.deleted_at,
        t.title as topic_title,
        s.name as subcategory_name
      FROM records r
      JOIN topics t ON t.id = r.topic_id
      LEFT JOIN subcategories s ON s.id = r.subcategory_id
      WHERE r.deleted_at IS NULL
        AND r.created_at >= ?
      ORDER BY r.created_at DESC
      LIMIT ?
    `)

    return stmt.all(cutoffDate.toISOString(), limit) as RecordWithTopic[]
  }

  /**
   * Update record status
   */
  updateStatus(id: string, status: 'pending' | 'in_progress' | 'resolved' | 'closed'): boolean {
    return this.update(id, { status })
  }

  /**
   * Update record priority
   */
  updatePriority(id: string, priority: 'low' | 'medium' | 'high' | 'urgent'): boolean {
    return this.update(id, { priority })
  }

  /**
   * Move record to a different topic
   */
  moveTo(id: string, topicId: string, subcategoryId?: string | null): boolean {
    return this.update(id, {
      topic_id: topicId,
      subcategory_id: subcategoryId ?? null
    })
  }

  /**
   * Get record count by topic
   */
  countByTopic(topicId: string): number {
    return this.count({ where: { topic_id: topicId } })
  }

  /**
   * Get stats for records
   */
  getStats(): {
    total: number
    byStatus: Record<string, number>
    byPriority: Record<string, number>
    thisWeek: number
    thisMonth: number
  } {
    const db = this.getDb()

    // Get total
    const total = this.count()

    // Get by status
    const statusStmt = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM records
      WHERE deleted_at IS NULL
      GROUP BY status
    `)
    const statusResults = statusStmt.all() as { status: string; count: number }[]
    const byStatus: Record<string, number> = {}
    for (const row of statusResults) {
      byStatus[row.status] = row.count
    }

    // Get by priority
    const priorityStmt = db.prepare(`
      SELECT priority, COUNT(*) as count
      FROM records
      WHERE deleted_at IS NULL
      GROUP BY priority
    `)
    const priorityResults = priorityStmt.all() as { priority: string; count: number }[]
    const byPriority: Record<string, number> = {}
    for (const row of priorityResults) {
      byPriority[row.priority] = row.count
    }

    // Get this week
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)

    const weekStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM records
      WHERE deleted_at IS NULL
        AND created_at >= ?
    `)
    const thisWeek = (weekStmt.get(weekStart.toISOString()) as { count: number }).count

    // Get this month
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const monthStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM records
      WHERE deleted_at IS NULL
        AND created_at >= ?
    `)
    const thisMonth = (monthStmt.get(monthStart.toISOString()) as { count: number }).count

    return {
      total,
      byStatus,
      byPriority,
      thisWeek,
      thisMonth
    }
  }
}

// Export singleton instance
export const recordRepository = new RecordRepository()
