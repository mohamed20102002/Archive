// User types
export interface User {
  id: string
  username: string
  display_name: string
  role: 'admin' | 'user'
  is_active: boolean
  created_at: string
  updated_at: string
  last_login_at: string | null
}

// Topic types
export interface Topic {
  id: string
  title: string
  description: string | null
  status: 'active' | 'archived' | 'closed'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  // Computed fields
  record_count?: number
  last_activity?: string
  creator?: User
}

export interface CreateTopicData {
  title: string
  description?: string
  status?: 'active' | 'archived' | 'closed'
  priority?: 'low' | 'normal' | 'high' | 'urgent'
}

export interface UpdateTopicData {
  title?: string
  description?: string
  status?: 'active' | 'archived' | 'closed'
  priority?: 'low' | 'normal' | 'high' | 'urgent'
}

// Subcategory types
export interface Subcategory {
  id: string
  topic_id: string
  title: string
  description: string | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  record_count?: number
  creator_name?: string
}

export interface CreateSubcategoryData {
  topic_id: string
  title: string
  description?: string
}

export interface UpdateSubcategoryData {
  title?: string
  description?: string
}

// Record types
export type RecordType = 'note' | 'email' | 'document' | 'event' | 'decision'

export interface Record {
  id: string
  topic_id: string
  subcategory_id: string | null
  type: RecordType
  title: string
  content: string | null
  email_id: string | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  // Computed fields
  creator?: User
  creator_name?: string
  email?: Email
  subcategory_title?: string
}

export interface CreateRecordData {
  topic_id: string
  subcategory_id?: string
  type: RecordType
  title: string
  content?: string
  email_id?: string
}

export interface UpdateRecordData {
  title?: string
  content?: string
  type?: RecordType
  subcategory_id?: string | null
}

// Email types
export interface Email {
  id: string
  subject: string
  sender: string
  sender_name: string | null
  recipients: string
  cc: string | null
  bcc: string | null
  sent_at: string | null
  received_at: string | null
  has_attachments: boolean
  attachment_count: number
  attachment_names: string | null
  importance: 'low' | 'normal' | 'high'
  outlook_entry_id: string | null
  outlook_store_id: string | null
  folder_path: string | null
  storage_path: string
  file_size: number | null
  checksum: string | null
  body_preview?: string | null
  archived_by: string
  archived_at: string
}

export interface OutlookEmail {
  entryId: string
  storeId: string
  subject: string
  sender: string
  senderName: string
  recipients: string[]
  cc: string[]
  sentAt: string
  receivedAt: string
  hasAttachments: boolean
  attachmentCount: number
  attachmentNames: string[]
  importance: number
  folderPath: string
  bodyPreview: string
  body: string
}

export interface OutlookMailbox {
  id: string
  name: string
  emailAddress: string
}

export interface OutlookFolder {
  id: string
  name: string
  path: string
  unreadCount: number
  totalCount: number
  hasSubfolders: boolean
  entryId: string
  storeId: string
}

// Reminder types
export interface Reminder {
  id: string
  topic_id: string | null
  record_id: string | null
  title: string
  description: string | null
  due_date: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  is_completed: boolean
  completed_at: string | null
  completed_by: string | null
  created_by: string
  created_at: string
  updated_at: string
  // Computed fields
  topic?: Topic
  creator?: User
  is_overdue?: boolean
}

export interface CreateReminderData {
  topic_id?: string
  record_id?: string
  title: string
  description?: string
  due_date: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
}

export interface UpdateReminderData {
  title?: string
  description?: string
  due_date?: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
}

// Authority types
export type AuthorityType = 'internal' | 'external' | 'government' | 'private'

export interface Authority {
  id: string
  name: string
  short_name: string | null
  type: AuthorityType
  address: string | null
  contact_email: string | null
  contact_phone: string | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  creator_name?: string
  letter_count?: number
}

export interface CreateAuthorityData {
  name: string
  short_name?: string
  type?: AuthorityType
  address?: string
  contact_email?: string
  contact_phone?: string
  notes?: string
}

export interface UpdateAuthorityData {
  name?: string
  short_name?: string
  type?: AuthorityType
  address?: string
  contact_email?: string
  contact_phone?: string
  notes?: string
}

