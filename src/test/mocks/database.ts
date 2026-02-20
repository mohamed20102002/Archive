/**
 * Mock database for testing
 *
 * Provides an in-memory SQLite database for unit tests
 */

import Database from 'better-sqlite3'
import { vi } from 'vitest'

let testDb: Database.Database | null = null

/**
 * Create an in-memory test database
 */
export function createTestDatabase(): Database.Database {
  testDb = new Database(':memory:')

  // Enable foreign keys
  testDb.pragma('foreign_keys = ON')

  return testDb
}

/**
 * Initialize test database with schema
 */
export function initTestDatabase(): Database.Database {
  const db = createTestDatabase()

  // Create essential tables for testing
  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      is_active INTEGER NOT NULL DEFAULT 1,
      employee_number TEXT,
      shift_id TEXT,
      sort_order INTEGER DEFAULT 0,
      two_factor_enabled INTEGER NOT NULL DEFAULT 0,
      email TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT,
      deleted_at TEXT
    );

    -- Topics table
    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    -- Records table
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL,
      subcategory_id TEXT,
      title TEXT NOT NULL,
      content TEXT,
      record_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT NOT NULL DEFAULT 'medium',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (topic_id) REFERENCES topics(id)
    );

    -- Letters table
    CREATE TABLE IF NOT EXISTS letters (
      id TEXT PRIMARY KEY,
      letter_id TEXT NOT NULL UNIQUE,
      topic_id TEXT,
      subcategory_id TEXT,
      authority_id TEXT NOT NULL,
      type TEXT NOT NULL,
      subject TEXT NOT NULL,
      letter_date TEXT NOT NULL,
      received_date TEXT,
      response_deadline TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      file_path TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (topic_id) REFERENCES topics(id)
    );

    -- Issues table
    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      topic_id TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open',
      reminder_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      closed_at TEXT,
      deleted_at TEXT,
      FOREIGN KEY (topic_id) REFERENCES topics(id)
    );

    -- Authorities table
    CREATE TABLE IF NOT EXISTS authorities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      email_domain TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    -- Settings table
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    );

    -- Audit log table
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      user_id TEXT,
      username TEXT,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL,
      prev_hash TEXT,
      hash TEXT
    );

    -- FTS tables
    CREATE VIRTUAL TABLE IF NOT EXISTS topics_fts USING fts5(title, description, content=topics, content_rowid=rowid);
    CREATE VIRTUAL TABLE IF NOT EXISTS records_fts USING fts5(title, content, content=records, content_rowid=rowid);
    CREATE VIRTUAL TABLE IF NOT EXISTS letters_fts USING fts5(subject, notes, content=letters, content_rowid=rowid);
  `)

  return db
}

/**
 * Get the current test database
 */
export function getTestDatabase(): Database.Database {
  if (!testDb) {
    throw new Error('Test database not initialized. Call initTestDatabase() first.')
  }
  return testDb
}

/**
 * Close and cleanup test database
 */
export function closeTestDatabase(): void {
  if (testDb) {
    testDb.close()
    testDb = null
  }
}

/**
 * Clear all data from test database (but keep schema)
 */
export function clearTestDatabase(): void {
  if (!testDb) return

  const tables = testDb.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table'
      AND name NOT LIKE 'sqlite_%'
      AND name NOT LIKE '%_fts%'
  `).all() as { name: string }[]

  for (const { name } of tables) {
    testDb.exec(`DELETE FROM ${name}`)
  }
}

/**
 * Seed test database with sample data
 */
export function seedTestDatabase(): void {
  const db = getTestDatabase()
  const now = new Date().toISOString()

  // Insert test user
  db.prepare(`
    INSERT INTO users (id, username, password_hash, display_name, role, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('test-user-id', 'testuser', 'hashed_password', 'Test User', 'admin', 1, now, now)

  // Insert test topic
  db.prepare(`
    INSERT INTO topics (id, title, description, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('test-topic-id', 'Test Topic', 'A test topic', 'active', now, now)

  // Insert test authority
  db.prepare(`
    INSERT INTO authorities (id, name, type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('test-authority-id', 'Test Authority', 'external', now, now)

  // Insert test record
  db.prepare(`
    INSERT INTO records (id, topic_id, title, content, record_date, status, priority, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('test-record-id', 'test-topic-id', 'Test Record', 'Test content', now.split('T')[0], 'pending', 'medium', now, now)

  // Insert test letter
  db.prepare(`
    INSERT INTO letters (id, letter_id, authority_id, type, subject, letter_date, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('test-letter-internal-id', 'TEST-001', 'test-authority-id', 'incoming', 'Test Letter', now.split('T')[0], 'pending', now, now)
}

/**
 * Mock the database connection module
 */
export function mockDatabaseConnection(): void {
  vi.mock('@main/database/connection', () => ({
    getDatabase: vi.fn(() => getTestDatabase()),
    closeDatabase: vi.fn(() => closeTestDatabase()),
    refreshDatabase: vi.fn()
  }))
}

/**
 * Create test fixtures
 */
export const testFixtures = {
  user: {
    id: 'test-user-id',
    username: 'testuser',
    display_name: 'Test User',
    role: 'admin' as const,
    is_active: true
  },
  topic: {
    id: 'test-topic-id',
    title: 'Test Topic',
    description: 'A test topic',
    status: 'active' as const
  },
  record: {
    id: 'test-record-id',
    topic_id: 'test-topic-id',
    title: 'Test Record',
    content: 'Test content',
    status: 'pending' as const,
    priority: 'medium' as const
  },
  authority: {
    id: 'test-authority-id',
    name: 'Test Authority',
    type: 'external' as const
  },
  letter: {
    id: 'test-letter-internal-id',
    letter_id: 'TEST-001',
    authority_id: 'test-authority-id',
    type: 'incoming' as const,
    subject: 'Test Letter',
    status: 'pending' as const
  }
}
