import { getDatabase } from './connection'

interface Migration {
  version: number
  name: string
  up: (db: ReturnType<typeof getDatabase>) => void
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: () => {
      // Initial schema is created in schema.ts
      // This migration exists for version tracking
    }
  },
  {
    version: 2,
    name: 'add_topic_tags',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          color TEXT DEFAULT '#6B7280',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `)

      db.exec(`
        CREATE TABLE IF NOT EXISTS topic_tags (
          topic_id TEXT NOT NULL,
          tag_id TEXT NOT NULL,
          PRIMARY KEY (topic_id, tag_id),
          FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        )
      `)
    }
  },
  {
    version: 3,
    name: 'add_email_body_preview',
    up: (db) => {
      // Check if column exists before adding
      const tableInfo = db.prepare("PRAGMA table_info(emails)").all() as { name: string }[]
      const hasColumn = tableInfo.some(col => col.name === 'body_preview')

      if (!hasColumn) {
        db.exec(`
          ALTER TABLE emails ADD COLUMN body_preview TEXT
        `)
      }
    }
  },
  {
    version: 4,
    name: 'add_record_attachments',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS record_attachments (
          id TEXT PRIMARY KEY,
          record_id TEXT NOT NULL,
          filename TEXT NOT NULL,
          filepath TEXT NOT NULL,
          file_size INTEGER,
          mime_type TEXT,
          checksum TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
        )
      `)

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_record_attachments_record_id
        ON record_attachments(record_id)
      `)
    }
  },
  {
    version: 5,
    name: 'add_subcategories',
    up: (db) => {
      // Create subcategories table
      db.exec(`
        CREATE TABLE IF NOT EXISTS subcategories (
          id TEXT PRIMARY KEY,
          topic_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          deleted_at TEXT,
          FOREIGN KEY (topic_id) REFERENCES topics(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `)

      // Add subcategory_id column to records table
      const tableInfo = db.prepare("PRAGMA table_info(records)").all() as { name: string }[]
      const hasColumn = tableInfo.some(col => col.name === 'subcategory_id')

      if (!hasColumn) {
        db.exec(`
          ALTER TABLE records ADD COLUMN subcategory_id TEXT REFERENCES subcategories(id)
        `)
      }

      // Create indexes
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_subcategories_topic_id ON subcategories(topic_id);
        CREATE INDEX IF NOT EXISTS idx_subcategories_created_by ON subcategories(created_by);
        CREATE INDEX IF NOT EXISTS idx_records_subcategory_id ON records(subcategory_id);
      `)
    }
  },
  {
    version: 6,
    name: 'add_letters_module',
    up: (db) => {
      // 1. Create authorities table
      db.exec(`
        CREATE TABLE IF NOT EXISTS authorities (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          short_name TEXT,
          type TEXT DEFAULT 'external',
          address TEXT,
          contact_email TEXT,
          contact_phone TEXT,
          notes TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          deleted_at TEXT,
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `)

      // 2. Create letters table
      db.exec(`
        CREATE TABLE IF NOT EXISTS letters (
          id TEXT PRIMARY KEY,
          letter_type TEXT NOT NULL,
          response_type TEXT,
          status TEXT DEFAULT 'pending',
          priority TEXT DEFAULT 'normal',
          incoming_number TEXT,
          outgoing_number TEXT,
          reference_number TEXT,
          subject TEXT NOT NULL,
          summary TEXT,
          content TEXT,
          authority_id TEXT,
          topic_id TEXT NOT NULL,
          subcategory_id TEXT,
          parent_letter_id TEXT,
          storage_path TEXT,
          original_filename TEXT,
          file_type TEXT,
          file_size INTEGER,
          checksum TEXT,
          outlook_entry_id TEXT,
          outlook_store_id TEXT,
          email_id TEXT,
          letter_date TEXT,
          received_date TEXT,
          due_date TEXT,
          responded_date TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          deleted_at TEXT,
          FOREIGN KEY (authority_id) REFERENCES authorities(id),
          FOREIGN KEY (topic_id) REFERENCES topics(id),
          FOREIGN KEY (subcategory_id) REFERENCES subcategories(id),
          FOREIGN KEY (parent_letter_id) REFERENCES letters(id),
          FOREIGN KEY (email_id) REFERENCES emails(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `)

      // 3. Create letter_drafts table
      db.exec(`
        CREATE TABLE IF NOT EXISTS letter_drafts (
          id TEXT PRIMARY KEY,
          letter_id TEXT NOT NULL,
          version INTEGER NOT NULL,
          title TEXT NOT NULL,
          content TEXT,
          notes TEXT,
          storage_path TEXT,
          original_filename TEXT,
          file_type TEXT,
          file_size INTEGER,
          checksum TEXT,
          status TEXT DEFAULT 'draft',
          is_final INTEGER DEFAULT 0,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          deleted_at TEXT,
          FOREIGN KEY (letter_id) REFERENCES letters(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(id),
          UNIQUE(letter_id, version)
        )
      `)

      // 4. Create letter_references table
      db.exec(`
        CREATE TABLE IF NOT EXISTS letter_references (
          id TEXT PRIMARY KEY,
          source_letter_id TEXT NOT NULL,
          target_letter_id TEXT NOT NULL,
          reference_type TEXT DEFAULT 'related',
          notes TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (source_letter_id) REFERENCES letters(id) ON DELETE CASCADE,
          FOREIGN KEY (target_letter_id) REFERENCES letters(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(id),
          UNIQUE(source_letter_id, target_letter_id)
        )
      `)

      // 5. Create letter_attachments table
      db.exec(`
        CREATE TABLE IF NOT EXISTS letter_attachments (
          id TEXT PRIMARY KEY,
          letter_id TEXT NOT NULL,
          draft_id TEXT,
          filename TEXT NOT NULL,
          file_type TEXT,
          file_size INTEGER,
          storage_path TEXT NOT NULL,
          checksum TEXT,
          description TEXT,
          is_original INTEGER DEFAULT 1,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          deleted_at TEXT,
          FOREIGN KEY (letter_id) REFERENCES letters(id) ON DELETE CASCADE,
          FOREIGN KEY (draft_id) REFERENCES letter_drafts(id) ON DELETE SET NULL,
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `)

      // 6. Create indexes
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_authorities_name ON authorities(name);
        CREATE INDEX IF NOT EXISTS idx_authorities_type ON authorities(type);
        CREATE INDEX IF NOT EXISTS idx_authorities_deleted ON authorities(deleted_at);

        CREATE INDEX IF NOT EXISTS idx_letters_topic ON letters(topic_id);
        CREATE INDEX IF NOT EXISTS idx_letters_authority ON letters(authority_id);
        CREATE INDEX IF NOT EXISTS idx_letters_type ON letters(letter_type);
        CREATE INDEX IF NOT EXISTS idx_letters_status ON letters(status);
        CREATE INDEX IF NOT EXISTS idx_letters_reference ON letters(reference_number);
        CREATE INDEX IF NOT EXISTS idx_letters_incoming ON letters(incoming_number);
        CREATE INDEX IF NOT EXISTS idx_letters_outgoing ON letters(outgoing_number);
        CREATE INDEX IF NOT EXISTS idx_letters_parent ON letters(parent_letter_id);
        CREATE INDEX IF NOT EXISTS idx_letters_dates ON letters(letter_date, received_date, due_date);
        CREATE INDEX IF NOT EXISTS idx_letters_deleted ON letters(deleted_at);

        CREATE INDEX IF NOT EXISTS idx_drafts_letter ON letter_drafts(letter_id);
        CREATE INDEX IF NOT EXISTS idx_drafts_version ON letter_drafts(letter_id, version);
        CREATE INDEX IF NOT EXISTS idx_drafts_status ON letter_drafts(status);
        CREATE INDEX IF NOT EXISTS idx_drafts_deleted ON letter_drafts(deleted_at);

        CREATE INDEX IF NOT EXISTS idx_letter_refs_source ON letter_references(source_letter_id);
        CREATE INDEX IF NOT EXISTS idx_letter_refs_target ON letter_references(target_letter_id);
        CREATE INDEX IF NOT EXISTS idx_letter_refs_type ON letter_references(reference_type);

        CREATE INDEX IF NOT EXISTS idx_letter_attachments_letter ON letter_attachments(letter_id);
        CREATE INDEX IF NOT EXISTS idx_letter_attachments_draft ON letter_attachments(draft_id);
        CREATE INDEX IF NOT EXISTS idx_letter_attachments_deleted ON letter_attachments(deleted_at);
      `)

      // 7. Create FTS table for letters
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS letters_fts USING fts5(
          subject,
          summary,
          content,
          reference_number,
          incoming_number,
          outgoing_number,
          content='letters',
          content_rowid='rowid'
        )
      `)

      // 8. Create FTS sync triggers
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS letters_ai AFTER INSERT ON letters BEGIN
          INSERT INTO letters_fts(rowid, subject, summary, content, reference_number, incoming_number, outgoing_number)
          VALUES (NEW.rowid, NEW.subject, NEW.summary, NEW.content, NEW.reference_number, NEW.incoming_number, NEW.outgoing_number);
        END
      `)

      db.exec(`
        CREATE TRIGGER IF NOT EXISTS letters_ad AFTER DELETE ON letters BEGIN
          INSERT INTO letters_fts(letters_fts, rowid, subject, summary, content, reference_number, incoming_number, outgoing_number)
          VALUES('delete', OLD.rowid, OLD.subject, OLD.summary, OLD.content, OLD.reference_number, OLD.incoming_number, OLD.outgoing_number);
        END
      `)

      db.exec(`
        CREATE TRIGGER IF NOT EXISTS letters_au AFTER UPDATE ON letters BEGIN
          INSERT INTO letters_fts(letters_fts, rowid, subject, summary, content, reference_number, incoming_number, outgoing_number)
          VALUES('delete', OLD.rowid, OLD.subject, OLD.summary, OLD.content, OLD.reference_number, OLD.incoming_number, OLD.outgoing_number);
          INSERT INTO letters_fts(rowid, subject, summary, content, reference_number, incoming_number, outgoing_number)
          VALUES (NEW.rowid, NEW.subject, NEW.summary, NEW.content, NEW.reference_number, NEW.incoming_number, NEW.outgoing_number);
        END
      `)
    }
  },
  {
    version: 7,
    name: 'add_issues_module',
    up: (db: ReturnType<typeof getDatabase>) => {
      // 1. Create issues table
      db.exec(`
        CREATE TABLE IF NOT EXISTS issues (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          topic_id TEXT,
          subcategory_id TEXT,
          importance TEXT DEFAULT 'medium',
          status TEXT DEFAULT 'open',
          closure_note TEXT,
          completed_at TEXT,
          completed_by TEXT,
          reminder_date TEXT,
          reminder_notified INTEGER DEFAULT 0,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          linked_letter_id TEXT,
          linked_email_id TEXT,
          linked_record_id TEXT,
          FOREIGN KEY (topic_id) REFERENCES topics(id),
          FOREIGN KEY (subcategory_id) REFERENCES subcategories(id),
          FOREIGN KEY (created_by) REFERENCES users(id),
          FOREIGN KEY (completed_by) REFERENCES users(id),
          FOREIGN KEY (linked_letter_id) REFERENCES letters(id),
          FOREIGN KEY (linked_email_id) REFERENCES emails(id),
          FOREIGN KEY (linked_record_id) REFERENCES records(id)
        )
      `)

      // 2. Create issue_history table
      db.exec(`
        CREATE TABLE IF NOT EXISTS issue_history (
          id TEXT PRIMARY KEY,
          issue_id TEXT NOT NULL,
          action TEXT NOT NULL,
          field_name TEXT,
          old_value TEXT,
          new_value TEXT,
          comment TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (issue_id) REFERENCES issues(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `)

      // 3. Create indexes
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
        CREATE INDEX IF NOT EXISTS idx_issues_importance ON issues(importance);
        CREATE INDEX IF NOT EXISTS idx_issues_topic ON issues(topic_id);
        CREATE INDEX IF NOT EXISTS idx_issues_reminder ON issues(reminder_date);
        CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at);
        CREATE INDEX IF NOT EXISTS idx_issues_created_by ON issues(created_by);
        CREATE INDEX IF NOT EXISTS idx_issue_history_issue ON issue_history(issue_id);
        CREATE INDEX IF NOT EXISTS idx_issue_history_created ON issue_history(created_at);
      `)
    }
  },
  {
    version: 8,
    name: 'add_secure_resources',
    up: (db: ReturnType<typeof getDatabase>) => {
      // 1. Create credentials table
      db.exec(`
        CREATE TABLE IF NOT EXISTS credentials (
          id TEXT PRIMARY KEY,
          system_name TEXT NOT NULL,
          username TEXT NOT NULL,
          encrypted_password TEXT NOT NULL,
          password_iv TEXT NOT NULL,
          password_tag TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'Other',
          description TEXT,
          notes TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          deleted_at TEXT,
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `)

      // 2. Create secure_references table
      db.exec(`
        CREATE TABLE IF NOT EXISTS secure_references (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          category TEXT NOT NULL DEFAULT 'General',
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          deleted_at TEXT,
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `)

      // 3. Create secure_reference_files table
      db.exec(`
        CREATE TABLE IF NOT EXISTS secure_reference_files (
          id TEXT PRIMARY KEY,
          reference_id TEXT NOT NULL,
          filename TEXT NOT NULL,
          storage_path TEXT NOT NULL,
          file_type TEXT,
          file_size INTEGER,
          checksum TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          deleted_at TEXT,
          FOREIGN KEY (reference_id) REFERENCES secure_references(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `)

      // 4. Create indexes
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_credentials_system_name ON credentials(system_name);
        CREATE INDEX IF NOT EXISTS idx_credentials_category ON credentials(category);
        CREATE INDEX IF NOT EXISTS idx_credentials_deleted ON credentials(deleted_at);
        CREATE INDEX IF NOT EXISTS idx_secure_references_name ON secure_references(name);
        CREATE INDEX IF NOT EXISTS idx_secure_references_category ON secure_references(category);
        CREATE INDEX IF NOT EXISTS idx_secure_references_deleted ON secure_references(deleted_at);
        CREATE INDEX IF NOT EXISTS idx_secure_reference_files_ref ON secure_reference_files(reference_id);
        CREATE INDEX IF NOT EXISTS idx_secure_reference_files_deleted ON secure_reference_files(deleted_at);
      `)
    }
  }
]

export function initializeMigrations(): void {
  const db = getDatabase()

  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

export function getCurrentVersion(): number {
  const db = getDatabase()

  const result = db.prepare(
    'SELECT MAX(version) as version FROM schema_migrations'
  ).get() as { version: number | null }

  return result.version || 0
}

export function runMigrations(): {
  applied: string[]
  currentVersion: number
} {
  const db = getDatabase()
  initializeMigrations()

  const currentVersion = getCurrentVersion()
  const applied: string[] = []

  const pendingMigrations = migrations.filter(m => m.version > currentVersion)

  for (const migration of pendingMigrations) {
    console.log(`Running migration ${migration.version}: ${migration.name}`)

    try {
      // Run migration in transaction
      db.transaction(() => {
        migration.up(db)

        db.prepare(
          'INSERT INTO schema_migrations (version, name) VALUES (?, ?)'
        ).run(migration.version, migration.name)
      })()

      applied.push(migration.name)
      console.log(`Migration ${migration.name} applied successfully`)
    } catch (error) {
      console.error(`Migration ${migration.name} failed:`, error)
      throw error
    }
  }

  return {
    applied,
    currentVersion: getCurrentVersion()
  }
}

export function getMigrationHistory(): { version: number; name: string; applied_at: string }[] {
  const db = getDatabase()
  initializeMigrations()

  return db.prepare(
    'SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC'
  ).all() as { version: number; name: string; applied_at: string }[]
}
