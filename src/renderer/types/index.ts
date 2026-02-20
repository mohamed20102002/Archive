// User types
export interface User {
  id: string
  username: string
  display_name: string
  arabic_name: string | null
  role: 'admin' | 'user'
  is_active: boolean
  employee_number: string | null
  shift_id: string | null
  sort_order: number
  created_at: string
  updated_at: string
  last_login_at: string | null
  deleted_at: string | null
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
  creator_name?: string
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

// Record types (email is created via Outlook archiving, not manually)
export type RecordType = 'note' | 'email' | 'document' | 'event' | 'decision'

export interface LinkedMomInfo {
  id: string
  mom_id: string
  title: string
  deleted?: boolean
}

export interface LinkedLetterInfo {
  id: string
  reference_number: string
  subject: string
  deleted?: boolean
}

export interface Record {
  id: string
  topic_id: string
  subcategory_id: string | null
  type: RecordType
  title: string
  content: string | null
  email_id: string | null
  linked_mom_id: string | null
  linked_letter_id: string | null
  record_date: string // The date the record is associated with (for display and shift handover)
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  // Computed fields
  creator?: User
  creator_name?: string
  email?: Email
  subcategory_title?: string
  // Legacy single link (backwards compatibility)
  linked_mom?: LinkedMomInfo
  linked_letter?: LinkedLetterInfo
  // Multiple links
  linked_moms?: LinkedMomInfo[]
  linked_letters?: LinkedLetterInfo[]
}

export interface CreateRecordData {
  topic_id: string
  subcategory_id?: string
  type: RecordType
  title: string
  content?: string
  email_id?: string
  linked_mom_id?: string
  linked_letter_id?: string
  record_date?: string // Defaults to today if not provided
}

export interface UpdateRecordData {
  title?: string
  content?: string
  type?: RecordType
  subcategory_id?: string | null
  linked_mom_id?: string | null
  linked_letter_id?: string | null
  record_date?: string
}

// Record Attachment types
export interface RecordAttachment {
  id: string
  record_id: string
  filename: string
  filepath: string
  file_size: number | null
  mime_type: string | null
  checksum: string | null
  created_at: string
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
  topic_title?: string
  record_title?: string
  creator?: User
  creator_name?: string
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
  is_internal: boolean
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
  is_internal?: boolean
  address?: string
  contact_email?: string
  contact_phone?: string
  notes?: string
}

export interface UpdateAuthorityData {
  name?: string
  short_name?: string
  type?: AuthorityType
  is_internal?: boolean
  address?: string
  contact_email?: string
  contact_phone?: string
  notes?: string
}

// Contact types (for external letter addressees)
export interface Contact {
  id: string
  name: string
  title: string | null
  authority_id: string | null
  email: string | null
  phone: string | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  // Joined fields
  authority_name?: string
  authority_short_name?: string
  creator_name?: string
}

export interface CreateContactData {
  name: string
  title?: string
  authority_id?: string
  email?: string
  phone?: string
  notes?: string
}

export interface UpdateContactData {
  name?: string
  title?: string
  authority_id?: string
  email?: string
  phone?: string
  notes?: string
}

// Letter types
export type LetterType = 'incoming' | 'outgoing' | 'internal'
export type ResponseType = 'requires_reply' | 'informational' | 'for_action' | 'for_review'
export type LetterStatus = 'pending' | 'in_progress' | 'replied' | 'closed' | 'archived'
export type LetterPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface Letter {
  id: string
  letter_id?: string | null
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
  contact_id: string | null
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
  is_notification: boolean
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
  authority_is_internal?: boolean
  contact_name?: string
  contact_title?: string
  topic_title?: string
  subcategory_title?: string
  creator_name?: string
  attachment_count?: number
  draft_count?: number
  reference_count?: number
}

export interface CreateLetterData {
  letter_id?: string
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
  contact_id?: string
  topic_id: string
  subcategory_id?: string
  parent_letter_id?: string
  outlook_entry_id?: string
  outlook_store_id?: string
  email_id?: string
  is_notification?: boolean
  letter_date?: string
  received_date?: string
  due_date?: string
}

export interface UpdateLetterData {
  letter_id?: string
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
  contact_id?: string
  topic_id?: string
  subcategory_id?: string
  is_notification?: boolean
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
  deleted_reason?: string | null
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
  linked_records?: { record_id: string; record_title: string | null; topic_title: string | null; topic_id: string | null; deleted_reason?: string | null }[]
  edit_count?: number
}

export interface CommentEdit {
  id: string
  history_id: string
  old_comment: string
  edited_by: string
  edited_at: string
  editor_name?: string
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
  | 'CONTACT_CREATE'
  | 'CONTACT_UPDATE'
  | 'CONTACT_DELETE'
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
  | 'ATTENDANCE_CONDITION_CREATE'
  | 'ATTENDANCE_CONDITION_UPDATE'
  | 'ATTENDANCE_CONDITION_DELETE'
  | 'ATTENDANCE_ENTRY_SAVE'
  | 'ATTENDANCE_ENTRY_DELETE'
  | 'ATTENDANCE_PDF_EXPORT'
  | 'SHIFT_CREATE'
  | 'SHIFT_UPDATE'
  | 'SHIFT_DELETE'
  | 'SETTINGS_UPDATE'
  | 'MOM_CREATE'
  | 'MOM_UPDATE'
  | 'MOM_DELETE'
  | 'MOM_CLOSE'
  | 'MOM_REOPEN'
  | 'MOM_FILE_UPLOAD'
  | 'MOM_ACTION_CREATE'
  | 'MOM_ACTION_UPDATE'
  | 'MOM_ACTION_RESOLVE'
  | 'MOM_ACTION_REOPEN'
  | 'MOM_DRAFT_CREATE'
  | 'MOM_DRAFT_DELETE'
  | 'MOM_DRAFT_FILE_UPLOAD'
  | 'MOM_TOPIC_LINK'
  | 'MOM_TOPIC_UNLINK'
  | 'MOM_RECORD_LINK'
  | 'MOM_RECORD_UNLINK'
  | 'MOM_LOCATION_CREATE'
  | 'MOM_LOCATION_UPDATE'
  | 'MOM_LOCATION_DELETE'
  | 'BACKUP_CREATE'
  | 'BACKUP_RESTORE'
  | 'BACKUP_ROLLBACK'
  | 'BACKUP_FAILED'
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

// App Settings types
export type LoginBackgroundStyle = 'atom' | 'particles' | 'dna' | 'wave' | 'galaxy' | 'fission' | 'neural' | 'matrix' | 'none'

// Available sidebar tabs
export const SIDEBAR_TABS = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/topics', label: 'Topics' },
  { path: '/issues', label: 'Open Issues' },
  { path: '/reminders', label: 'Reminders' },
  { path: '/mentions', label: 'Mentions' },
  { path: '/calendar', label: 'Calendar' },
  { path: '/search', label: 'Advanced Search' },
  { path: '/mom', label: 'Minutes of Meeting' },
  { path: '/letters', label: 'Letters' },
  { path: '/outlook', label: 'Outlook' },
  { path: '/scheduled-emails', label: 'Scheduled Emails' },
  { path: '/handover', label: 'Shift Handover' },
  { path: '/secure-resources', label: 'Secure Resources' },
  { path: '/attendance', label: 'Attendance' },
] as const

export type SidebarTabPath = typeof SIDEBAR_TABS[number]['path']

export interface AppSettings {
  department_name: string
  department_name_arabic: string
  theme: 'light' | 'dark'
  default_view: string
  default_view_mode: 'card' | 'table'
  date_format: string
  login_animation_speed: number // Animation speed multiplier (1 = normal, 2 = 2x, etc.)
  login_background_style: LoginBackgroundStyle // Background animation style
  show_floating_console: boolean // Show floating console for admins
  backup_reminder_days: number // Days between backup reminders (0 = disabled)
  visible_tabs: string[] // Array of tab paths that should be visible (empty = all visible)
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

// Resource color labels
export type ResourceColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | null

export const RESOURCE_COLORS = [
  { value: null, label: 'None', class: '' },
  { value: 'red', label: 'Red', class: 'bg-red-500' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-500' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500' },
  { value: 'green', label: 'Green', class: 'bg-green-500' },
  { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' }
] as const

// Resource category types (dynamic categories from database)
export interface ResourceCategory {
  id: string
  name: string
  type: 'credential' | 'reference'
  display_order: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateResourceCategoryData {
  name: string
  type: 'credential' | 'reference'
  display_order?: number
}

export interface UpdateResourceCategoryData {
  name?: string
  display_order?: number
}

// Credential types (legacy static categories for backwards compatibility)
export type CredentialCategory = 'Software' | 'Desktop' | 'Server' | 'Network' | 'Other'
export type ReferenceCategory = 'General' | 'Policy' | 'Procedure' | 'Template' | 'Guide' | 'Other'

export interface Credential {
  id: string
  system_name: string
  username: string
  category: string // Now dynamic string instead of CredentialCategory
  description: string | null
  notes: string | null
  admin_only: boolean
  color: ResourceColor
  created_by: string
  created_at: string
  updated_at: string
  creator_name?: string
}

export interface CreateCredentialData {
  system_name: string
  username: string
  password: string
  category?: string
  description?: string
  notes?: string
  admin_only?: boolean
  color?: ResourceColor
}

export interface UpdateCredentialData {
  system_name?: string
  username?: string
  password?: string
  category?: string
  description?: string
  notes?: string
  admin_only?: boolean
  color?: ResourceColor
}

export interface SecureReference {
  id: string
  name: string
  description: string | null
  category: string // Now dynamic string instead of ReferenceCategory
  admin_only: boolean
  color: ResourceColor
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
  is_encrypted: boolean
  created_by: string
  created_at: string
  creator_name?: string
}

export interface CreateReferenceData {
  name: string
  description?: string
  category?: string
  admin_only?: boolean
  color?: ResourceColor
}

export interface UpdateReferenceData {
  name?: string
  description?: string
  category?: string
  admin_only?: boolean
  color?: ResourceColor
}

export interface SecureResourceStats {
  totalCredentials: number
  totalReferences: number
  credentialsByCategory: Record<string, number>
  referencesByCategory: Record<string, number>
}

// Shift types
export interface Shift {
  id: string
  name: string
  sort_order: number
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CreateShiftData {
  name: string
  sort_order?: number
}

export interface UpdateShiftData {
  name?: string
  sort_order?: number
}

// Attendance types
export interface AttendanceCondition {
  id: string
  name: string
  color: string
  sort_order: number
  display_number: number
  is_ignored: boolean
  hides_times: boolean
  is_fallback: boolean
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CreateAttendanceConditionData {
  name: string
  color: string
  sort_order?: number
  display_number?: number
  is_ignored?: boolean
  hides_times?: boolean
}

export interface UpdateAttendanceConditionData {
  name?: string
  color?: string
  sort_order?: number
  display_number?: number
  is_ignored?: boolean
  hides_times?: boolean
}

export interface AttendanceEntry {
  id: string
  user_id: string
  entry_date: string
  year: number
  month: number
  day: number
  shift_id: string | null
  shift_name: string | null
  sign_in_time: string | null
  sign_out_time: string | null
  note: string | null
  created_by: string
  created_by_name?: string
  created_at: string
  updated_at: string
  conditions: AttendanceCondition[]
  user_display_name?: string
}

export interface SaveAttendanceEntryData {
  user_id: string
  entry_date: string
  shift_id: string
  condition_ids: string[]
  sign_in_time?: string
  sign_out_time?: string
  note?: string
}

export interface AttendanceFilters {
  user_id?: string
  year: number
  month?: number
  shift_id?: string
  condition_id?: string
}

export interface AttendanceSummary {
  user_id: string
  user_display_name: string
  year: number
  condition_totals: Record<string, number>
  total_entries: number
  shift_totals: Record<string, number>
}

// MOM types
export type MomStatus = 'open' | 'closed'
export type MomActionStatus = 'open' | 'resolved'
export type MomHistoryAction =
  | 'created'
  | 'field_edit'
  | 'action_created'
  | 'action_updated'
  | 'action_resolved'
  | 'action_reopened'
  | 'action_reminder_change'
  | 'draft_added'
  | 'status_change'
  | 'topic_linked'
  | 'topic_unlinked'
  | 'record_linked'
  | 'record_unlinked'
  | 'letter_linked'
  | 'letter_unlinked'
  | 'file_uploaded'

export interface MomLocation {
  id: string
  name: string
  description: string | null
  sort_order: number
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Mom {
  id: string
  mom_id: string | null
  title: string
  subject: string | null
  meeting_date: string | null
  location_id: string | null
  status: MomStatus
  storage_path: string | null
  original_filename: string | null
  file_type: string | null
  file_size: number | null
  checksum: string | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  // Joined fields
  location_name?: string
  creator_name?: string
  topic_count?: number
  record_count?: number
  action_total?: number
  action_resolved?: number
  action_overdue?: number
}

export interface MomAction {
  id: string
  mom_internal_id: string
  description: string
  responsible_party: string | null
  deadline: string | null
  reminder_date: string | null
  reminder_notified: boolean
  status: MomActionStatus
  resolution_note: string | null
  resolution_file_path: string | null
  resolution_filename: string | null
  resolution_file_size: number | null
  resolved_by: string | null
  resolved_at: string | null
  created_by: string
  created_at: string
  updated_at: string
  // Joined fields
  creator_name?: string
  resolver_name?: string
  mom_display_id?: string
  mom_title?: string
}

export interface MomDraft {
  id: string
  mom_internal_id: string
  version: number
  title: string
  description: string | null
  storage_path: string | null
  original_filename: string | null
  file_type: string | null
  file_size: number | null
  checksum: string | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  creator_name?: string
}

export interface MomHistory {
  id: string
  mom_internal_id: string
  action: MomHistoryAction
  field_name: string | null
  old_value: string | null
  new_value: string | null
  details: string | null
  created_by: string
  created_at: string
  creator_name?: string
}

export interface MomTopicLink {
  id: string
  mom_internal_id: string
  topic_id: string
  created_by: string
  created_at: string
  topic_title?: string | null
  deleted_reason?: string | null
}

export interface MomRecordLink {
  id: string
  mom_internal_id: string
  record_id: string
  created_by: string
  created_at: string
  record_title?: string | null
  topic_title?: string | null
  topic_id?: string | null
  deleted_reason?: string | null
}

export interface MomStats {
  total: number
  open: number
  closed: number
  overdueActions: number
}

export interface MomFilters {
  query?: string
  status?: MomStatus
  location_id?: string
  topic_id?: string
  date_from?: string
  date_to?: string
}

export interface MomLetterLink {
  id: string
  mom_internal_id: string
  letter_id: string
  letter_display_id: string | null
  letter_subject: string | null
  letter_type: string | null
  letter_reference_number: string | null
  created_at: string
  deleted_reason?: string | null
}

export interface LetterMomLink {
  id: string
  letter_id: string
  mom_internal_id: string
  mom_display_id: string | null
  mom_title: string
  mom_status: string
  created_at: string
}

export interface CreateMomData {
  mom_id?: string
  title: string
  subject?: string
  meeting_date?: string
  location_id?: string
  topic_ids?: string[]
  record_ids?: string[]
  tag_ids?: string[]
  mentions?: MentionWithNote[]
}

export interface UpdateMomData {
  title?: string
  subject?: string
  meeting_date?: string
  location_id?: string
  tag_ids?: string[]
}

export interface CreateMomLocationData {
  name: string
  description?: string
  sort_order?: number
}

export interface UpdateMomLocationData {
  name?: string
  description?: string
  sort_order?: number
}

export interface CreateMomActionData {
  mom_internal_id: string
  description: string
  responsible_party?: string
  deadline?: string
  reminder_date?: string
}

export interface UpdateMomActionData {
  description?: string
  responsible_party?: string
  deadline?: string
  reminder_date?: string
}

export interface ResolveMomActionData {
  resolution_note: string
}

export interface CreateMomDraftData {
  mom_internal_id: string
  title: string
  description?: string
}

// Backup types
export interface BackupModuleCounts {
  topics: number
  records: number
  emails: number
  letters: number
  moms: number
  issues: number
  attendance_entries: number
  handovers: number
  reminders: number
  authorities: number
  credentials: number
  secure_references: number
  secure_reference_files: number
  scheduled_emails: number
  users: number
}

export interface BackupInfo {
  backup_date: string
  backup_by_user_id: string
  backup_by_username: string
  backup_by_display_name: string
  app_version: string
  schema_version: number
  total_size_bytes: number
  file_count: number
  module_counts: BackupModuleCounts
  includes_emails?: boolean
}

export interface BackupComparison {
  backup: BackupInfo
  current: BackupInfo
  is_backup_older: boolean
  differences: {
    module: string
    backup_count: number
    current_count: number
    diff: number
  }[]
}

export type BackupProgressPhase =
  | 'preparing'
  | 'checkpointing'
  | 'closing_db'
  | 'archiving'
  | 'finalizing'
  | 'reopening_db'
  | 'creating_rollback'
  | 'extracting'
  | 'replacing'
  | 'verifying'
  | 'complete'
  | 'error'

export interface BackupProgress {
  phase: BackupProgressPhase
  percentage: number
  message: string
  currentFile?: string
}

export interface BackupStatusFile {
  last_backup_date: string
  last_backup_user: string
  last_backup_file: string
  last_backup_size_bytes: number
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

// Scheduled Email types
export type EmailScheduleFrequency = 'daily' | 'weekly' | 'monthly'
export type EmailScheduleLanguage = 'en' | 'ar'
export type EmailInstanceStatus = 'pending' | 'sent' | 'dismissed' | 'overdue'

export interface EmailSchedule {
  id: string
  name: string
  description: string | null
  to_emails: string
  cc_emails: string | null
  subject_template: string
  body_template: string
  frequency_type: EmailScheduleFrequency
  frequency_days: string | null // JSON array of day numbers
  send_time: string
  language: EmailScheduleLanguage
  is_active: boolean
  last_generated_date: string | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  created_by_name?: string
}

export interface EmailScheduleInstance {
  id: string
  schedule_id: string
  scheduled_date: string
  scheduled_time: string
  status: EmailInstanceStatus
  sent_at: string | null
  dismissed_at: string | null
  dismissed_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
  schedule_name?: string
  to_emails?: string
  cc_emails?: string | null
  subject_template?: string
  body_template?: string
  language?: string
  dismissed_by_name?: string
}

export interface CreateEmailScheduleData {
  name: string
  description?: string
  to_emails: string
  cc_emails?: string
  subject_template: string
  body_template: string
  frequency_type: EmailScheduleFrequency
  frequency_days?: number[]
  send_time: string
  language: EmailScheduleLanguage
}

export interface UpdateEmailScheduleData {
  name?: string
  description?: string
  to_emails?: string
  cc_emails?: string
  subject_template?: string
  body_template?: string
  frequency_type?: EmailScheduleFrequency
  frequency_days?: number[]
  send_time?: string
  language?: EmailScheduleLanguage
  is_active?: boolean
}

// Mention types
export type MentionEntityType = 'record' | 'mom' | 'letter' | 'issue'
export type MentionStatus = 'pending' | 'acknowledged' | 'archived'

export interface Mention {
  id: string
  entity_type: MentionEntityType
  entity_id: string
  mentioned_user_id: string
  created_by: string
  note: string | null
  status: MentionStatus
  acknowledged_at: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  // Joined fields
  mentioned_user_name?: string
  creator_name?: string
  entity_title?: string
  topic_id?: string // For records - needed for navigation
  entity_deleted?: boolean // True if the referenced entity was deleted
}

export interface CreateMentionData {
  entity_type: MentionEntityType
  entity_id: string
  mentioned_user_id: string
  note?: string
}

export interface MentionFilters {
  status?: MentionStatus
  entity_type?: MentionEntityType
}

export interface MentionCounts {
  pending: number
  acknowledged: number
  archived: number
  sent: number
}

export interface MentionWithNote {
  user: {
    id: string
    display_name: string
    username: string
  }
  note: string
}
