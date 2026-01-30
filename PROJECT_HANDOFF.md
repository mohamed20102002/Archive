# Project Data Archiving System - Handoff Document

**Date:** January 28, 2026
**Last Updated By:** Claude Opus 4.5

---

## Project Overview

A portable, offline-first Electron desktop application for archiving departmental emails and records with Outlook integration, user authentication, and immutable audit trails.

## Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | Electron 28+ |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS |
| Database | better-sqlite3 (synchronous, embedded) |
| Auth | Argon2 + JWT |
| Outlook | winax (Windows COM automation) |
| Build | Vite + electron-vite |

---

## Project Structure

```
D:\Database project\
├── package.json
├── vite.config.ts
├── electron.vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── src/
│   ├── main/                      # Electron main process
│   │   ├── index.ts               # App entry point
│   │   ├── database/
│   │   │   ├── connection.ts      # SQLite connection
│   │   │   ├── schema.ts          # Database schema
│   │   │   └── audit.ts           # Audit logging with checksums
│   │   ├── services/
│   │   │   ├── auth.service.ts    # Authentication logic
│   │   │   ├── topic.service.ts   # Topic CRUD
│   │   │   ├── record.service.ts  # Record CRUD
│   │   │   ├── email.service.ts   # Email archiving
│   │   │   ├── outlook.service.ts # Outlook COM integration
│   │   │   └── reminder.service.ts# Deadline reminders
│   │   ├── ipc/
│   │   │   └── handlers.ts        # IPC message handlers
│   │   └── utils/
│   │       ├── crypto.ts          # Hashing utilities
│   │       └── fileSystem.ts      # File operations
│   ├── renderer/                  # React frontend
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── layout/            # Sidebar, Header, MainLayout
│   │   │   ├── auth/              # LoginForm, UserBadge, ChangePasswordModal
│   │   │   ├── topics/            # TopicList, TopicForm, TopicCard
│   │   │   ├── records/           # Timeline, RecordCard, RecordForm
│   │   │   ├── outlook/           # OutlookBrowser, MailboxTree, EmailList, EmailPreview
│   │   │   ├── reminders/         # ReminderList, ReminderForm, ReminderBadge
│   │   │   ├── audit/             # AuditLog
│   │   │   ├── users/             # UserManagement
│   │   │   └── common/            # Modal, Button, Input, Toast
│   │   ├── context/
│   │   │   ├── AuthContext.tsx
│   │   │   └── ToastContext.tsx
│   │   └── types/
│   │       └── index.ts
│   └── preload/
│       └── index.ts               # Secure IPC bridge
├── data/                          # Runtime data (SQLite databases)
└── emails/                        # Archived email files
```

---

## Completed Features