// Letter types
export type LetterType = 'incoming' | 'outgoing' | 'internal'
export type ResponseType = 'requires_reply' | 'informational' | 'for_action' | 'for_review'
export type LetterStatus = 'pending' | 'in_progress' | 'replied' | 'closed' | 'archived'
export type LetterPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface Letter {
  id: string
  letter_type: LetterType
  response_type: ResponseType | null
  status: LetterStatus
  priority: LetterPriority
  incoming_number: string | null
  outgoing_number: string | null
  reference_number: string | null
  subject: string
  summary: string | null
  content: string | null
  authority_id: string | null
  topic_id: string
  subcategory_id: string | null
  parent_letter_id: string | null
  storage_path: string | null
  original_filename: string | null
  file_type: string | null
  file_size: number | null
  checksum: string | null
  outlook_entry_id: string | null
  outlook_store_id: string | null
  email_id: string | null
  letter_date: string | null
  received_date: string | null
  due_date: string | null
  responded_date: string | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  // Joined fields
  authority_name?: string
  authority_short_name?: string
  topic_title?: string
  subcategory_title?: string
  creator_name?: string
  attachment_count?: number
  draft_count?: number
  reference_count?: number
}

export interface CreateLetterData {
  letter_type: LetterType
  response_type?: ResponseType
  status?: LetterStatus
  priority?: LetterPriority
  incoming_number?: string
  outgoing_number?: string
  reference_number?: string
  subject: string
  summary?: string
  content?: string
  authority_id?: string
  topic_id: string
  subcategory_id?: string
  parent_letter_id?: string
  outlook_entry_id?: string
  outlook_store_id?: string
  email_id?: string
  letter_date?: string
  received_date?: string
  due_date?: string
}

export interface UpdateLetterData {
  letter_type?: LetterType
  response_type?: ResponseType
  status?: LetterStatus
  priority?: LetterPriority
  incoming_number?: string
  outgoing_number?: string
  reference_number?: string
  subject?: string
  summary?: string
  content?: string
  authority_id?: string
  topic_id?: string
  subcategory_id?: string
  due_date?: string
  responded_date?: string
}

export interface LetterSearchParams {
  query?: string
  letter_type?: LetterType
  status?: LetterStatus
  priority?: LetterPriority
  authority_id?: string
  topic_id?: string
  subcategory_id?: string
  from_date?: string
  to_date?: string
  has_attachments?: boolean
  requires_reply?: boolean
  limit?: number
  offset?: number
}

// Letter Draft types
export type DraftStatus = 'draft' | 'review' | 'approved' | 'sent' | 'superseded'

export interface LetterDraft {
  id: string
  letter_id: string
  version: number
  title: string
  content: string | null
  notes: string | null
  storage_path: string | null
  original_filename: string | null
  file_type: string | null
  file_size: number | null
  checksum: string | null
  status: DraftStatus
  is_final: boolean
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  creator_name?: string
}

export interface CreateDraftData {
  letter_id: string
  title: string
  content?: string
  notes?: string
}

export interface UpdateDraftData {
  title?: string
  content?: string
  notes?: string
  status?: DraftStatus
}

// Letter Reference types
export type ReferenceType = 'reply_to' | 'related' | 'supersedes' | 'amends' | 'attachment_to'

export interface LetterReference {
  id: string
  source_letter_id: string
  target_letter_id: string
  reference_type: ReferenceType
  notes: string | null
  created_by: string
  created_at: string
  // Joined fields
  source_letter?: Letter
  target_letter?: Letter
  creator_name?: string
  // Additional fields from query
  source_subject?: string
  source_reference_number?: string
  source_letter_type?: LetterType
  source_status?: LetterStatus
  target_subject?: string
  target_reference_number?: string
  target_letter_type?: LetterType
  target_status?: LetterStatus
}

export interface CreateReferenceData {
  source_letter_id: string
  target_letter_id: string
  reference_type?: ReferenceType
  notes?: string
}

export interface LetterWithReferences extends Letter {
  references_to: LetterReference[]
  referenced_by: LetterReference[]
}

