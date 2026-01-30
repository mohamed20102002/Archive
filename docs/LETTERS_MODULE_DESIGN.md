# Letters Module - Complete Design Document

## Table of Contents
1. [Overview](#overview)
2. [Data Model / Schema](#data-model--schema)
3. [Folder Structure](#folder-structure)
4. [Outlook Email Import Workflow](#outlook-email-import-workflow)
5. [Reference Linking Logic](#reference-linking-logic)
6. [UI/UX Design](#uiux-design)
7. [Draft Versioning Strategy](#draft-versioning-strategy)
8. [Search and Filtering](#search-and-filtering)
9. [Edge Cases and Validation](#edge-cases-and-validation)
10. [Scalability Considerations](#scalability-considerations)
11. [Implementation Plan](#implementation-plan)

---

## Overview

The Letters module manages official correspondence within the Project Data Archiving System. It provides:
- Full lifecycle management from receipt to response
- Multi-version draft tracking
- Cross-reference linking between letters
- Three visualization modes (Tree, Graph, Timeline)
- Integration with existing Topics and Outlook

---

## Data Model / Schema

### 1. Authorities Table
```sql
CREATE TABLE IF NOT EXISTS authorities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT,                    -- Abbreviation (e.g., "ASE" for "Authority of Safety Engineering")
  type TEXT DEFAULT 'external',       -- 'internal' | 'external' | 'government' | 'private'
  address TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_authorities_name ON authorities(name);
CREATE INDEX idx_authorities_type ON authorities(type);
CREATE INDEX idx_authorities_deleted ON authorities(deleted_at);
```

### 2. Letters Table
```sql
CREATE TABLE IF NOT EXISTS letters (
  id TEXT PRIMARY KEY,

  -- Classification
  letter_type TEXT NOT NULL,          -- 'incoming' | 'outgoing' | 'internal' | 'draft_only'
  response_type TEXT,                 -- 'requires_reply' | 'informational' | 'internal_memo' | 'external_correspondence'
  status TEXT DEFAULT 'pending',      -- 'pending' | 'in_progress' | 'replied' | 'closed' | 'archived'
  priority TEXT DEFAULT 'normal',     -- 'low' | 'normal' | 'high' | 'urgent'

  -- Reference Numbers
  incoming_number TEXT,               -- Number assigned when received
  outgoing_number TEXT,               -- Number assigned when sending response
  reference_number TEXT,              -- Main reference (e.g., "O/ASE/13012026/6406")

  -- Content
  subject TEXT NOT NULL,
  summary TEXT,                       -- Brief description/abstract
  content TEXT,                       -- Full text content (if digitized)

  -- Relationships
  authority_id TEXT,                  -- Who sent/received the letter
  topic_id TEXT NOT NULL,             -- Required topic assignment
  subcategory_id TEXT,                -- Optional subcategory
  parent_letter_id TEXT,              -- For replies: links to original letter

  -- File Storage
  storage_path TEXT,                  -- Relative path: letters/YYYY/MM/DD/letter-id/
  original_filename TEXT,             -- Original file name
  file_type TEXT,                     -- 'pdf' | 'docx' | 'msg' | 'image' | 'other'
  file_size INTEGER,
  checksum TEXT,                      -- SHA256 for integrity

  -- Outlook Integration
  outlook_entry_id TEXT,              -- If imported from Outlook
  outlook_store_id TEXT,
  email_id TEXT,                      -- Reference to emails table if from email

  -- Dates
  letter_date TEXT,                   -- Date on the letter itself
  received_date TEXT,                 -- When we received it
  due_date TEXT,                      -- Response deadline
  responded_date TEXT,                -- When we responded

  -- Metadata
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
);

-- Indexes for performance
CREATE INDEX idx_letters_topic ON letters(topic_id);
CREATE INDEX idx_letters_authority ON letters(authority_id);
CREATE INDEX idx_letters_type ON letters(letter_type);
CREATE INDEX idx_letters_status ON letters(status);
CREATE INDEX idx_letters_reference ON letters(reference_number);
CREATE INDEX idx_letters_incoming ON letters(incoming_number);
CREATE INDEX idx_letters_outgoing ON letters(outgoing_number);
CREATE INDEX idx_letters_parent ON letters(parent_letter_id);
CREATE INDEX idx_letters_dates ON letters(letter_date, received_date, due_date);
CREATE INDEX idx_letters_deleted ON letters(deleted_at);

-- Full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS letters_fts USING fts5(
  subject,
  summary,
  content,
  reference_number,
  incoming_number,
  outgoing_number,
  content='letters',
  content_rowid='rowid'
);

-- FTS sync triggers
CREATE TRIGGER letters_ai AFTER INSERT ON letters BEGIN
  INSERT INTO letters_fts(rowid, subject, summary, content, reference_number, incoming_number, outgoing_number)
  VALUES (NEW.rowid, NEW.subject, NEW.summary, NEW.content, NEW.reference_number, NEW.incoming_number, NEW.outgoing_number);
END;

CREATE TRIGGER letters_ad AFTER DELETE ON letters BEGIN
  INSERT INTO letters_fts(letters_fts, rowid, subject, summary, content, reference_number, incoming_number, outgoing_number)
  VALUES('delete', OLD.rowid, OLD.subject, OLD.summary, OLD.content, OLD.reference_number, OLD.incoming_number, OLD.outgoing_number);
END;

CREATE TRIGGER letters_au AFTER UPDATE ON letters BEGIN
  INSERT INTO letters_fts(letters_fts, rowid, subject, summary, content, reference_number, incoming_number, outgoing_number)
  VALUES('delete', OLD.rowid, OLD.subject, OLD.summary, OLD.content, OLD.reference_number, OLD.incoming_number, OLD.outgoing_number);
  INSERT INTO letters_fts(rowid, subject, summary, content, reference_number, incoming_number, outgoing_number)
  VALUES (NEW.rowid, NEW.subject, NEW.summary, NEW.content, NEW.reference_number, NEW.incoming_number, NEW.outgoing_number);
END;
```

### 3. Letter Drafts Table
```sql
CREATE TABLE IF NOT EXISTS letter_drafts (
  id TEXT PRIMARY KEY,
  letter_id TEXT NOT NULL,            -- Parent letter
  version INTEGER NOT NULL,           -- Auto-incrementing version number

  -- Draft Content
  title TEXT NOT NULL,                -- Draft title/description
  content TEXT,                       -- Draft content
  notes TEXT,                         -- Internal notes about this draft

  -- File Storage
  storage_path TEXT,                  -- Path to draft file
  original_filename TEXT,
  file_type TEXT,
  file_size INTEGER,
  checksum TEXT,

  -- Status
  status TEXT DEFAULT 'draft',        -- 'draft' | 'review' | 'approved' | 'sent' | 'superseded'
  is_final INTEGER DEFAULT 0,         -- 1 if this is the final version

  -- Metadata
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,

  FOREIGN KEY (letter_id) REFERENCES letters(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE(letter_id, version)
);

CREATE INDEX idx_drafts_letter ON letter_drafts(letter_id);
CREATE INDEX idx_drafts_version ON letter_drafts(letter_id, version);
CREATE INDEX idx_drafts_status ON letter_drafts(status);
CREATE INDEX idx_drafts_deleted ON letter_drafts(deleted_at);
```

### 4. Letter References Table (Many-to-Many)
```sql
CREATE TABLE IF NOT EXISTS letter_references (
  id TEXT PRIMARY KEY,
  source_letter_id TEXT NOT NULL,     -- The letter making the reference
  target_letter_id TEXT NOT NULL,     -- The letter being referenced
  reference_type TEXT DEFAULT 'related', -- 'reply_to' | 'related' | 'supersedes' | 'amends' | 'attachment_to'
  notes TEXT,                         -- Optional description of the relationship
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (source_letter_id) REFERENCES letters(id) ON DELETE CASCADE,
  FOREIGN KEY (target_letter_id) REFERENCES letters(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE(source_letter_id, target_letter_id)
);

CREATE INDEX idx_letter_refs_source ON letter_references(source_letter_id);
CREATE INDEX idx_letter_refs_target ON letter_references(target_letter_id);
CREATE INDEX idx_letter_refs_type ON letter_references(reference_type);
```

### 5. Letter Attachments Table
```sql
CREATE TABLE IF NOT EXISTS letter_attachments (
  id TEXT PRIMARY KEY,
  letter_id TEXT NOT NULL,
  draft_id TEXT,                      -- Optional: if attachment belongs to a draft

  -- File Info
  filename TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT NOT NULL,         -- Relative path within letter folder
  checksum TEXT,

  -- Metadata
  description TEXT,
  is_original INTEGER DEFAULT 1,      -- 1 if original attachment, 0 if added later
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,

  FOREIGN KEY (letter_id) REFERENCES letters(id) ON DELETE CASCADE,
  FOREIGN KEY (draft_id) REFERENCES letter_drafts(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_attachments_letter ON letter_attachments(letter_id);
CREATE INDEX idx_attachments_draft ON letter_attachments(draft_id);
CREATE INDEX idx_attachments_deleted ON letter_attachments(deleted_at);
```

---

## Folder Structure

```
letters/
├── authorities/                      # Authority logos/documents (optional)
│   └── auth-uuid/
│       └── logo.png
│
├── 2024/                            # Year-based organization
│   ├── 01/                          # Month
│   │   ├── 15/                      # Day
│   │   │   └── letter-uuid/         # Individual letter folder
│   │   │       ├── metadata.json    # Complete metadata snapshot
│   │   │       ├── original/        # Original letter file(s)
│   │   │       │   └── letter.pdf
│   │   │       ├── attachments/     # Letter attachments
│   │   │       │   ├── doc1.pdf
│   │   │       │   └── image.jpg
│   │   │       └── drafts/          # Draft versions
│   │   │           ├── v1/
│   │   │           │   ├── draft.docx
│   │   │           │   └── metadata.json
│   │   │           ├── v2/
│   │   │           │   ├── draft.docx
│   │   │           │   └── metadata.json
│   │   │           └── final/
│   │   │               ├── response.pdf
│   │   │               └── metadata.json
│   │   └── 16/...
│   └── 02/...
└── 2025/...
```

### Metadata JSON Structure
```json
{
  "id": "letter-uuid",
  "subject": "RE: Project Approval Request",
  "reference_number": "O/ASE/13012026/6406",
  "letter_type": "incoming",
  "authority": {
    "id": "auth-uuid",
    "name": "Authority of Safety Engineering",
    "short_name": "ASE"
  },
  "topic": {
    "id": "topic-uuid",
    "title": "Safety Compliance"
  },
  "files": {
    "original": "original/letter.pdf",
    "attachments": ["attachments/doc1.pdf", "attachments/image.jpg"]
  },
  "drafts": [
    {
      "version": 1,
      "path": "drafts/v1/draft.docx",
      "status": "superseded",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "dates": {
    "letter_date": "2024-01-10",
    "received_date": "2024-01-15",
    "due_date": "2024-01-25"
  },
  "archived_at": "2024-01-15T14:22:00Z",
  "archived_by": "user-uuid"
}
```

---

## Outlook Email Import Workflow

### Process Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Select Email   │────▶│  Extract Data    │────▶│  Create Letter  │
│  in Outlook     │     │  - Subject       │     │  - Metadata     │
│  Browser        │     │  - Body          │     │  - Files        │
└─────────────────┘     │  - Attachments   │     │  - References   │
                        │  - Sender        │     └─────────────────┘
                        └──────────────────┘              │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Display in     │◀────│  Store Files     │◀────│  Select Topic   │
│  Letters View   │     │  - Save .msg     │     │  & Authority    │
└─────────────────┘     │  - Extract attach│     └─────────────────┘
                        │  - Create folder │
                        └──────────────────┘
```

### Implementation Steps

1. **Email Selection** (OutlookBrowser component)
   - User browses emails in embedded Outlook view
   - "Import as Letter" button available alongside "Archive" button
   - Opens Letter Import modal

2. **Letter Import Modal**
   ```typescript
   interface LetterImportData {
     // Pre-filled from email
     subject: string
     content: string
     senderEmail: string
     receivedDate: string
     attachments: AttachmentInfo[]

     // User must provide
     topic_id: string
     subcategory_id?: string
     authority_id?: string        // Can auto-match by sender email
     letter_type: 'incoming'      // Default for email import
     response_type: string
     reference_number?: string
     incoming_number?: string
     letter_date?: string
     due_date?: string
     related_letters?: string[]   // Reference to existing letters
   }
   ```

3. **Authority Auto-Detection**
   - Match sender email domain to existing authorities
   - Suggest creating new authority if no match
   - Quick-add authority inline

4. **File Storage Process**
   ```typescript
   async function importEmailAsLetter(
     emailData: OutlookEmailData,
     letterData: LetterImportData,
     userId: string
   ) {
     // 1. Generate letter ID and storage path
     const letterId = generateId()
     const storagePath = `${format(new Date(), 'yyyy/MM/dd')}/${letterId}`

     // 2. Create folder structure
     await createLetterFolder(storagePath)

     // 3. Save email as .msg file
     await saveEmailFile(emailData, `${storagePath}/original/email.msg`)

     // 4. Extract and save attachments
     for (const attachment of emailData.attachments) {
       await saveAttachment(attachment, `${storagePath}/attachments/`)
     }

     // 5. Create metadata.json
     await saveMetadata(storagePath, { ...letterData, files: [...] })

     // 6. Insert database records
     await insertLetter({ ...letterData, storage_path: storagePath })
     await insertAttachments(letterId, attachments)

     // 7. Create reference links if specified
     if (letterData.related_letters) {
       await createReferences(letterId, letterData.related_letters)
     }

     // 8. Log audit
     logAudit('LETTER_IMPORT', userId, ...)

     return { success: true, letter_id: letterId }
   }
   ```

---

## Reference Linking Logic

### Reference Types

| Type | Description | Use Case |
|------|-------------|----------|
| `reply_to` | Direct reply to another letter | Response chain |
| `related` | General relationship | Same project/topic |
| `supersedes` | Replaces previous letter | Updated version |
| `amends` | Modifies specific parts | Corrections |
| `attachment_to` | Supporting document | Evidence/backup |

### Reference Number Parsing

```typescript
// Reference number format: O/ASE/13012026/6406
interface ParsedReference {
  direction: 'O' | 'I'        // Outgoing / Incoming
  authority: string           // Authority code
  date: string               // DDMMYYYY format
  sequence: string           // Sequential number
}

function parseReferenceNumber(ref: string): ParsedReference | null {
  const pattern = /^([OI])\/([A-Z]+)\/(\d{8})\/(\d+)$/
  const match = ref.match(pattern)
  if (!match) return null

  return {
    direction: match[1] as 'O' | 'I',
    authority: match[2],
    date: match[3],
    sequence: match[4]
  }
}

function generateReferenceNumber(
  direction: 'O' | 'I',
  authorityCode: string,
  date: Date = new Date()
): string {
  const dateStr = format(date, 'ddMMyyyy')
  const sequence = getNextSequence(direction, authorityCode, dateStr)
  return `${direction}/${authorityCode}/${dateStr}/${sequence}`
}
```

### Bidirectional Reference Resolution

```typescript
interface LetterWithReferences extends Letter {
  references_to: Array<{
    letter: Letter
    type: ReferenceType
    notes?: string
  }>
  referenced_by: Array<{
    letter: Letter
    type: ReferenceType
    notes?: string
  }>
}

function getLetterWithReferences(letterId: string): LetterWithReferences {
  const letter = getLetterById(letterId)

  // Get letters this one references
  const referencesTo = db.prepare(`
    SELECT lr.*, l.*
    FROM letter_references lr
    JOIN letters l ON lr.target_letter_id = l.id
    WHERE lr.source_letter_id = ? AND l.deleted_at IS NULL
  `).all(letterId)

  // Get letters that reference this one
  const referencedBy = db.prepare(`
    SELECT lr.*, l.*
    FROM letter_references lr
    JOIN letters l ON lr.source_letter_id = l.id
    WHERE lr.target_letter_id = ? AND l.deleted_at IS NULL
  `).all(letterId)

  return {
    ...letter,
    references_to: referencesTo,
    referenced_by: referencedBy
  }
}
```

### Reference Chain Traversal (for Graph View)

```typescript
interface LetterNode {
  letter: Letter
  children: LetterNode[]
  parents: LetterNode[]
  depth: number
}

function buildReferenceGraph(
  letterId: string,
  maxDepth: number = 3,
  visited: Set<string> = new Set()
): LetterNode {
  if (visited.has(letterId)) {
    return null // Prevent circular references
  }
  visited.add(letterId)

  const letter = getLetterWithReferences(letterId)

  return {
    letter,
    children: letter.references_to
      .map(ref => buildReferenceGraph(ref.letter.id, maxDepth - 1, visited))
      .filter(Boolean),
    parents: letter.referenced_by
      .map(ref => buildReferenceGraph(ref.letter.id, maxDepth - 1, visited))
      .filter(Boolean),
    depth: 0
  }
}
```

---

## UI/UX Design

### Main Letters Page Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Letters                                    [+ New Letter] [Import] │
├─────────────────────────────────────────────────────────────────────┤
│  [Search...]  [Topic ▼] [Authority ▼] [Status ▼] [Type ▼]  [🔲][≡] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 📨 RE: Project Approval              O/ASE/13012026/6406    │   │
│  │    Authority of Safety Engineering   │ Safety Compliance    │   │
│  │    Received: Jan 15, 2024           ⚡ Requires Reply       │   │
│  │    Due: Jan 25, 2024                 📎 2 attachments       │   │
│  │    [2 drafts] [3 references]                    [▶ Expand]  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 📤 Monthly Status Report             O/INT/15012026/001     │   │
│  │    Internal                          │ Operations           │   │
│  │    Sent: Jan 15, 2024               ℹ️ Informational        │   │
│  │    ✓ Closed                          📎 1 attachment        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1. Tree View

```
┌─────────────────────────────────────────────────────────────────────┐
│  Tree View                                          [Expand All]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📁 Safety Compliance (Topic)                                       │
│  ├── 📨 O/ASE/13012026/6406 - Project Approval Request             │
│  │   ├── 📝 Draft v1 - Initial Response (superseded)               │
│  │   ├── 📝 Draft v2 - Revised Response (approved)                 │
│  │   └── 📤 O/ASE/20012026/6407 - Official Response                │
│  │       └── 📨 O/ASE/25012026/6410 - Acknowledgment               │
│  │                                                                  │
│  ├── 📨 O/GOV/10012026/1234 - Compliance Audit Notice              │
│  │   ├── 📝 Draft v1 - Audit Response                              │
│  │   └── 📤 O/GOV/15012026/1235 - Audit Response (Final)           │
│  │                                                                  │
│  └── 📤 O/INT/01012026/001 - Safety Guidelines Update              │
│                                                                     │
│  📁 Operations (Topic)                                              │
│  └── ...                                                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Tree View Features:**
- Hierarchical organization by Topic > Letter > Drafts > Responses
- Expand/collapse nodes
- Visual indicators for letter type (📨 incoming, 📤 outgoing, 📝 draft)
- Status badges (pending, replied, closed)
- Quick actions on hover (view, edit, add draft)
- Drag-and-drop for creating references

### 2. Graph View

```
┌─────────────────────────────────────────────────────────────────────┐
│  Graph View                    [Depth: 2 ▼] [Show Drafts ☐] [Reset]│
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                     ┌─────────────┐                                 │
│                     │ O/GOV/1234  │                                 │
│                     │ Audit Notice│                                 │
│                     └──────┬──────┘                                 │
│                            │ reply_to                               │
│                            ▼                                        │
│    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│    │ O/ASE/6406  │──│ ★ CURRENT  │──│ O/ASE/6410  │               │
│    │ Approval Req│  │ O/ASE/6407  │  │ Acknowledge │               │
│    └─────────────┘  │ Response    │  └─────────────┘               │
│          │          └─────────────┘         │                       │
│          │ related        │                 │ related               │
│          ▼                │                 ▼                       │
│    ┌─────────────┐        │          ┌─────────────┐               │
│    │ O/INT/001   │        │          │ O/EXT/999   │               │
│    │ Guidelines  │        │          │ Follow-up   │               │
│    └─────────────┘        ▼          └─────────────┘               │
│                    [+ Draft v1]                                     │
│                    [+ Draft v2]                                     │
│                                                                     │
│  Legend: ─── reply_to  ··· related  ─·─ supersedes                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Graph View Features:**
- Central node highlighting for selected letter
- Expandable nodes (click to show connected letters)
- Different line styles for reference types
- Zoom and pan controls
- Mini-map for large graphs
- Drafts shown as sub-nodes when expanded
- Color coding by status/priority
- Click node to view details panel

**Implementation: Use React Flow or D3.js**
```typescript
interface GraphNode {
  id: string
  type: 'letter' | 'draft'
  data: Letter | Draft
  position: { x: number, y: number }
  style: NodeStyle
}

interface GraphEdge {
  id: string
  source: string
  target: string
  type: ReferenceType
  animated?: boolean
  style: EdgeStyle
}
```

### 3. Timeline View

```
┌─────────────────────────────────────────────────────────────────────┐
│  Timeline View                              [Filter: All ▼] [Today] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  January 2024                                                       │
│  ──────────────────────────────────────────────────────────────     │
│                                                                     │
│  Jan 25  ○───── 📤 Response sent (O/ASE/6407)                      │
│          │      Final response to approval request                  │
│          │      ✓ Approved by Manager                               │
│          │                                                          │
│  Jan 22  ○───── 📝 Draft v2 created                                │
│          │      Revised based on legal review                       │
│          │      Author: John Smith                                  │
│          │                                                          │
│  Jan 18  ○───── 📝 Draft v1 created                                │
│          │      Initial response draft                              │
│          │      Author: Jane Doe                                    │
│          │                                                          │
│  Jan 15  ●───── 📨 Letter received (O/ASE/6406)                    │
│                 Project Approval Request                            │
│                 From: Authority of Safety Engineering               │
│                 Due: Jan 25, 2024                                   │
│                 📎 2 attachments                                    │
│                                                                     │
│  Jan 10  ○───── 📨 Related letter (O/GOV/1234)                     │
│                 Compliance Audit Notice                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Timeline View Features:**
- Chronological display of all events
- Filter by date range, type, status
- Visual distinction between:
  - ● Major events (letter received/sent)
  - ○ Minor events (drafts, modifications)
- Expandable event cards for details
- Jump to specific date
- Group by day/week/month
- Export timeline as report

### Letter Detail View

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back to Letters                                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  O/ASE/13012026/6406                                    [⋮ Actions] │
│  ══════════════════════════════════════════════════════════════     │
│  Project Approval Request                                           │
│                                                                     │
│  ┌──────────────┬───────────────────────────────────────────────┐  │
│  │ Status       │ ⚡ Requires Reply          [Change Status ▼]  │  │
│  │ Authority    │ Authority of Safety Engineering               │  │
│  │ Topic        │ Safety Compliance > Project Reviews           │  │
│  │ Letter Date  │ January 10, 2024                              │  │
│  │ Received     │ January 15, 2024                              │  │
│  │ Due Date     │ January 25, 2024  ⚠️ 5 days remaining        │  │
│  │ Priority     │ 🔴 High                                       │  │
│  └──────────────┴───────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ [📄 Content] [📎 Attachments (2)] [📝 Drafts (2)] [🔗 Refs] │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │                                                             │   │
│  │  Summary:                                                   │   │
│  │  Request for approval of the new safety protocols for      │   │
│  │  Project Alpha. Requires response within 10 business days. │   │
│  │                                                             │   │
│  │  [View Original Document]                                   │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Drafts                                           [+ New Draft]     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ v2 │ Revised Response    │ Approved │ Jan 22 │ John Smith  │   │
│  │ v1 │ Initial Response    │ Superseded│ Jan 18│ Jane Doe    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  References                                       [+ Add Reference] │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ → Replies to: O/GOV/10012026/1234 - Compliance Audit Notice│   │
│  │ ← Referenced by: O/ASE/25012026/6410 - Acknowledgment      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Activity Timeline                                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Jan 25 │ Response sent by John Smith                       │   │
│  │ Jan 22 │ Draft v2 approved by Manager                      │   │
│  │ Jan 22 │ Draft v2 created by John Smith                    │   │
│  │ Jan 18 │ Draft v1 created by Jane Doe                      │   │
│  │ Jan 15 │ Letter imported from Outlook by Admin             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Draft Versioning Strategy

### Version Numbering
- Auto-increment integer starting from 1
- Never reuse version numbers (even after deletion)
- Each draft has its own folder: `drafts/v{N}/`

### Draft Lifecycle States

```
  ┌──────────┐
  │  draft   │ ←── Initial state
  └────┬─────┘
       │ submit for review
       ▼
  ┌──────────┐
  │  review  │ ←── Under review
  └────┬─────┘
       │ approve / reject
       ▼
  ┌──────────┐     ┌────────────┐
  │ approved │ ──▶ │    sent    │ ←── Final version sent
  └──────────┘     └────────────┘
       │
       │ new draft created
       ▼
  ┌────────────┐
  │ superseded │ ←── Replaced by newer draft
  └────────────┘
```

### Draft Operations

```typescript
interface CreateDraftData {
  letter_id: string
  title: string
  content?: string
  file?: File           // Upload draft document
  notes?: string
}

async function createDraft(data: CreateDraftData, userId: string) {
  // 1. Get next version number
  const nextVersion = getNextDraftVersion(data.letter_id)

  // 2. Create storage path
  const letterPath = getLetterStoragePath(data.letter_id)
  const draftPath = `${letterPath}/drafts/v${nextVersion}`

  // 3. Save file if provided
  if (data.file) {
    await saveDraftFile(data.file, draftPath)
  }

  // 4. Insert draft record
  const draft = await insertDraft({
    ...data,
    version: nextVersion,
    storage_path: draftPath,
    status: 'draft'
  })

  // 5. Update letter's updated_at
  await updateLetterTimestamp(data.letter_id)

  // 6. Audit log
  logAudit('DRAFT_CREATE', userId, 'letter_draft', draft.id, {
    letter_id: data.letter_id,
    version: nextVersion
  })

  return draft
}

async function approveDraft(draftId: string, userId: string) {
  const draft = getDraftById(draftId)

  // 1. Mark current draft as approved
  await updateDraftStatus(draftId, 'approved')

  // 2. Mark all other drafts as superseded
  await supersedePreviousDrafts(draft.letter_id, draftId)

  // 3. Audit log
  logAudit('DRAFT_APPROVE', userId, 'letter_draft', draftId, {
    letter_id: draft.letter_id,
    version: draft.version
  })
}

async function markDraftAsSent(draftId: string, userId: string) {
  const draft = getDraftById(draftId)

  // 1. Update draft status
  await updateDraftStatus(draftId, 'sent')
  await updateDraft(draftId, { is_final: 1 })

  // 2. Update letter status to replied
  await updateLetterStatus(draft.letter_id, 'replied')
  await updateLetter(draft.letter_id, {
    responded_date: new Date().toISOString()
  })

  // 3. Optionally create outgoing letter record
  // (if treating response as separate letter)

  // 4. Audit log
  logAudit('DRAFT_SENT', userId, 'letter_draft', draftId, {
    letter_id: draft.letter_id,
    version: draft.version
  })
}
```

---

## Search and Filtering

### Search Capabilities

```typescript
interface LetterSearchParams {
  // Text search (uses FTS)
  query?: string

  // Filters
  topic_id?: string
  subcategory_id?: string
  authority_id?: string
  letter_type?: LetterType | LetterType[]
  response_type?: ResponseType | ResponseType[]
  status?: LetterStatus | LetterStatus[]
  priority?: Priority | Priority[]

  // Date ranges
  letter_date_from?: string
  letter_date_to?: string
  received_date_from?: string
  received_date_to?: string
  due_date_from?: string
  due_date_to?: string

  // Reference number patterns
  reference_pattern?: string    // Supports wildcards: "O/ASE/*"

  // Flags
  has_attachments?: boolean
  has_drafts?: boolean
  is_overdue?: boolean

  // Sorting
  sort_by?: 'received_date' | 'letter_date' | 'due_date' | 'subject' | 'reference_number'
  sort_order?: 'asc' | 'desc'

  // Pagination
  limit?: number
  offset?: number
}

function searchLetters(params: LetterSearchParams): {
  letters: Letter[]
  total: number
  facets: SearchFacets
} {
  let query = `
    SELECT l.*,
           a.name as authority_name,
           t.title as topic_title,
           s.title as subcategory_title,
           u.display_name as creator_name,
           (SELECT COUNT(*) FROM letter_attachments WHERE letter_id = l.id AND deleted_at IS NULL) as attachment_count,
           (SELECT COUNT(*) FROM letter_drafts WHERE letter_id = l.id AND deleted_at IS NULL) as draft_count
    FROM letters l
    LEFT JOIN authorities a ON l.authority_id = a.id
    LEFT JOIN topics t ON l.topic_id = t.id
    LEFT JOIN subcategories s ON l.subcategory_id = s.id
    LEFT JOIN users u ON l.created_by = u.id
    WHERE l.deleted_at IS NULL
  `

  // Add FTS search
  if (params.query) {
    query += ` AND l.id IN (
      SELECT rowid FROM letters_fts WHERE letters_fts MATCH ?
    )`
  }

  // Add filters...
  // Add sorting...
  // Add pagination...

  return { letters, total, facets }
}
```

### Filter UI Component

```typescript
interface LetterFilters {
  topics: Topic[]
  authorities: Authority[]
  letterTypes: { value: string, label: string }[]
  responseTypes: { value: string, label: string }[]
  statuses: { value: string, label: string }[]
  priorities: { value: string, label: string }[]
}

// Pre-defined filter combinations
const QUICK_FILTERS = {
  'needs-action': {
    status: ['pending', 'in_progress'],
    response_type: 'requires_reply'
  },
  'overdue': {
    is_overdue: true
  },
  'this-week': {
    received_date_from: startOfWeek(new Date()),
    received_date_to: endOfWeek(new Date())
  },
  'incoming': {
    letter_type: 'incoming'
  },
  'outgoing': {
    letter_type: 'outgoing'
  }
}
```

---

## Edge Cases and Validation

### Validation Rules

```typescript
const LETTER_VALIDATION = {
  subject: {
    required: true,
    minLength: 3,
    maxLength: 500
  },
  reference_number: {
    pattern: /^[OI]\/[A-Z]+\/\d{8}\/\d+$/,
    unique: true,  // Per direction + authority
    message: 'Reference number must match format: O/XXX/DDMMYYYY/NNN'
  },
  topic_id: {
    required: true
  },
  authority_id: {
    required: (letter) => letter.letter_type !== 'internal'
  },
  due_date: {
    afterOrEqual: 'received_date',
    message: 'Due date must be after received date'
  },
  letter_date: {
    beforeOrEqual: 'received_date',
    message: 'Letter date cannot be after received date'
  }
}
```

### Edge Cases

1. **Circular References**
   ```typescript
   function validateReference(sourceId: string, targetId: string): boolean {
     // Prevent self-reference
     if (sourceId === targetId) return false

     // Prevent circular chains (A→B→C→A)
     const visited = new Set<string>()
     return !hasCircularPath(targetId, sourceId, visited)
   }
   ```

2. **Orphaned Drafts**
   - Drafts must always have a parent letter
   - ON DELETE CASCADE ensures cleanup
   - Show warning when deleting letter with drafts

3. **Duplicate Reference Numbers**
   - Allow same reference across different authorities
   - Enforce unique within authority + direction

4. **File Storage Failures**
   ```typescript
   async function safeFileOperation<T>(
     operation: () => Promise<T>,
     rollback: () => Promise<void>
   ): Promise<T> {
     try {
       return await operation()
     } catch (error) {
       await rollback()
       throw new StorageError('File operation failed', error)
     }
   }
   ```

5. **Large Attachment Handling**
   - Max file size: 50MB per file
   - Streaming for large files
   - Progress indicators
   - Chunked uploads

6. **Concurrent Draft Editing**
   - Optimistic locking with version check
   - Warning when draft modified by another user
   - Auto-save with conflict detection

7. **Authority Deletion with Linked Letters**
   - Soft delete only
   - Show count of linked letters
   - Option to reassign letters to another authority

8. **Topic Deletion with Linked Letters**
   - Prevent deletion if letters exist
   - Require moving letters to another topic first

---

## Scalability Considerations

### Database Optimization

1. **Indexing Strategy**
   - Composite indexes for common query patterns
   - Partial indexes for active records
   ```sql
   CREATE INDEX idx_letters_active_due
   ON letters(due_date)
   WHERE deleted_at IS NULL AND status IN ('pending', 'in_progress');
   ```

2. **Query Optimization**
   - Pagination with cursor-based approach for large datasets
   - Lazy loading of attachments and drafts
   - Cached counts for frequently accessed metrics

3. **FTS Performance**
   - Regular FTS optimization: `INSERT INTO letters_fts(letters_fts) VALUES('optimize')`
   - Scheduled during idle time

### File Storage

1. **Storage Monitoring**
   ```typescript
   function getStorageStats(): StorageStats {
     return {
       totalSize: calculateFolderSize('letters/'),
       letterCount: getLetterCount(),
       attachmentCount: getAttachmentCount(),
       averageLetterSize: totalSize / letterCount,
       largestLetter: findLargestLetter()
     }
   }
   ```

2. **Archival Strategy**
   - Move closed letters > 2 years to archive
   - Compress attachments
   - Maintain index for archived letters

3. **Backup Integration**
   - Incremental backup support
   - Checksum verification on restore

### UI Performance

1. **Virtual Scrolling**
   - For letter lists > 100 items
   - Load items in chunks of 50

2. **Graph View Optimization**
   - Limit initial graph depth to 2
   - Progressive loading on expand
   - WebGL rendering for large graphs (> 100 nodes)

3. **Caching**
   - Cache authority list (rarely changes)
   - Cache topic tree structure
   - Invalidate on updates

---

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1-2)
- [ ] Database schema and migrations
- [ ] Folder structure creation utilities
- [ ] Authority service (CRUD)
- [ ] Letter service (basic CRUD)
- [ ] IPC handlers
- [ ] Type definitions

### Phase 2: Letter Management (Week 2-3)
- [ ] Letter creation form
- [ ] Letter list view (card + table)
- [ ] Letter detail view
- [ ] File upload/storage
- [ ] Attachment management

### Phase 3: Draft System (Week 3-4)
- [ ] Draft service
- [ ] Draft creation/editing
- [ ] Version history
- [ ] Draft workflow (review → approve → send)

### Phase 4: References & Outlook (Week 4-5)
- [ ] Reference linking logic
- [ ] Reference UI components
- [ ] Outlook import integration
- [ ] Authority auto-detection

### Phase 5: Visualization Views (Week 5-6)
- [ ] Tree view implementation
- [ ] Graph view (React Flow)
- [ ] Timeline view
- [ ] View switching

### Phase 6: Search & Polish (Week 6-7)
- [ ] Advanced search
- [ ] Filter system
- [ ] Audit logging
- [ ] Performance optimization
- [ ] Testing & bug fixes

---

## File Structure (New Files)

```
src/
├── main/
│   ├── database/
│   │   └── migrations.ts           # Add letters migration
│   └── services/
│       ├── authority.service.ts    # NEW
│       ├── letter.service.ts       # NEW
│       ├── letter-draft.service.ts # NEW
│       └── letter-reference.service.ts # NEW
│
├── renderer/
│   ├── components/
│   │   └── letters/
│   │       ├── LetterList.tsx           # Main list view
│   │       ├── LetterCard.tsx           # Card component
│   │       ├── LetterDetail.tsx         # Detail view
│   │       ├── LetterForm.tsx           # Create/edit form
│   │       ├── LetterImportModal.tsx    # Outlook import
│   │       ├── DraftList.tsx            # Draft listing
│   │       ├── DraftForm.tsx            # Draft editor
│   │       ├── DraftTimeline.tsx        # Draft history
│   │       ├── ReferenceManager.tsx     # Reference linking
│   │       ├── AuthoritySelect.tsx      # Authority picker
│   │       ├── AuthorityManager.tsx     # Authority CRUD
│   │       ├── TreeView.tsx             # Tree visualization
│   │       ├── GraphView.tsx            # Graph visualization
│   │       └── TimelineView.tsx         # Timeline visualization
│   │
│   ├── hooks/
│   │   ├── useLetters.ts
│   │   ├── useAuthorities.ts
│   │   └── useLetterGraph.ts
│   │
│   └── types/
│       └── index.ts                # Add letter types
│
└── preload/
    └── index.ts                    # Add letters API
```

---

## Summary

This design provides a comprehensive Letters module that:

1. **Integrates seamlessly** with existing Topics, Records, and Outlook features
2. **Maintains full traceability** through drafts, references, and audit logging
3. **Offers flexible visualization** via Tree, Graph, and Timeline views
4. **Supports offline-first** architecture with portable folder storage
5. **Scales well** through optimized queries, virtual scrolling, and lazy loading
6. **Handles edge cases** with proper validation and error handling

The modular design allows incremental implementation while maintaining system stability.