### 1. Authentication System
- User login/logout with JWT tokens
- Password hashing with Argon2
- Role-based access (admin/user)
- First-run admin account setup
- Change password (for own account)
- Reset password (admin can reset any user's password)
- **User management with username editing** (most recent feature)

### 2. Topic Management
- Create, edit, delete topics
- Search topics

### 3. Records & Timeline
- Add records to topics
- Chronological timeline view
- Email metadata display
- "Open Email" button for archived emails

### 4. Outlook Integration
- Connect to Outlook via COM automation
- Browse mailboxes and folders (filtered to Inbox, Sent, Drafts only)
- View email list with archived indicators (green checkmark)
- Email preview with proper display names (parses Exchange internal addresses)
- Archive emails to topics (saves .msg file)
- State persistence (remembers selected mailbox/folder when navigating away)

### 5. Reminder System
- Create reminders with deadlines
- View upcoming/overdue reminders
- Desktop notifications

### 6. Audit Log
- Immutable audit trail with SHA-256 checksums
- View audit history

---

## Recent Changes (Current Session)

### Username Editing Feature
**Files Modified:**

1. **`src/main/services/auth.service.ts`** (lines 217-276)
   - Added `username` as optional field in `updateUser` function
   - Added duplicate username validation:
   ```typescript
   if (updates.username !== undefined) {
     const existingUser = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(updates.username, id)
     if (existingUser) {
       return { success: false, error: 'Username already exists' }
     }
     fields.push('username = ?')
     values.push(updates.username)
   }
   ```

2. **`src/renderer/components/users/UserManagement.tsx`**
   - Updated `EditUserData` interface to include `username`
   - Updated `handleOpenEditUser` to initialize username
   - Updated `handleSaveEditUser` to validate and submit username changes
   - Enabled username input field in Edit User modal (removed disabled state)

---

## Key Implementation Details

### Outlook Service (`outlook.service.ts`)

**Folder Filtering:**
```typescript
const ALLOWED_FOLDER_NAMES = ['inbox', 'sent items', 'sent', 'drafts', 'draft']
```

**Display Name Extraction (for Exchange addresses):**
```typescript
function extractDisplayName(address: string, fallbackName?: string): string {
  if (!address) return fallbackName || 'Unknown'
  if (!address.startsWith('/o=') && !address.startsWith('/O=')) {
    return address
  }
  const cnMatch = address.match(/cn=([^\/]+)$/i)
  if (cnMatch) {
    const cnPart = cnMatch[1]
    const hyphenIndex = cnPart.indexOf('-')
    if (hyphenIndex > 0 && hyphenIndex < cnPart.length - 1) {
      return cnPart.substring(hyphenIndex + 1).replace(/([a-z])([A-Z])/g, '$1 $2')
    }
    return cnPart
  }
  return fallbackName || address
}
```

**Date Formatting (preserves local time):**
```typescript
function formatOutlookDate(date: any): string {
  if (!date) return ''
  try {
    const d = new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const seconds = String(d.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
  } catch {
    return ''
  }
}
```

### Email Service (`email.service.ts`)

**Key Functions:**
- `archiveEmail()` - Saves email as .msg file and creates database record
- `isEmailArchived(outlookEntryId)` - Checks if email is already archived
- `getArchivedEmailIds()` - Returns all archived Outlook entry IDs
- `openEmailFile(emailId)` - Opens the archived .msg file

### State Persistence (`OutlookBrowser.tsx`)

```typescript
const STORAGE_KEYS = {
  selectedMailboxId: 'outlook_selected_mailbox_id',
  selectedFolderId: 'outlook_selected_folder_id'
}
```

---

## IPC Handlers Reference (`handlers.ts`)

### Auth
- `auth:login` - Login with username/password
- `auth:logout` - Logout
- `auth:verifyToken` - Verify JWT token
- `auth:createUser` - Create new user
- `auth:getAllUsers` - Get all users
- `auth:updateUser` - Update user (including username now)
- `auth:changePassword` - User changes own password
- `auth:resetPassword` - Admin resets user password
- `auth:hasAdminUser` - Check if admin exists

### Emails
- `emails:archive` - Archive email to topic
- `emails:getById` - Get email by ID
- `emails:getByRecord` - Get email by record ID
- `emails:search` - Search emails
- `emails:isArchived` - Check if email is archived
- `emails:getArchivedIds` - Get all archived email IDs
- `emails:openFile` - Open archived .msg file

### Outlook
- `outlook:connect` - Connect to Outlook
- `outlook:disconnect` - Disconnect
- `outlook:isConnected` - Check connection status
- `outlook:getMailboxes` - Get mailbox list
- `outlook:getFolders` - Get folders for mailbox
- `outlook:getEmails` - Get emails from folder
- `outlook:getEmailDetails` - Get full email details

---

## Known Issues / Past Fixes

1. **Stale compiled code** - If changes don't appear, run:
   ```bash
   rm -rf dist out node_modules/.vite
   npm run dev
   ```

2. **Password validation mismatch** - Frontend and backend both require 8 characters minimum

3. **getEmailDetails returning null** - Was a TODO placeholder, now properly implemented

4. **Missing storeId parameter** - Email fetching required storeId to be passed through all layers

---

## Commands

```bash
# Development
npm run dev

# Build
npm run build

# Clean build artifacts
rm -rf dist out node_modules/.vite
```

---

## Next Steps / Potential Improvements

1. Add search functionality across all records
2. Export audit log to file
3. Backup/restore functionality
4. Multiple email selection for batch archiving
5. Email attachment preview
6. Dark mode theme

---

## Database Schema

### Users Table
- id, username, password_hash, display_name, role, is_active, created_at, updated_at, last_login_at

### Topics Table
- id, name, description, created_by, created_at, updated_at, is_deleted

### Records Table
- id, topic_id, title, content, record_type, created_by, created_at, updated_at, is_deleted

### Emails Table
- id, record_id, outlook_entry_id, subject, from_address, from_name, to_addresses, cc_addresses, sent_at, received_at, file_path, created_at

### Reminders Table
- id, topic_id, record_id, title, description, due_date, is_completed, created_by, created_at

### Audit Log Table
- id, action, user_id, username, entity_type, entity_id, details, checksum, created_at

---

*This document can be shared to continue development in another session.*
