import { getDatabase } from './connection'

export function initializeSchema(): void {
  const db = getDatabase()

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT
    )
  `)

  // Topics table
  db.exec(`
    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      priority TEXT DEFAULT 'normal',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `)

  // Subcategories table (optional grouping within topics)
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

  // Records table (timeline entries)
  db.exec(`
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL,
      subcategory_id TEXT,
      type TEXT NOT NULL DEFAULT 'note',
      title TEXT NOT NULL,
      content TEXT,
      email_id TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT,
      FOREIGN KEY (topic_id) REFERENCES topics(id),
      FOREIGN KEY (subcategory_id) REFERENCES subcategories(id),
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (email_id) REFERENCES emails(id)
    )
  `)

  // Emails table (archived email metadata)
  db.exec(`
    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      sender TEXT NOT NULL,
      sender_name TEXT,
      recipients TEXT NOT NULL,
      cc TEXT,
      bcc TEXT,
      sent_at TEXT,
      received_at TEXT,
      has_attachments INTEGER NOT NULL DEFAULT 0,
      attachment_count INTEGER DEFAULT 0,
      attachment_names TEXT,
      importance TEXT DEFAULT 'normal',
      outlook_entry_id TEXT,
      outlook_store_id TEXT,
      folder_path TEXT,
      storage_path TEXT NOT NULL,
      file_size INTEGER,
      checksum TEXT,
      archived_by TEXT NOT NULL,
      archived_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (archived_by) REFERENCES users(id)
    )
  `)

  // Reminders table
  db.exec(`
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      topic_id TEXT,
      record_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      due_date TEXT NOT NULL,
      priority TEXT DEFAULT 'normal',
      is_completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      completed_by TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (topic_id) REFERENCES topics(id),
      FOREIGN KEY (record_id) REFERENCES records(id),
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (completed_by) REFERENCES users(id)
    )
  `)

  // Handovers table (for shift handover reports)
  db.exec(`
    CREATE TABLE IF NOT EXISTS handovers (
      id TEXT PRIMARY KEY,
      week_number INTEGER NOT NULL,
      year INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      file_path TEXT NOT NULL,
      record_count INTEGER NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `)

  // Indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_topics_created_by ON topics(created_by);
    CREATE INDEX IF NOT EXISTS idx_topics_status ON topics(status);
    CREATE INDEX IF NOT EXISTS idx_topics_created_at ON topics(created_at);

    CREATE INDEX IF NOT EXISTS idx_subcategories_topic_id ON subcategories(topic_id);
    CREATE INDEX IF NOT EXISTS idx_subcategories_created_by ON subcategories(created_by);

    CREATE INDEX IF NOT EXISTS idx_records_topic_id ON records(topic_id);
    CREATE INDEX IF NOT EXISTS idx_records_subcategory_id ON records(subcategory_id);
    CREATE INDEX IF NOT EXISTS idx_records_created_by ON records(created_by);
    CREATE INDEX IF NOT EXISTS idx_records_created_at ON records(created_at);
    CREATE INDEX IF NOT EXISTS idx_records_type ON records(type);

    CREATE INDEX IF NOT EXISTS idx_emails_archived_by ON emails(archived_by);
    CREATE INDEX IF NOT EXISTS idx_emails_archived_at ON emails(archived_at);
    CREATE INDEX IF NOT EXISTS idx_emails_sender ON emails(sender);
    CREATE INDEX IF NOT EXISTS idx_emails_sent_at ON emails(sent_at);

    CREATE INDEX IF NOT EXISTS idx_reminders_topic_id ON reminders(topic_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON reminders(due_date);
    CREATE INDEX IF NOT EXISTS idx_reminders_is_completed ON reminders(is_completed);
    CREATE INDEX IF NOT EXISTS idx_reminders_created_by ON reminders(created_by);

    CREATE INDEX IF NOT EXISTS idx_handovers_week_year ON handovers(week_number, year);
    CREATE INDEX IF NOT EXISTS idx_handovers_created_by ON handovers(created_by);
    CREATE INDEX IF NOT EXISTS idx_handovers_created_at ON handovers(created_at);
  `)

  // Full-text search for topics and records
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS topics_fts USING fts5(
      title,
      description,
      content='topics',
      content_rowid='rowid'
    )
  `)

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS records_fts USING fts5(
      title,
      content,
      content='records',
      content_rowid='rowid'
    )
  `)

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS emails_fts USING fts5(
      subject,
      sender,
      sender_name,
      recipients,
      content='emails',
      content_rowid='rowid'
    )
  `)

  // Triggers to keep FTS in sync
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS topics_ai AFTER INSERT ON topics BEGIN
      INSERT INTO topics_fts(rowid, title, description)
      VALUES (NEW.rowid, NEW.title, NEW.description);
    END;

    CREATE TRIGGER IF NOT EXISTS topics_ad AFTER DELETE ON topics BEGIN
      INSERT INTO topics_fts(topics_fts, rowid, title, description)
      VALUES ('delete', OLD.rowid, OLD.title, OLD.description);
    END;

    CREATE TRIGGER IF NOT EXISTS topics_au AFTER UPDATE ON topics BEGIN
      INSERT INTO topics_fts(topics_fts, rowid, title, description)
      VALUES ('delete', OLD.rowid, OLD.title, OLD.description);
      INSERT INTO topics_fts(rowid, title, description)
      VALUES (NEW.rowid, NEW.title, NEW.description);
    END;
  `)

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS records_ai AFTER INSERT ON records BEGIN
      INSERT INTO records_fts(rowid, title, content)
      VALUES (NEW.rowid, NEW.title, NEW.content);
    END;

    CREATE TRIGGER IF NOT EXISTS records_ad AFTER DELETE ON records BEGIN
      INSERT INTO records_fts(records_fts, rowid, title, content)
      VALUES ('delete', OLD.rowid, OLD.title, OLD.content);
    END;

    CREATE TRIGGER IF NOT EXISTS records_au AFTER UPDATE ON records BEGIN
      INSERT INTO records_fts(records_fts, rowid, title, content)
      VALUES ('delete', OLD.rowid, OLD.title, OLD.content);
      INSERT INTO records_fts(rowid, title, content)
      VALUES (NEW.rowid, NEW.title, NEW.content);
    END;
  `)

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS emails_ai AFTER INSERT ON emails BEGIN
      INSERT INTO emails_fts(rowid, subject, sender, sender_name, recipients)
      VALUES (NEW.rowid, NEW.subject, NEW.sender, NEW.sender_name, NEW.recipients);
    END;

    CREATE TRIGGER IF NOT EXISTS emails_ad AFTER DELETE ON emails BEGIN
      INSERT INTO emails_fts(emails_fts, rowid, subject, sender, sender_name, recipients)
      VALUES ('delete', OLD.rowid, OLD.subject, OLD.sender, OLD.sender_name, OLD.recipients);
    END;

    CREATE TRIGGER IF NOT EXISTS emails_au AFTER UPDATE ON emails BEGIN
      INSERT INTO emails_fts(emails_fts, rowid, subject, sender, sender_name, recipients)
      VALUES ('delete', OLD.rowid, OLD.subject, OLD.sender, OLD.sender_name, OLD.recipients);
      INSERT INTO emails_fts(rowid, subject, sender, sender_name, recipients)
      VALUES (NEW.rowid, NEW.subject, NEW.sender, NEW.sender_name, NEW.recipients);
    END;
  `)

  console.log('Database schema initialized')
}

export function hasUsers(): boolean {
  const db = getDatabase()
  const result = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
  return result.count > 0
}