export interface LetterGraphNode {
  letter: Letter
  children: LetterGraphNode[]
  parents: LetterGraphNode[]
  depth: number
}

// Letter Statistics
export interface LetterStats {
  total: number
  byType: Record<string, number>
  byStatus: Record<string, number>
  byPriority: Record<string, number>
  pendingReplies: number
  overdueCount: number
}

// Process Flow Visualization Types
export interface ProcessFlowNode {
  id: string
  type: 'letter' | 'draft'
  letter_type?: string
  status: string
  subject: string
  reference_number: string | null
  date: string | null
  is_final?: boolean
  version?: number
}

export interface ProcessFlowEdge {
  source: string
  target: string
  type: ReferenceType | 'has_draft'
}

export interface ProcessFlowData {
  nodes: ProcessFlowNode[]
  edges: ProcessFlowEdge[]
  rootId: string
}

// Issue types
export type IssueImportance = 'low' | 'medium' | 'high' | 'critical'
export type IssueStatus = 'open' | 'completed'
export type IssueHistoryAction = 'created' | 'field_edit' | 'importance_change' | 'reminder_change' | 'status_change' | 'comment' | 'closure_note'

export interface Issue {
  id: string
  title: string
  description: string | null
  topic_id: string | null
  subcategory_id: string | null
  importance: IssueImportance
  status: IssueStatus
  closure_note: string | null
  completed_at: string | null
  completed_by: string | null
  reminder_date: string | null
  reminder_notified: boolean
  created_by: string
  created_at: string
  updated_at: string
  // Joined fields
  topic_title?: string
  subcategory_title?: string
  creator_name?: string
  completer_name?: string
}

export interface IssueHistory {
  id: string
  issue_id: string
  action: IssueHistoryAction
  field_name: string | null
  old_value: string | null
  new_value: string | null
  comment: string | null
  created_by: string
  created_at: string
  creator_name?: string
}

export interface CreateIssueData {
  title: string
  description?: string
  topic_id?: string
  subcategory_id?: string
  importance?: IssueImportance
  reminder_date?: string
}

export interface UpdateIssueData {
  title?: string
  description?: string
  topic_id?: string
  subcategory_id?: string
  importance?: IssueImportance
  reminder_date?: string | null
}

export interface IssueFilters {
  query?: string
  topic_id?: string
  importance?: IssueImportance
  has_reminder?: boolean
  min_age_days?: number
}

// Audit types
export type AuditAction =
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'USER_LOGIN_FAILED'
  | 'TOPIC_CREATE'
  | 'TOPIC_UPDATE'
  | 'TOPIC_DELETE'
  | 'SUBCATEGORY_CREATE'
  | 'SUBCATEGORY_UPDATE'
  | 'SUBCATEGORY_DELETE'
  | 'RECORD_CREATE'
  | 'RECORD_UPDATE'
  | 'RECORD_DELETE'
  | 'EMAIL_ARCHIVE'
  | 'EMAIL_DELETE'
  | 'REMINDER_CREATE'
  | 'REMINDER_UPDATE'
  | 'REMINDER_COMPLETE'
  | 'REMINDER_DELETE'
  | 'AUTHORITY_CREATE'
  | 'AUTHORITY_UPDATE'
  | 'AUTHORITY_DELETE'
  | 'LETTER_CREATE'
  | 'LETTER_UPDATE'
  | 'LETTER_DELETE'
  | 'LETTER_FILE_UPLOAD'
  | 'DRAFT_CREATE'
  | 'DRAFT_UPDATE'
  | 'DRAFT_APPROVE'
  | 'DRAFT_SENT'
  | 'DRAFT_DELETE'
  | 'DRAFT_FILE_UPLOAD'
  | 'REFERENCE_CREATE'
  | 'REFERENCE_UPDATE'
  | 'REFERENCE_DELETE'
  | 'ISSUE_CREATE'
  | 'ISSUE_UPDATE'
  | 'ISSUE_CLOSE'
  | 'ISSUE_REOPEN'
  | 'ISSUE_COMMENT'
  | 'CREDENTIAL_CREATE'
  | 'CREDENTIAL_UPDATE'
  | 'CREDENTIAL_DELETE'
  | 'CREDENTIAL_VIEW_PASSWORD'
  | 'SECURE_REFERENCE_CREATE'
  | 'SECURE_REFERENCE_UPDATE'
  | 'SECURE_REFERENCE_DELETE'
  | 'SECURE_REFERENCE_FILE_ADD'
  | 'SECURE_REFERENCE_FILE_DELETE'
  | 'SYSTEM_STARTUP'
  | 'SYSTEM_SHUTDOWN'

