import Database from 'better-sqlite3'
import { getDatabase } from '../database/connection'
import { v4 as uuidv4 } from 'uuid'

/**
 * Base entity interface - all entities should have these fields
 */
export interface BaseEntity {
  id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/**
 * Query options for filtering and pagination
 */
export interface QueryOptions {
  where?: Record<string, unknown>
  orderBy?: string
  orderDirection?: 'ASC' | 'DESC'
  limit?: number
  offset?: number
  includeDeleted?: boolean
}

/**
 * Result of a paginated query
 */
export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * Transaction callback type
 */
export type TransactionCallback<T> = (repos: RepositoryContext) => T

/**
 * Repository context for transactions - provides access to all repositories
 */
export interface RepositoryContext {
  db: Database.Database
}

/**
 * Base repository class with common CRUD operations
 * Provides soft delete functionality and transaction support
 */
export abstract class BaseRepository<T extends BaseEntity> {
  protected abstract tableName: string
  protected abstract columns: string[]

  /**
   * Get the database connection
   */
  protected getDb(): Database.Database {
    return getDatabase()
  }

  /**
   * Generate a new UUID
   */
  protected generateId(): string {
    return uuidv4()
  }

  /**
   * Get current ISO timestamp
   */
  protected now(): string {
    return new Date().toISOString()
  }

  /**
   * Build column list for SELECT queries
   */
  protected getSelectColumns(): string {
    return this.columns.join(', ')
  }

  /**
   * Find an entity by ID
   */
  findById(id: string, includeDeleted = false): T | null {
    const db = this.getDb()
    const deletedCondition = includeDeleted ? '' : ' AND deleted_at IS NULL'

    const stmt = db.prepare(`
      SELECT ${this.getSelectColumns()}
      FROM ${this.tableName}
      WHERE id = ?${deletedCondition}
    `)

    return stmt.get(id) as T | null
  }

  /**
   * Find all entities matching options
   */
  findAll(options: QueryOptions = {}): T[] {
    const db = this.getDb()
    const { where = {}, orderBy, orderDirection = 'ASC', limit, offset, includeDeleted = false } = options

    let sql = `SELECT ${this.getSelectColumns()} FROM ${this.tableName} WHERE 1=1`
    const params: unknown[] = []

    // Add soft delete filter
    if (!includeDeleted) {
      sql += ' AND deleted_at IS NULL'
    }

    // Add where conditions
    for (const [key, value] of Object.entries(where)) {
      if (value === null) {
        sql += ` AND ${key} IS NULL`
      } else if (value === undefined) {
        continue
      } else {
        sql += ` AND ${key} = ?`
        params.push(value)
      }
    }

    // Add order by
    if (orderBy) {
      sql += ` ORDER BY ${orderBy} ${orderDirection}`
    }

    // Add limit and offset
    if (limit !== undefined) {
      sql += ' LIMIT ?'
      params.push(limit)

      if (offset !== undefined) {
        sql += ' OFFSET ?'
        params.push(offset)
      }
    }

    const stmt = db.prepare(sql)
    return stmt.all(...params) as T[]
  }

  /**
   * Find entities with pagination
   */
  findPaginated(page: number, pageSize: number, options: QueryOptions = {}): PaginatedResult<T> {
    const offset = (page - 1) * pageSize
    const items = this.findAll({ ...options, limit: pageSize, offset })
    const total = this.count(options)

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  }

