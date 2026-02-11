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
  },
  {
    version: 9,
    name: 'add_app_settings',
    up: (db: ReturnType<typeof getDatabase>) => {
      // Create app_settings key-value table
      db.exec(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_by TEXT,
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (updated_by) REFERENCES users(id)
        )
      `)

      // Seed default settings
      const defaults = [
        { key: 'department_name', value: '' },
        { key: 'theme', value: 'light' },
        { key: 'default_view', value: '/topics' },
        { key: 'date_format', value: 'DD/MM/YYYY' }
      ]

      const insert = db.prepare(
        'INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)'
      )

      for (const setting of defaults) {
        insert.run(setting.key, setting.value)
      }
    }
  },
  {
    version: 10,
    name: 'add_view_mode_and_issue_history_records',
    up: (db: ReturnType<typeof getDatabase>) => {
      // Add default_view_mode setting
      db.prepare(
        'INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)'
      ).run('default_view_mode', 'card')

      // Junction table: link issue history entries to records
      db.exec(`
        CREATE TABLE IF NOT EXISTS issue_history_records (
          history_id TEXT NOT NULL,
          record_id TEXT NOT NULL,
          PRIMARY KEY (history_id, record_id),
          FOREIGN KEY (history_id) REFERENCES issue_history(id) ON DELETE CASCADE,
          FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
        )
      `)

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_issue_history_records_history ON issue_history_records(history_id);
        CREATE INDEX IF NOT EXISTS idx_issue_history_records_record ON issue_history_records(record_id);
      `)
    }
  },
  {
    version: 11,
    name: 'add_comment_edits_table',
    up: (db: ReturnType<typeof getDatabase>) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS comment_edits (
          id TEXT PRIMARY KEY,
          history_id TEXT NOT NULL,
          old_comment TEXT NOT NULL,
          edited_by TEXT NOT NULL,
          edited_at TEXT NOT NULL,
          FOREIGN KEY (history_id) REFERENCES issue_history(id) ON DELETE CASCADE,
          FOREIGN KEY (edited_by) REFERENCES users(id)
        )
      `)

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_comment_edits_history ON comment_edits(history_id)
      `)
    }
  },
  {
    version: 12,
    name: 'add_attendance_module',
    up: (db: ReturnType<typeof getDatabase>) => {
      // Configurable attendance conditions
      db.exec(`
        CREATE TABLE IF NOT EXISTS attendance_conditions (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          color TEXT NOT NULL DEFAULT '#6B7280',
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          deleted_at TEXT,
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `)

      // One row per person per day
      db.exec(`
        CREATE TABLE IF NOT EXISTS attendance_entries (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          entry_date TEXT NOT NULL,
          year INTEGER NOT NULL,
          month INTEGER NOT NULL,
          day INTEGER NOT NULL,
          shift TEXT DEFAULT 'first',
          note TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (created_by) REFERENCES users(id),
          UNIQUE(user_id, entry_date)
        )
      `)

      // Junction: multiple conditions per entry
      db.exec(`
        CREATE TABLE IF NOT EXISTS attendance_entry_conditions (
          entry_id TEXT NOT NULL,
          condition_id TEXT NOT NULL,
          PRIMARY KEY (entry_id, condition_id),
          FOREIGN KEY (entry_id) REFERENCES attendance_entries(id) ON DELETE CASCADE,
          FOREIGN KEY (condition_id) REFERENCES attendance_conditions(id) ON DELETE CASCADE
        )
      `)

      // Indexes
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_attendance_conditions_deleted ON attendance_conditions(deleted_at);
        CREATE INDEX IF NOT EXISTS idx_attendance_conditions_sort ON attendance_conditions(sort_order);
        CREATE INDEX IF NOT EXISTS idx_attendance_entries_user ON attendance_entries(user_id);
        CREATE INDEX IF NOT EXISTS idx_attendance_entries_date ON attendance_entries(entry_date);
        CREATE INDEX IF NOT EXISTS idx_attendance_entries_year ON attendance_entries(year);
        CREATE INDEX IF NOT EXISTS idx_attendance_entries_user_year ON attendance_entries(user_id, year);
        CREATE INDEX IF NOT EXISTS idx_attendance_entries_shift ON attendance_entries(shift);
        CREATE INDEX IF NOT EXISTS idx_attendance_entry_conditions_entry ON attendance_entry_conditions(entry_id);
        CREATE INDEX IF NOT EXISTS idx_attendance_entry_conditions_condition ON attendance_entry_conditions(condition_id);
      `)

      // Seed weekend days setting
      db.prepare(
        'INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)'
      ).run('weekend_days', '[5,6]')
    }
  },
  {
    version: 13,
    name: 'attendance_shifts_and_enhancements',
    up: (db: ReturnType<typeof getDatabase>) => {
      // 1. Create shifts table
      db.exec(`
        CREATE TABLE IF NOT EXISTS shifts (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          deleted_at TEXT,
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `)
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_shifts_deleted ON shifts(deleted_at);
        CREATE INDEX IF NOT EXISTS idx_shifts_sort ON shifts(sort_order);
      `)

      // 2. ALTER users: add employee_number and shift_id
      const userInfo = db.prepare("PRAGMA table_info(users)").all() as { name: string }[]
      if (!userInfo.some(c => c.name === 'employee_number')) {
        db.exec(`ALTER TABLE users ADD COLUMN employee_number TEXT`)
      }
      if (!userInfo.some(c => c.name === 'shift_id')) {
        db.exec(`ALTER TABLE users ADD COLUMN shift_id TEXT REFERENCES shifts(id)`)
      }

      // 3. ALTER attendance_conditions: add display_number
      const condInfo = db.prepare("PRAGMA table_info(attendance_conditions)").all() as { name: string }[]
      if (!condInfo.some(c => c.name === 'display_number')) {
        db.exec(`ALTER TABLE attendance_conditions ADD COLUMN display_number INTEGER NOT NULL DEFAULT 0`)
      }

      // 4. ALTER attendance_entries: add shift_id
      const entryInfo = db.prepare("PRAGMA table_info(attendance_entries)").all() as { name: string }[]
      if (!entryInfo.some(c => c.name === 'shift_id')) {
        db.exec(`ALTER TABLE attendance_entries ADD COLUMN shift_id TEXT REFERENCES shifts(id)`)
      }

      // 5. Backfill display_number on existing conditions
      db.exec(`
        UPDATE attendance_conditions SET display_number = sort_order + 1 WHERE display_number = 0
      `)

      // 6. Create two default shifts
      const crypto = require('crypto')
      const firstShiftId = crypto.randomUUID()
      const secondShiftId = crypto.randomUUID()

      // Get any admin user for created_by
      const adminUser = db.prepare(
        "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
      ).get() as { id: string } | undefined
      const creatorId = adminUser?.id || 'system'

      db.prepare(`
        INSERT INTO shifts (id, name, sort_order, created_by) VALUES (?, ?, ?, ?)
      `).run(firstShiftId, 'First Shift', 0, creatorId)

      db.prepare(`
        INSERT INTO shifts (id, name, sort_order, created_by) VALUES (?, ?, ?, ?)
      `).run(secondShiftId, 'Second Shift', 1, creatorId)

      // 7. Map existing entries: shift='first' -> firstShiftId, shift='second' -> secondShiftId
      db.prepare(`
        UPDATE attendance_entries SET shift_id = ? WHERE shift = 'first' OR shift IS NULL
      `).run(firstShiftId)

      db.prepare(`
        UPDATE attendance_entries SET shift_id = ? WHERE shift = 'second'
      `).run(secondShiftId)

      // 8. Assign all existing users to the first default shift
      db.prepare(`
        UPDATE users SET shift_id = ? WHERE shift_id IS NULL
      `).run(firstShiftId)

      // 9. Cleanup: remove weekend_days setting
      db.exec(`DELETE FROM app_settings WHERE key = 'weekend_days'`)
    }
  },
  {
    version: 14,
    name: 'add_mom_module',
    up: (db: ReturnType<typeof getDatabase>) => {
      // 1. mom_locations - Predefined meeting locations
      db.exec(`
        CREATE TABLE IF NOT EXISTS mom_locations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          deleted_at TEXT,
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `)

      // 2. moms - Main MOM entity
      db.exec(`
        CREATE TABLE IF NOT EXISTS moms (
          id TEXT PRIMARY KEY,
          mom_id TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          subject TEXT,
          meeting_date TEXT,
          location_id TEXT,
          status TEXT NOT NULL DEFAULT 'open',
          storage_path TEXT,
          original_filename TEXT,
          file_type TEXT,
          file_size INTEGER,
          checksum TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          deleted_at TEXT,
          FOREIGN KEY (location_id) REFERENCES mom_locations(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `)

      // 3. mom_actions - Actions within a MOM
      db.exec(`
        CREATE TABLE IF NOT EXISTS mom_actions (
          id TEXT PRIMARY KEY,
          mom_internal_id TEXT NOT NULL,
          description TEXT NOT NULL,
          responsible_party TEXT,
          deadline TEXT,
          reminder_date TEXT,
          reminder_notified INTEGER DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'open',
          resolution_note TEXT,
          resolution_file_path TEXT,
          resolution_filename TEXT,
          resolution_file_size INTEGER,
          resolved_by TEXT,
          resolved_at TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (mom_internal_id) REFERENCES moms(id),
          FOREIGN KEY (resolved_by) REFERENCES users(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `)

      // 4. mom_topic_links - Junction: MOM <-> Topics
      db.exec(`
        CREATE TABLE IF NOT EXISTS mom_topic_links (
          id TEXT PRIMARY KEY,
          mom_internal_id TEXT NOT NULL,
          topic_id TEXT NOT NULL,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (mom_internal_id) REFERENCES moms(id),
          FOREIGN KEY (topic_id) REFERENCES topics(id),
          FOREIGN KEY (created_by) REFERENCES users(id),
          UNIQUE(mom_internal_id, topic_id)
        )
      `)

      // 5. mom_record_links - Junction: MOM <-> Records
      db.exec(`
        CREATE TABLE IF NOT EXISTS mom_record_links (
          id TEXT PRIMARY KEY,
          mom_internal_id TEXT NOT NULL,
          record_id TEXT NOT NULL,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (mom_internal_id) REFERENCES moms(id),
          FOREIGN KEY (record_id) REFERENCES records(id),
          FOREIGN KEY (created_by) REFERENCES users(id),
          UNIQUE(mom_internal_id, record_id)
        )
      `)

      // 6. mom_drafts - Draft versions
      db.exec(`
        CREATE TABLE IF NOT EXISTS mom_drafts (
          id TEXT PRIMARY KEY,
          mom_internal_id TEXT NOT NULL,
          version INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          storage_path TEXT,
          original_filename TEXT,
          file_type TEXT,
          file_size INTEGER,
          checksum TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          deleted_at TEXT,
          FOREIGN KEY (mom_internal_id) REFERENCES moms(id),
          FOREIGN KEY (created_by) REFERENCES users(id),
          UNIQUE(mom_internal_id, version)
        )
      `)

      // 7. mom_history - Immutable append-only log
      db.exec(`
        CREATE TABLE IF NOT EXISTS mom_history (
          id TEXT PRIMARY KEY,
          mom_internal_id TEXT NOT NULL,
          action TEXT NOT NULL,
          field_name TEXT,
          old_value TEXT,
          new_value TEXT,
          details TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (mom_internal_id) REFERENCES moms(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `)

      // 8. Indexes
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_moms_mom_id ON moms(mom_id);
        CREATE INDEX IF NOT EXISTS idx_moms_status ON moms(status);
        CREATE INDEX IF NOT EXISTS idx_moms_meeting_date ON moms(meeting_date);
        CREATE INDEX IF NOT EXISTS idx_moms_location_id ON moms(location_id);
        CREATE INDEX IF NOT EXISTS idx_moms_created_by ON moms(created_by);
        CREATE INDEX IF NOT EXISTS idx_moms_deleted_at ON moms(deleted_at);

        CREATE INDEX IF NOT EXISTS idx_mom_actions_mom ON mom_actions(mom_internal_id);
        CREATE INDEX IF NOT EXISTS idx_mom_actions_status ON mom_actions(status);
        CREATE INDEX IF NOT EXISTS idx_mom_actions_deadline ON mom_actions(deadline);
        CREATE INDEX IF NOT EXISTS idx_mom_actions_reminder ON mom_actions(reminder_date);
        CREATE INDEX IF NOT EXISTS idx_mom_topic_links_mom ON mom_topic_links(mom_internal_id);
        CREATE INDEX IF NOT EXISTS idx_mom_topic_links_topic ON mom_topic_links(topic_id);

        CREATE INDEX IF NOT EXISTS idx_mom_record_links_mom ON mom_record_links(mom_internal_id);
        CREATE INDEX IF NOT EXISTS idx_mom_record_links_record ON mom_record_links(record_id);

        CREATE INDEX IF NOT EXISTS idx_mom_drafts_mom ON mom_drafts(mom_internal_id);
        CREATE INDEX IF NOT EXISTS idx_mom_drafts_version ON mom_drafts(mom_internal_id, version);
        CREATE INDEX IF NOT EXISTS idx_mom_drafts_deleted ON mom_drafts(deleted_at);

        CREATE INDEX IF NOT EXISTS idx_mom_history_mom ON mom_history(mom_internal_id);
        CREATE INDEX IF NOT EXISTS idx_mom_history_action ON mom_history(action);
        CREATE INDEX IF NOT EXISTS idx_mom_history_created ON mom_history(created_at);

        CREATE INDEX IF NOT EXISTS idx_mom_locations_deleted ON mom_locations(deleted_at);
        CREATE INDEX IF NOT EXISTS idx_mom_locations_sort ON mom_locations(sort_order);
      `)

      // 9. FTS5 for moms
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS moms_fts USING fts5(
          mom_id,
          title,
          subject,
          content='moms',
          content_rowid='rowid'
        )
      `)

      // 10. FTS sync triggers
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS moms_ai AFTER INSERT ON moms BEGIN
          INSERT INTO moms_fts(rowid, mom_id, title, subject)
          VALUES (NEW.rowid, NEW.mom_id, NEW.title, NEW.subject);
        END
      `)

      db.exec(`
        CREATE TRIGGER IF NOT EXISTS moms_ad AFTER DELETE ON moms BEGIN
          INSERT INTO moms_fts(moms_fts, rowid, mom_id, title, subject)
          VALUES('delete', OLD.rowid, OLD.mom_id, OLD.title, OLD.subject);
        END
      `)

      db.exec(`
        CREATE TRIGGER IF NOT EXISTS moms_au AFTER UPDATE ON moms BEGIN
          INSERT INTO moms_fts(moms_fts, rowid, mom_id, title, subject)
          VALUES('delete', OLD.rowid, OLD.mom_id, OLD.title, OLD.subject);
          INSERT INTO moms_fts(rowid, mom_id, title, subject)
          VALUES (NEW.rowid, NEW.mom_id, NEW.title, NEW.subject);
        END
      `)
    }
  },
  {
    version: 15,
    name: 'add_mom_letter_linking',
    up: (db: ReturnType<typeof getDatabase>) => {
      // 1. Add letter_id column to letters table
      const letterInfo = db.prepare("PRAGMA table_info(letters)").all() as { name: string }[]
      if (!letterInfo.some(c => c.name === 'letter_id')) {
        db.exec(`ALTER TABLE letters ADD COLUMN letter_id TEXT`)
      }
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_letters_letter_id ON letters(letter_id)`)

      // 2. Make mom_id nullable via table rebuild
      // SQLite doesn't support ALTER COLUMN, so rebuild the table
      db.exec(`
        CREATE TABLE IF NOT EXISTS moms_new (
          id TEXT PRIMARY KEY,
          mom_id TEXT UNIQUE,
          title TEXT NOT NULL,
          subject TEXT,
          meeting_date TEXT,
          location_id TEXT,
          status TEXT NOT NULL DEFAULT 'open',
          storage_path TEXT,
          original_filename TEXT,
          file_type TEXT,
          file_size INTEGER,
          checksum TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          deleted_at TEXT,
          FOREIGN KEY (location_id) REFERENCES mom_locations(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `)

      db.exec(`
        INSERT INTO moms_new SELECT * FROM moms
      `)

      // Drop old FTS triggers before dropping table
      db.exec(`DROP TRIGGER IF EXISTS moms_ai`)
      db.exec(`DROP TRIGGER IF EXISTS moms_ad`)
      db.exec(`DROP TRIGGER IF EXISTS moms_au`)

      // Drop old FTS table
      db.exec(`DROP TABLE IF EXISTS moms_fts`)

      db.exec(`DROP TABLE IF EXISTS moms`)
      db.exec(`ALTER TABLE moms_new RENAME TO moms`)

      // Recreate indexes
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_moms_mom_id ON moms(mom_id);
        CREATE INDEX IF NOT EXISTS idx_moms_status ON moms(status);
        CREATE INDEX IF NOT EXISTS idx_moms_meeting_date ON moms(meeting_date);
        CREATE INDEX IF NOT EXISTS idx_moms_location_id ON moms(location_id);
        CREATE INDEX IF NOT EXISTS idx_moms_created_by ON moms(created_by);
        CREATE INDEX IF NOT EXISTS idx_moms_deleted_at ON moms(deleted_at);
      `)

      // Recreate FTS table
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS moms_fts USING fts5(
          mom_id,
          title,
          subject,
          content='moms',
          content_rowid='rowid'
        )
      `)

      // Rebuild FTS index from existing data
      db.exec(`
        INSERT INTO moms_fts(rowid, mom_id, title, subject)
        SELECT rowid, mom_id, title, subject FROM moms
      `)

      // Recreate FTS sync triggers
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS moms_ai AFTER INSERT ON moms BEGIN
          INSERT INTO moms_fts(rowid, mom_id, title, subject)
          VALUES (NEW.rowid, NEW.mom_id, NEW.title, NEW.subject);
        END
      `)

      db.exec(`
        CREATE TRIGGER IF NOT EXISTS moms_ad AFTER DELETE ON moms BEGIN
          INSERT INTO moms_fts(moms_fts, rowid, mom_id, title, subject)
          VALUES('delete', OLD.rowid, OLD.mom_id, OLD.title, OLD.subject);
        END
      `)

      db.exec(`
        CREATE TRIGGER IF NOT EXISTS moms_au AFTER UPDATE ON moms BEGIN
          INSERT INTO moms_fts(moms_fts, rowid, mom_id, title, subject)
          VALUES('delete', OLD.rowid, OLD.mom_id, OLD.title, OLD.subject);
          INSERT INTO moms_fts(rowid, mom_id, title, subject)
          VALUES (NEW.rowid, NEW.mom_id, NEW.title, NEW.subject);
        END
      `)

      // 3. Create mom_letter_links junction table
      db.exec(`
        CREATE TABLE IF NOT EXISTS mom_letter_links (
          id TEXT PRIMARY KEY,
          mom_internal_id TEXT NOT NULL,
          letter_id TEXT NOT NULL,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (mom_internal_id) REFERENCES moms(id),
          FOREIGN KEY (letter_id) REFERENCES letters(id),
          FOREIGN KEY (created_by) REFERENCES users(id),
          UNIQUE(mom_internal_id, letter_id)
        )
      `)

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_mom_letter_links_mom ON mom_letter_links(mom_internal_id);
        CREATE INDEX IF NOT EXISTS idx_mom_letter_links_letter ON mom_letter_links(letter_id);
      `)

      // 4. Update letters_fts triggers to include letter_id
      db.exec(`DROP TRIGGER IF EXISTS letters_ai`)
      db.exec(`DROP TRIGGER IF EXISTS letters_ad`)
      db.exec(`DROP TRIGGER IF EXISTS letters_au`)
      db.exec(`DROP TABLE IF EXISTS letters_fts`)

      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS letters_fts USING fts5(
          subject,
          summary,
          content,
          reference_number,
          incoming_number,
          outgoing_number,
          letter_id,
          content='letters',
          content_rowid='rowid'
        )
      `)

      // Rebuild FTS from existing data
      db.exec(`
        INSERT INTO letters_fts(rowid, subject, summary, content, reference_number, incoming_number, outgoing_number, letter_id)
        SELECT rowid, subject, summary, content, reference_number, incoming_number, outgoing_number, letter_id FROM letters
      `)

      db.exec(`
        CREATE TRIGGER IF NOT EXISTS letters_ai AFTER INSERT ON letters BEGIN
          INSERT INTO letters_fts(rowid, subject, summary, content, reference_number, incoming_number, outgoing_number, letter_id)
          VALUES (NEW.rowid, NEW.subject, NEW.summary, NEW.content, NEW.reference_number, NEW.incoming_number, NEW.outgoing_number, NEW.letter_id);
        END
      `)

      db.exec(`
        CREATE TRIGGER IF NOT EXISTS letters_ad AFTER DELETE ON letters BEGIN
          INSERT INTO letters_fts(letters_fts, rowid, subject, summary, content, reference_number, incoming_number, outgoing_number, letter_id)
          VALUES('delete', OLD.rowid, OLD.subject, OLD.summary, OLD.content, OLD.reference_number, OLD.incoming_number, OLD.outgoing_number, OLD.letter_id);
        END
      `)

      db.exec(`
        CREATE TRIGGER IF NOT EXISTS letters_au AFTER UPDATE ON letters BEGIN
          INSERT INTO letters_fts(letters_fts, rowid, subject, summary, content, reference_number, incoming_number, outgoing_number, letter_id)
          VALUES('delete', OLD.rowid, OLD.subject, OLD.summary, OLD.content, OLD.reference_number, OLD.incoming_number, OLD.outgoing_number, OLD.letter_id);
          INSERT INTO letters_fts(rowid, subject, summary, content, reference_number, incoming_number, outgoing_number, letter_id)
          VALUES (NEW.rowid, NEW.subject, NEW.summary, NEW.content, NEW.reference_number, NEW.incoming_number, NEW.outgoing_number, NEW.letter_id);
        END
      `)
    }
  },
  {
    version: 16,
    name: 'add_handover_start_day_setting',
    up: (db: ReturnType<typeof getDatabase>) => {
      // Add handover_start_day setting (default: Monday = 1)
      // Values: 0 = Sunday, 1 = Monday, ... 6 = Saturday
      db.prepare(
        'INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)'
      ).run('handover_start_day', '1')
    }
  },
  {
    version: 17,
    name: 'letters_redesign',
    up: (db: ReturnType<typeof getDatabase>) => {
      // 1. Add is_internal flag to authorities table
      const authInfo = db.prepare("PRAGMA table_info(authorities)").all() as { name: string }[]
      if (!authInfo.some(c => c.name === 'is_internal')) {
        db.exec(`ALTER TABLE authorities ADD COLUMN is_internal INTEGER NOT NULL DEFAULT 0`)
      }

      // 2. Create contacts table for external letter addressees (Att field)
      db.exec(`
        CREATE TABLE IF NOT EXISTS contacts (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          title TEXT,
          authority_id TEXT,
          email TEXT,
          phone TEXT,
          notes TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          deleted_at TEXT,
          FOREIGN KEY (authority_id) REFERENCES authorities(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `)

      // 3. Create indexes for contacts
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
        CREATE INDEX IF NOT EXISTS idx_contacts_authority ON contacts(authority_id);
        CREATE INDEX IF NOT EXISTS idx_contacts_deleted ON contacts(deleted_at);
      `)

      // 4. Add contact_id to letters table for external letters (addressee)
      const letterInfo = db.prepare("PRAGMA table_info(letters)").all() as { name: string }[]
      if (!letterInfo.some(c => c.name === 'contact_id')) {
        db.exec(`ALTER TABLE letters ADD COLUMN contact_id TEXT REFERENCES contacts(id)`)
      }

      // 5. Add index for contact_id
      db.exec(`CREATE INDEX IF NOT EXISTS idx_letters_contact ON letters(contact_id)`)

      // 6. Update existing authorities: set is_internal=1 for type='internal'
      db.exec(`UPDATE authorities SET is_internal = 1 WHERE type = 'internal'`)
    }
  },
  {
    version: 18,
    name: 'add_letter_is_notification',
    up: (db) => {
      // Add is_notification column to letters table for internal notification letters
      const letterInfo = db.prepare("PRAGMA table_info(letters)").all() as { name: string }[]
      if (!letterInfo.some(c => c.name === 'is_notification')) {
        db.exec(`ALTER TABLE letters ADD COLUMN is_notification INTEGER DEFAULT 0`)
      }
    }
  },
  {
    version: 19,
    name: 'fix_authority_is_internal',
    up: (db) => {
      // Fix all NULL is_internal values based on type field
      db.exec(`UPDATE authorities SET is_internal = 1 WHERE type = 'internal' AND (is_internal IS NULL OR is_internal != 1)`)
      db.exec(`UPDATE authorities SET is_internal = 0 WHERE type != 'internal' AND (is_internal IS NULL OR is_internal != 0)`)
      // Set default for future inserts
      db.exec(`UPDATE authorities SET is_internal = 0 WHERE is_internal IS NULL`)
    }
  },
  {
    version: 20,
    name: 'add_attendance_condition_is_ignored',
    up: (db) => {
      const tableInfo = db.prepare("PRAGMA table_info(attendance_conditions)").all() as { name: string }[]
      if (!tableInfo.some(c => c.name === 'is_ignored')) {
        db.exec(`ALTER TABLE attendance_conditions ADD COLUMN is_ignored INTEGER DEFAULT 0`)
      }
    }
  },
  {
    version: 21,
    name: 'add_login_animation_speed_setting',
    up: (db) => {
      // Add login_animation_speed setting (default: 4x speed)
      db.prepare(
        'INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)'
      ).run('login_animation_speed', '4')
    }
  },
  {
    version: 22,
    name: 'add_login_background_style_setting',
    up: (db) => {
      // Add login_background_style setting (default: atom)
      db.prepare(
        'INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)'
      ).run('login_background_style', 'atom')
    }
  },
  {
    version: 23,
    name: 'add_user_deleted_at',
    up: (db) => {
      // Add deleted_at column to users table for soft deletion
      const tableInfo = db.prepare("PRAGMA table_info(users)").all() as { name: string }[]
      if (!tableInfo.some(c => c.name === 'deleted_at')) {
        db.exec(`ALTER TABLE users ADD COLUMN deleted_at TEXT`)
      }
      db.exec(`CREATE INDEX IF NOT EXISTS idx_users_deleted ON users(deleted_at)`)
    }
  },
  {
    version: 24,
    name: 'add_shift_duration_setting',
    up: (db) => {
      // Add shift_duration setting (default: 7 days per shift)
      db.prepare(
        'INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)'
      ).run('shift_duration', '7')
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

  if (pendingMigrations.length > 0) {
    // Disable foreign key enforcement during migrations (required for table rebuilds).
    // PRAGMA foreign_keys cannot be changed inside a transaction, so we set it here.
    db.pragma('foreign_keys = OFF')
  }

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
      db.pragma('foreign_keys = ON')
      throw error
    }
  }

  if (pendingMigrations.length > 0) {
    db.pragma('foreign_keys = ON')

    // Verify FK integrity after migrations
    const fkErrors = db.pragma('foreign_key_check') as any[]
    if (fkErrors.length > 0) {
      console.warn('Foreign key violations found after migrations:', fkErrors)
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