export interface AuditEntry {
  id: number
  timestamp: string
  user_id: string | null
  username: string | null
  action: AuditAction
  entity_type: string | null
  entity_id: string | null
  details: string | null
  previous_checksum: string
  checksum: string
}

export interface AuditLogOptions {
  limit?: number
  offset?: number
  action?: AuditAction
  userId?: string
  entityType?: string
  entityId?: string
  startDate?: string
  endDate?: string
}

export interface AuditStats {
  totalEntries: number
  entriesByAction: Record<string, number>
  entriesByUser: Record<string, number>
  recentActivity: AuditEntry[]
}

// Tag types
export interface Tag {
  id: string
  name: string
  color: string
  created_at: string
}

// Attachment types
export interface Attachment {
  id: string
  record_id: string
  filename: string
  filepath: string
  file_size: number | null
  mime_type: string | null
  checksum: string | null
  created_at: string
}

// Letter Attachment types
export interface LetterAttachment {
  id: string
  letter_id: string
  draft_id: string | null
  filename: string
  storage_path: string
  file_type: string | null
  file_size: number | null
  checksum: string | null
  created_by: string
  created_at: string
  deleted_at: string | null
  creator_name?: string
}

// API response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Handover types
export interface HandoverRecord {
  record_id: string
  editor: string
  action: string
  timestamp: string
  title: string
  content: string | null
  type: string
  email_id: string | null
  topic_title: string
  topic_id: string
  email_path: string | null
  subcategory_id: string | null
  subcategory_title: string | null
}

export interface Handover {
  id: string
  week_number: number
  year: number
  start_date: string
  end_date: string
  file_path: string
  record_count: number
  created_by: string
  created_at: string
  creator_name?: string
}

export interface WeekInfo {
  weekNumber: number
  year: number
  startDate: string
  endDate: string
  displayText: string
}

// Search types
export interface SearchResult {
  type: 'topic' | 'record' | 'email'
  id: string
  title: string
  snippet: string
  timestamp: string
  topicId?: string
  topicTitle?: string
}

// Credential types
export type CredentialCategory = 'Software' | 'Desktop' | 'Server' | 'Network' | 'Other'
export type ReferenceCategory = 'General' | 'Policy' | 'Procedure' | 'Template' | 'Guide' | 'Other'

export interface Credential {
  id: string
  system_name: string
  username: string
  category: CredentialCategory
  description: string | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  creator_name?: string
}

export interface CreateCredentialData {
  system_name: string
  username: string
  password: string
  category?: CredentialCategory
  description?: string
  notes?: string
}

export interface UpdateCredentialData {
  system_name?: string
  username?: string
  password?: string
  category?: CredentialCategory
  description?: string
  notes?: string
}

export interface SecureReference {
  id: string
  name: string
  description: string | null
  category: ReferenceCategory
  created_by: string
  created_at: string
  updated_at: string
  creator_name?: string
  file_count?: number
}

export interface SecureReferenceFile {
  id: string
  reference_id: string
  filename: string
  storage_path: string
  file_type: string | null
  file_size: number | null
  checksum: string | null
  created_by: string
  created_at: string
  creator_name?: string
}

export interface CreateReferenceData {
  name: string
  description?: string
  category?: ReferenceCategory
}

export interface UpdateReferenceData {
  name?: string
  description?: string
  category?: ReferenceCategory
}

export interface SecureResourceStats {
  totalCredentials: number
  totalReferences: number
  credentialsByCategory: Record<string, number>
  referencesByCategory: Record<string, number>
}

// UI State types
export interface ModalState {
  isOpen: boolean
  data?: unknown
}

export interface FilterState {
  search: string
  status?: string
  priority?: string
  dateRange?: {
    start: string
    end: string
  }
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}