  /**
   * Count entities matching options
   */
  count(options: QueryOptions = {}): number {
    const db = this.getDb()
    const { where = {}, includeDeleted = false } = options

    let sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE 1=1`
    const params: unknown[] = []

    if (!includeDeleted) {
      sql += ' AND deleted_at IS NULL'
    }

    for (const [key, value] of Object.entries(where)) {
      if (value === null) {
        sql += ` AND ${key} IS NULL`
      } else if (value === undefined) {
        continue
      } else {
        sql += ` AND ${key} = ?`
        params.push(value)
      }
    }

    const stmt = db.prepare(sql)
    const result = stmt.get(...params) as { count: number }
    return result.count
  }

  /**
   * Check if an entity exists
   */
  exists(id: string, includeDeleted = false): boolean {
    const db = this.getDb()
    const deletedCondition = includeDeleted ? '' : ' AND deleted_at IS NULL'

    const stmt = db.prepare(`
      SELECT 1 FROM ${this.tableName}
      WHERE id = ?${deletedCondition}
    `)

    return stmt.get(id) !== undefined
  }

  /**
   * Create a new entity
   */
  protected createEntity(data: Omit<T, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>): T {
    const db = this.getDb()
    const now = this.now()

    const entity = {
      id: this.generateId(),
      ...data,
      created_at: now,
      updated_at: now,
      deleted_at: null
    } as T

    const columns = Object.keys(entity)
    const placeholders = columns.map(() => '?').join(', ')
    const values = columns.map(col => (entity as Record<string, unknown>)[col])

    const stmt = db.prepare(`
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES (${placeholders})
    `)

    stmt.run(...values)
    return entity
  }

  /**
   * Update an entity
   */
  protected updateEntity(id: string, data: Partial<Omit<T, 'id' | 'created_at' | 'deleted_at'>>): boolean {
    const db = this.getDb()
    const now = this.now()

    const updates = { ...data, updated_at: now }
    const columns = Object.keys(updates)
    const setClause = columns.map(col => `${col} = ?`).join(', ')
    const values = columns.map(col => (updates as Record<string, unknown>)[col])

    const stmt = db.prepare(`
      UPDATE ${this.tableName}
      SET ${setClause}
      WHERE id = ? AND deleted_at IS NULL
    `)

    const result = stmt.run(...values, id)
    return result.changes > 0
  }

  /**
   * Soft delete an entity
   */
  softDelete(id: string): boolean {
    const db = this.getDb()
    const now = this.now()

    const stmt = db.prepare(`
      UPDATE ${this.tableName}
      SET deleted_at = ?, updated_at = ?
      WHERE id = ? AND deleted_at IS NULL
    `)

    const result = stmt.run(now, now, id)
    return result.changes > 0
  }

  /**
   * Restore a soft-deleted entity
   */
  restore(id: string): boolean {
    const db = this.getDb()
    const now = this.now()

    const stmt = db.prepare(`
      UPDATE ${this.tableName}
      SET deleted_at = NULL, updated_at = ?
      WHERE id = ? AND deleted_at IS NOT NULL
    `)

    const result = stmt.run(now, id)
    return result.changes > 0
  }

  /**
   * Permanently delete an entity
   */
  hardDelete(id: string): boolean {
    const db = this.getDb()

    const stmt = db.prepare(`
      DELETE FROM ${this.tableName}
      WHERE id = ?
    `)

    const result = stmt.run(id)
    return result.changes > 0
  }

  /**
   * Execute a query within a transaction
   */
  static transaction<T>(callback: TransactionCallback<T>): T {
    const db = getDatabase()

    return db.transaction(() => {
      const context: RepositoryContext = { db }
      return callback(context)
    })()
  }

  /**
   * Execute a batch operation within a transaction
   */
  static batchTransaction<T>(
    items: T[],
    callback: (item: T, context: RepositoryContext) => void
  ): { success: boolean; processed: number; errors: string[] } {
    const db = getDatabase()
    const errors: string[] = []
    let processed = 0

    try {
      db.transaction(() => {
        const context: RepositoryContext = { db }

        for (const item of items) {
          try {
            callback(item, context)
            processed++
          } catch (e) {
            errors.push(String(e))
          }
        }

        // If any errors, rollback the entire transaction
        if (errors.length > 0) {
          throw new Error(`Batch operation had ${errors.length} errors`)
        }
      })()

      return { success: true, processed, errors }
    } catch (e) {
      return { success: false, processed, errors }
    }
  }

  /**
   * Find entities by a custom SQL query
   */
  protected findByQuery(sql: string, params: unknown[] = []): T[] {
    const db = this.getDb()
    const stmt = db.prepare(sql)
    return stmt.all(...params) as T[]
  }

  /**
   * Execute a custom SQL query
   */
  protected executeQuery(sql: string, params: unknown[] = []): Database.RunResult {
    const db = this.getDb()
    const stmt = db.prepare(sql)
    return stmt.run(...params)
  }

  /**
   * Find one entity by custom criteria
   */
  protected findOne(sql: string, params: unknown[] = []): T | null {
    const db = this.getDb()
    const stmt = db.prepare(sql)
    return stmt.get(...params) as T | null
  }
}

/**
 * Helper to create a transaction context
 */
export function withTransaction<T>(callback: TransactionCallback<T>): T {
  return BaseRepository.transaction(callback)
}

/**
 * Helper for batch transactions
 */
export function batchTransaction<T>(
  items: T[],
  callback: (item: T, context: RepositoryContext) => void
): { success: boolean; processed: number; errors: string[] } {
  return BaseRepository.batchTransaction(items, callback)
}
