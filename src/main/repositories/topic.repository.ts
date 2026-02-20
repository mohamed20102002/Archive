import { BaseRepository, BaseEntity, QueryOptions } from './base.repository'

/**
 * Topic entity interface
 */
export interface Topic extends BaseEntity {
  title: string
  description: string | null
  status: 'active' | 'archived'
}

/**
 * Data for creating a topic
 */
export interface CreateTopicData {
  title: string
  description?: string | null
  status?: 'active' | 'archived'
}

/**
 * Data for updating a topic
 */
export interface UpdateTopicData {
  title?: string
  description?: string | null
  status?: 'active' | 'archived'
}

/**
 * Topic with record count
 */
export interface TopicWithCount extends Topic {
  record_count: number
}

/**
 * Topic repository for managing topics
 */
export class TopicRepository extends BaseRepository<Topic> {
  protected tableName = 'topics'
  protected columns = [
    'id',
    'title',
    'description',
    'status',
    'created_at',
    'updated_at',
    'deleted_at'
  ]

  /**
   * Create a new topic
   */
  create(data: CreateTopicData): Topic {
    return this.createEntity({
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? 'active'
    })
  }

  /**
   * Update a topic
   */
  update(id: string, data: UpdateTopicData): boolean {
    const updateData: Partial<Topic> = {}

    if (data.title !== undefined) updateData.title = data.title
    if (data.description !== undefined) updateData.description = data.description
    if (data.status !== undefined) updateData.status = data.status

    return this.updateEntity(id, updateData)
  }

  /**
   * Find topic by title
   */
  findByTitle(title: string): Topic | null {
    return this.findOne(
      `SELECT ${this.getSelectColumns()}
       FROM ${this.tableName}
       WHERE title = ? AND deleted_at IS NULL`,
      [title]
    )
  }

  /**
   * Search topics by title
   */
  search(query: string, limit = 20): Topic[] {
    return this.findByQuery(
      `SELECT ${this.getSelectColumns()}
       FROM ${this.tableName}
       WHERE deleted_at IS NULL
         AND title LIKE ?
       ORDER BY title ASC
       LIMIT ?`,
      [`%${query}%`, limit]
    )
  }

  /**
   * Get all topics with record counts
   */
  getAllWithRecordCount(options: QueryOptions = {}): TopicWithCount[] {
    const db = this.getDb()
    const { orderBy = 'title', orderDirection = 'ASC', includeDeleted = false } = options

    const deletedCondition = includeDeleted ? '' : 'AND t.deleted_at IS NULL'

    const sql = `
      SELECT
        t.id,
        t.title,
        t.description,
        t.status,
        t.created_at,
        t.updated_at,
        t.deleted_at,
        COUNT(r.id) as record_count
      FROM topics t
      LEFT JOIN records r ON r.topic_id = t.id AND r.deleted_at IS NULL
      WHERE 1=1 ${deletedCondition}
      GROUP BY t.id
      ORDER BY t.${orderBy} ${orderDirection}
    `

    const stmt = db.prepare(sql)
    return stmt.all() as TopicWithCount[]
  }

  /**
   * Get active topics
   */
  getActive(): Topic[] {
    return this.findAll({
      where: { status: 'active' },
      orderBy: 'title',
      orderDirection: 'ASC'
    })
  }

  /**
   * Get archived topics
   */
  getArchived(): Topic[] {
    return this.findAll({
      where: { status: 'archived' },
      orderBy: 'title',
      orderDirection: 'ASC'
    })
  }

  /**
   * Archive a topic
   */
  archive(id: string): boolean {
    return this.update(id, { status: 'archived' })
  }

  /**
   * Unarchive a topic
   */
  unarchive(id: string): boolean {
    return this.update(id, { status: 'active' })
  }

  /**
   * Check if topic has records
   */
  hasRecords(id: string): boolean {
    const db = this.getDb()
    const stmt = db.prepare(`
      SELECT 1 FROM records
      WHERE topic_id = ? AND deleted_at IS NULL
      LIMIT 1
    `)
    return stmt.get(id) !== undefined
  }

  /**
   * Get topics for FTS (full-text search)
   */
  searchFts(query: string, limit = 20): Topic[] {
    const db = this.getDb()

    try {
      // Try FTS5 search first
      const escapedQuery = query
        .replace(/['"]/g, '')
        .replace(/[\\]/g, '')
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 0)
        .map(w => `"${w}"*`)
        .join(' ')

      if (!escapedQuery) {
        return this.search(query, limit)
      }

      const stmt = db.prepare(`
        SELECT t.id, t.title, t.description, t.status, t.created_at, t.updated_at, t.deleted_at
        FROM topics t
        JOIN topics_fts fts ON t.rowid = fts.rowid
        WHERE topics_fts MATCH ?
          AND t.deleted_at IS NULL
        ORDER BY rank
        LIMIT ?
      `)

      return stmt.all(escapedQuery, limit) as Topic[]
    } catch {
      // Fallback to LIKE search
      return this.search(query, limit)
    }
  }
}

// Export singleton instance
export const topicRepository = new TopicRepository()
