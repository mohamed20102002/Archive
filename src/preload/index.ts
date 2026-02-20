import { contextBridge, ipcRenderer } from 'electron'

// Type definitions for the exposed API
export interface ElectronAPI {
  app: {
    isFirstRun: () => Promise<boolean>
    showNotification: (title: string, body: string) => Promise<void>
    getInfo: () => Promise<{ version: string; platform: string; isPackaged: boolean }>
    setWindowTitle: (title: string) => Promise<void>
    getZoomFactor: () => Promise<number>
    setZoomFactor: (factor: number) => Promise<{ success: boolean; zoomFactor?: number; error?: string }>
  }
  auth: {
    login: (username: string, password: string) => Promise<{
      success: boolean
      user?: {
        id: string
        username: string
        display_name: string
        role: 'admin' | 'user'
        is_active: boolean
        created_at: string
        updated_at: string
        last_login_at: string | null
      }
      token?: string
      error?: string
    }>
    logout: (token: string, userId: string) => Promise<void>
    verifyToken: (token: string) => Promise<{ valid: boolean; error?: string; timeoutWarning?: boolean; remainingSeconds?: number }>
    createUser: (username: string, password: string, displayName: string, role: 'admin' | 'user') => Promise<{
      success: boolean
      user?: unknown
      error?: string
    }>
    getAllUsers: () => Promise<unknown[]>
    getUserById: (id: string) => Promise<{ id: string; username: string; display_name: string; role: string } | null>
    updateUser: (id: string, updates: unknown, updatedBy: string) => Promise<{ success: boolean; error?: string }>
    changePassword: (userId: string, currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
    hasAdminUser: () => Promise<boolean>
    resetPassword: (userId: string, newPassword: string, adminId: string) => Promise<{ success: boolean; error?: string }>
    deleteUser: (userId: string, adminId: string) => Promise<{ success: boolean; error?: string }>
    checkUsername: (username: string) => Promise<{ exists: boolean; isActive: boolean }>
    // Session management
    updateSessionActivity: (token: string) => Promise<{ valid: boolean; timeoutWarning: boolean; remainingSeconds: number }>
    extendSession: (token: string) => Promise<{ success: boolean; newExpiresIn: number }>
    getSessionInfo: (token: string) => Promise<{ valid: boolean; userId?: string; lastActivity?: number; remainingSeconds?: number }>
    getSessionTimeout: () => Promise<number>
    setSessionTimeout: (minutes: number) => Promise<void>
    resetUserLockout: (username: string, adminId: string) => Promise<{ success: boolean; error?: string }>
    getUserLockoutStatus: (username: string) => Promise<{ isLocked: boolean; remainingSeconds?: number; failedAttempts?: number }>
  }
  twofa: {
    isEnabled: (userId: string) => Promise<boolean>
    setEnabled: (userId: string, enabled: boolean, adminId: string) => Promise<{ success: boolean; error?: string }>
    generateSessionToken: () => Promise<string>
    initiate: (userId: string, sessionToken: string) => Promise<{ success: boolean; maskedEmail?: string; error?: string }>
    verify: (sessionToken: string, code: string) => Promise<{ valid: boolean; error?: string; remainingAttempts?: number }>
    cancel: (sessionToken: string) => Promise<void>
    getRemainingTime: (sessionToken: string) => Promise<number | null>
  }
  search: {
    global: (query: string, limit?: number) => Promise<{
      topics: unknown[]
      records: unknown[]
      letters: unknown[]
      moms: unknown[]
      momActions: unknown[]
      issues: unknown[]
      credentials: unknown[]
      secureReferences: unknown[]
      contacts: unknown[]
      authorities: unknown[]
      totalCount: number
    }>
  }
  topics: {
    create: (data: unknown, userId: string) => Promise<{ success: boolean; topic?: unknown; error?: string }>
    getAll: () => Promise<unknown[]>
    getById: (id: string) => Promise<unknown | null>
    update: (id: string, data: unknown, userId: string) => Promise<{ success: boolean; error?: string }>
    delete: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    search: (query: string) => Promise<unknown[]>
  }
  records: {
    create: (data: unknown, userId: string) => Promise<{ success: boolean; record?: unknown; error?: string }>
    getByTopic: (topicId: string, subcategoryId?: string | null) => Promise<unknown[]>
    getById: (id: string) => Promise<unknown | null>
    update: (id: string, data: unknown, userId: string) => Promise<{ success: boolean; error?: string }>
    delete: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    search: (query: string, topicId?: string) => Promise<unknown[]>
    linkMom: (recordId: string, momId: string, userId: string) => Promise<{ success: boolean; error?: string }>
    unlinkMom: (recordId: string, momId: string, userId: string) => Promise<{ success: boolean; error?: string }>
    linkLetter: (recordId: string, letterId: string, userId: string) => Promise<{ success: boolean; error?: string }>
    unlinkLetter: (recordId: string, letterId: string, userId: string) => Promise<{ success: boolean; error?: string }>
    getLinkedMoms: (recordId: string) => Promise<unknown[]>
    getLinkedLetters: (recordId: string) => Promise<unknown[]>
  }
  recordAttachments: {
    getByRecord: (recordId: string) => Promise<unknown[]>
    add: (data: { recordId: string; filename: string; buffer: string; topicTitle: string }, userId: string) => Promise<{ success: boolean; attachment?: unknown; error?: string }>
    delete: (attachmentId: string, userId: string) => Promise<{ success: boolean; error?: string }>
    open: (attachmentId: string) => Promise<{ success: boolean; error?: string }>
    getFilePath: (attachmentId: string) => Promise<string | null>
    showInFolder: (attachmentId: string) => Promise<{ success: boolean; error?: string }>
  }
  subcategories: {
    create: (data: unknown, userId: string) => Promise<{ success: boolean; subcategory?: unknown; error?: string }>
    getByTopic: (topicId: string) => Promise<unknown[]>
    getById: (id: string) => Promise<unknown | null>
    update: (id: string, data: unknown, userId: string) => Promise<{ success: boolean; error?: string }>
    delete: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
  }
  emails: {
    archive: (emailData: unknown, topicId: string, userId: string, subcategoryId?: string) => Promise<{ success: boolean; email?: unknown; recordId?: string; error?: string }>
    getById: (id: string) => Promise<unknown | null>
    getByRecord: (recordId: string) => Promise<unknown | null>
    search: (query: string) => Promise<unknown[]>
    isArchived: (outlookEntryId: string) => Promise<{ archived: boolean; emailId?: string; topicId?: string }>
    getArchivedIds: () => Promise<string[]>
    openFile: (emailId: string) => Promise<{ success: boolean; error?: string }>
    getArchiveInfo: (outlookEntryId: string) => Promise<{ topicId: string; topicTitle: string; recordId: string; recordTitle: string; subcategoryId: string | null; subcategoryTitle: string | null; archivedAt: string } | null>
    showInFolder: (emailId: string) => Promise<{ success: boolean; error?: string }>
  }
  outlook: {
    connect: () => Promise<{ success: boolean; error?: string }>
    disconnect: () => Promise<void>
    isConnected: () => Promise<boolean>
    clearCache: () => Promise<{ success: boolean }>
    getMailboxes: () => Promise<unknown[]>
    getFolders: (mailboxId: string) => Promise<unknown[]>
    getEmails: (folderId: string, storeId: string, limit?: number) => Promise<unknown[]>
    getEmailDetails: (entryId: string, storeId: string) => Promise<unknown | null>
    composeAttendanceEmail: (date: string, attachmentPath: string, toEmails: string, ccEmails?: string, subjectTemplate?: string, bodyTemplate?: string) => Promise<{ success: boolean; error?: string }>
  }
  reminders: {
    create: (data: unknown, userId: string) => Promise<{ success: boolean; reminder?: unknown; error?: string }>
    getAll: () => Promise<unknown[]>
    getUpcoming: (days?: number) => Promise<unknown[]>
    getOverdue: () => Promise<unknown[]>
    complete: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    delete: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
  }
  audit: {
    getLog: (options?: unknown) => Promise<{ entries: unknown[]; total: number }>
    verifyIntegrity: () => Promise<{ valid: boolean; errors: string[]; checkedCount: number }>
    getStats: () => Promise<unknown>
    runBackgroundIntegrityCheck: () => Promise<{ lastCheck: string | null; isValid: boolean; errors: string[]; checkedCount: number; isChecking: boolean }>
    getIntegrityStatus: () => Promise<{ lastCheck: string | null; isValid: boolean; errors: string[]; checkedCount: number; isChecking: boolean }>
    verifyRange: (startId: number, endId: number) => Promise<{ valid: boolean; errors: string[]; checkedCount: number }>
    getLatestId: () => Promise<number>
  }
  handover: {
    getWeekInfo: () => Promise<unknown>
    getRecords: (startDate: string, endDate: string) => Promise<unknown[]>
    getSummary: (records: unknown[]) => Promise<unknown>
    export: (records: unknown[], weekInfo: unknown, userId: string, replaceExisting?: boolean) => Promise<{ success: boolean; handover?: unknown; error?: string; existingHandover?: unknown }>
    getArchives: () => Promise<unknown[]>
    deleteArchive: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    openFile: (id: string) => Promise<{ success: boolean; error?: string }>
  }
  authorities: {
    create: (data: unknown, userId: string) => Promise<{ success: boolean; authority?: unknown; error?: string }>
    getAll: () => Promise<unknown[]>
    getById: (id: string) => Promise<unknown | null>
    getByType: (type: string) => Promise<unknown[]>
    getInternal: () => Promise<unknown[]>
    getExternal: () => Promise<unknown[]>
    search: (query: string) => Promise<unknown[]>
    findByEmailDomain: (email: string) => Promise<unknown | null>
    update: (id: string, data: unknown, userId: string) => Promise<{ success: boolean; error?: string }>
    delete: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    getStats: () => Promise<{ total: number; byType: Record<string, number> }>
  }
  contacts: {
    create: (data: unknown, userId: string) => Promise<{ success: boolean; contact?: unknown; error?: string }>
    getAll: () => Promise<unknown[]>
    getById: (id: string) => Promise<unknown | null>
    getByAuthority: (authorityId: string) => Promise<unknown[]>
    search: (query: string) => Promise<unknown[]>
    update: (id: string, data: unknown, userId: string) => Promise<{ success: boolean; error?: string }>
    delete: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
  }
  letters: {
    create: (data: unknown, userId: string) => Promise<{ success: boolean; letter?: unknown; error?: string }>
    getAll: () => Promise<unknown[]>
    getById: (id: string) => Promise<unknown | null>
    getByTopic: (topicId: string, subcategoryId?: string) => Promise<unknown[]>
    getByAuthority: (authorityId: string) => Promise<unknown[]>
    search: (params: unknown) => Promise<unknown[]>
    update: (id: string, data: unknown, userId: string) => Promise<{ success: boolean; error?: string }>
    delete: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    saveFile: (letterId: string, fileBase64: string, filename: string, userId: string) => Promise<{ success: boolean; error?: string }>
    getFilePath: (letterId: string) => Promise<string | null>
    getStats: () => Promise<unknown>
    getPending: () => Promise<unknown[]>
    getOverdue: () => Promise<unknown[]>
    getByLetterId: (letterId: string) => Promise<unknown | null>
    getLinkedMoms: (letterInternalId: string) => Promise<unknown[]>
  }
  letterDrafts: {
    create: (data: unknown, userId: string) => Promise<{ success: boolean; draft?: unknown; error?: string }>
    getById: (id: string) => Promise<unknown | null>
    getByLetter: (letterId: string) => Promise<unknown[]>
    getLatest: (letterId: string) => Promise<unknown | null>
    getFinal: (letterId: string) => Promise<unknown | null>
    update: (id: string, data: unknown, userId: string) => Promise<{ success: boolean; error?: string }>
    updateStatus: (id: string, status: string, userId: string) => Promise<{ success: boolean; error?: string }>
    approve: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    markAsSent: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    delete: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    saveFile: (draftId: string, fileBase64: string, filename: string, userId: string) => Promise<{ success: boolean; error?: string }>
    getFilePath: (draftId: string) => Promise<string | null>
    showInFolder: (draftId: string) => Promise<{ success: boolean; error?: string }>
  }
  letterReferences: {
    create: (data: unknown, userId: string) => Promise<{ success: boolean; reference?: unknown; error?: string }>
    getById: (id: string) => Promise<unknown | null>
    getFrom: (letterId: string) => Promise<unknown[]>
    getTo: (letterId: string) => Promise<unknown[]>
    getAll: (letterId: string) => Promise<{ from: unknown[]; to: unknown[] }>
    getByType: (letterId: string, type: string, direction?: 'from' | 'to' | 'both') => Promise<unknown[]>
    getLetterWithRefs: (letterId: string) => Promise<unknown | null>
    update: (id: string, data: unknown, userId: string) => Promise<{ success: boolean; error?: string }>
    delete: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    buildGraph: (letterId: string, maxDepth?: number) => Promise<unknown | null>
    getChain: (letterId: string) => Promise<unknown[]>
    findByPattern: (pattern: string) => Promise<unknown[]>
    findByRefNumber: (refNumber: string) => Promise<unknown | null>
    createByRefNumber: (sourceId: string, targetRefNumber: string, referenceType: string, notes: string | null, userId: string) => Promise<{ success: boolean; reference?: unknown; error?: string }>
    getProcessFlow: (letterId: string) => Promise<unknown | null>
  }
  letterAttachments: {
    add: (letterId: string, fileBase64: string, filename: string, userId: string, draftId?: string) => Promise<{ success: boolean; attachment?: unknown; error?: string }>
    getById: (id: string) => Promise<unknown | null>
    getByLetter: (letterId: string) => Promise<unknown[]>
    getByDraft: (draftId: string) => Promise<unknown[]>
    delete: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    getFilePath: (id: string) => Promise<string | null>
    showInFolder: (id: string) => Promise<{ success: boolean; error?: string }>
    getDataDirectory: () => Promise<string>
  }
  issues: {
    create: (data: unknown, userId: string) => Promise<{ success: boolean; issue?: unknown; error?: string }>
    getById: (id: string) => Promise<unknown | null>
    getOpen: (filters?: unknown) => Promise<unknown[]>
    getCompleted: (filters?: unknown) => Promise<unknown[]>
    update: (id: string, data: unknown, userId: string) => Promise<{ success: boolean; error?: string }>
    close: (id: string, closureNote: string | null, userId: string) => Promise<{ success: boolean; error?: string }>
    reopen: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    addComment: (issueId: string, comment: string, userId: string, linkedRecordIds?: string[]) => Promise<{ success: boolean; error?: string }>
    searchRecordsForLinking: (query: string, topicId?: string) => Promise<{ id: string; title: string; topic_title: string; topic_id: string; type: string; subcategory_title: string | null; created_at: string }[]>
    getRecordForLinking: (id: string) => Promise<{ id: string; title: string; topic_title: string; topic_id: string; type: string; subcategory_title: string | null; created_at: string } | null>
    updateComment: (historyId: string, comment: string, userId: string) => Promise<{ success: boolean; error?: string }>
    addLinkedRecords: (historyId: string, recordIds: string[], userId: string) => Promise<{ success: boolean; error?: string }>
    getCommentEdits: (historyId: string) => Promise<{ id: string; history_id: string; old_comment: string; edited_by: string; edited_at: string; editor_name?: string }[]>
    getHistory: (issueId: string) => Promise<unknown[]>
    getOpenSummary: () => Promise<{ issue: unknown; latestUpdate: unknown }[]>
    getStats: () => Promise<unknown>
    getDueReminders: () => Promise<unknown[]>
    getWithReminders: (days?: number) => Promise<unknown[]>
    markReminderNotified: (id: string) => Promise<{ success: boolean; error?: string }>
  }
  credentials: {
    create: (data: unknown, userId: string) => Promise<{ success: boolean; credential?: unknown; error?: string }>
    getAll: (filters?: unknown) => Promise<unknown[]>
    getById: (id: string) => Promise<unknown | null>
    getPassword: (id: string, userId: string) => Promise<{ success: boolean; password?: string; error?: string }>
    update: (id: string, data: unknown, userId: string) => Promise<{ success: boolean; error?: string }>
    delete: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
  }
  secureReferences: {
    create: (data: unknown, userId: string) => Promise<{ success: boolean; reference?: unknown; error?: string }>
    getAll: (filters?: unknown) => Promise<unknown[]>
    getById: (id: string) => Promise<unknown | null>
    update: (id: string, data: unknown, userId: string) => Promise<{ success: boolean; error?: string }>
    delete: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    addFile: (refId: string, fileBase64: string, filename: string, userId: string) => Promise<{ success: boolean; file?: unknown; error?: string }>
    getFiles: (refId: string) => Promise<unknown[]>
    deleteFile: (fileId: string, userId: string) => Promise<{ success: boolean; error?: string }>
    getFilePath: (fileId: string) => Promise<string | null>
    getStats: () => Promise<unknown>
  }
  keyfile: {
    exists: () => Promise<boolean>
    export: () => Promise<{ success: boolean; error?: string }>
    import: () => Promise<{ success: boolean; error?: string }>
  }
  categories: {
    getAll: () => Promise<unknown[]>
    getByType: (type: 'credential' | 'reference') => Promise<unknown[]>
    getById: (id: string) => Promise<unknown | null>
    create: (data: { name: string; type: 'credential' | 'reference'; display_order?: number }, userId: string) => Promise<{ success: boolean; category?: unknown; error?: string }>
    update: (id: string, data: { name?: string; display_order?: number }, userId: string) => Promise<{ success: boolean; error?: string }>
    delete: (id: string, reassignTo: string, userId: string) => Promise<{ success: boolean; error?: string }>
    reorder: (ids: string[], userId: string) => Promise<{ success: boolean; error?: string }>
  }
  attendance: {
    createCondition: (data: unknown, userId: string) => Promise<{ success: boolean; condition?: unknown; error?: string }>
    updateCondition: (id: string, data: unknown, userId: string) => Promise<{ success: boolean; error?: string }>
    deleteCondition: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    getConditions: (includeDeleted?: boolean) => Promise<unknown[]>
    saveEntry: (data: unknown, userId: string) => Promise<{ success: boolean; entry?: unknown; error?: string }>
    saveBulkEntries: (data: unknown, userId: string) => Promise<{ success: boolean; count?: number; error?: string }>
    deleteEntry: (entryId: string, userId: string) => Promise<{ success: boolean; error?: string }>
    deleteBulkEntries: (shiftId: string, entryDate: string, userId: string) => Promise<{ success: boolean; count?: number; error?: string }>
    getEntry: (userId: string, entryDate: string) => Promise<unknown | null>
    getEntriesForYear: (filters: unknown) => Promise<unknown[]>
    getSummary: (userId: string, year: number) => Promise<unknown>
    getAllSummaries: (year: number) => Promise<unknown[]>
    getAvailableYears: () => Promise<number[]>
    isYearEditable: (year: number) => Promise<boolean>
    createShift: (data: unknown, userId: string) => Promise<{ success: boolean; shift?: unknown; error?: string }>
    updateShift: (id: string, data: unknown, userId: string) => Promise<{ success: boolean; error?: string }>
    deleteShift: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    getShifts: (includeDeleted?: boolean) => Promise<unknown[]>
    exportUserPdfDialog: (targetUserId: string, year: number, userId: string) => Promise<{ success: boolean; filePath?: string; error?: string }>
    exportPdfDialog: (year: number, userId: string) => Promise<{ success: boolean; filePath?: string; error?: string }>
    exportDepartmentReportDialog: (date: string, userId: string) => Promise<{ success: boolean; filePath?: string; error?: string }>
    getDepartmentReportInfo: (date: string) => Promise<{ exists: boolean; path: string | null; size: number | null; createdAt: string | null }>
    openDepartmentReport: (date: string) => Promise<{ success: boolean; error?: string }>
  }
  momLocations: {
    create: (data: unknown, userId: string) => Promise<{ success: boolean; location?: unknown; error?: string }>
    update: (id: string, data: unknown, userId: string) => Promise<{ success: boolean; error?: string }>
    delete: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    getAll: () => Promise<unknown[]>
  }
  moms: {
    create: (data: unknown, userId: string) => Promise<{ success: boolean; mom?: unknown; error?: string }>
    getById: (id: string) => Promise<unknown | null>
    getByMomId: (momId: string) => Promise<unknown | null>
    getAll: (filters?: unknown) => Promise<unknown[]>
    update: (id: string, data: unknown, userId: string) => Promise<{ success: boolean; error?: string }>
    delete: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    deleteAll: (userId: string) => Promise<{ success: boolean; deleted: number; error?: string }>
    close: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    reopen: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    saveFile: (momId: string, fileBase64: string, filename: string, userId: string) => Promise<{ success: boolean; error?: string }>
    getFilePath: (momId: string) => Promise<string | null>
    showInFolder: (momId: string) => Promise<{ success: boolean; error?: string }>
    getStats: () => Promise<unknown>
    linkTopic: (momInternalId: string, topicId: string, userId: string) => Promise<{ success: boolean; error?: string }>
    unlinkTopic: (momInternalId: string, topicId: string, userId: string) => Promise<{ success: boolean; error?: string }>
    getLinkedTopics: (momInternalId: string) => Promise<unknown[]>
    linkRecord: (momInternalId: string, recordId: string, userId: string) => Promise<{ success: boolean; error?: string }>
    unlinkRecord: (momInternalId: string, recordId: string, userId: string) => Promise<{ success: boolean; error?: string }>
    getLinkedRecords: (momInternalId: string) => Promise<unknown[]>
    linkLetter: (momInternalId: string, letterInternalId: string, userId: string) => Promise<{ success: boolean; error?: string }>
    unlinkLetter: (momInternalId: string, letterInternalId: string, userId: string) => Promise<{ success: boolean; error?: string }>
    getLinkedLetters: (momInternalId: string) => Promise<unknown[]>
    getByTopic: (topicId: string) => Promise<unknown[]>
    getByRecord: (recordId: string) => Promise<unknown[]>
    getHistory: (momInternalId: string) => Promise<unknown[]>
  }
  momActions: {
    create: (data: unknown, userId: string) => Promise<{ success: boolean; action?: unknown; error?: string }>
    getById: (id: string) => Promise<unknown | null>
    getByMom: (momInternalId: string) => Promise<unknown[]>
    update: (id: string, data: unknown, userId: string) => Promise<{ success: boolean; error?: string }>
    resolve: (id: string, data: unknown, userId: string) => Promise<{ success: boolean; error?: string }>
    reopen: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    saveResolutionFile: (actionId: string, fileBase64: string, filename: string, userId: string) => Promise<{ success: boolean; error?: string }>
    getResolutionFilePath: (actionId: string) => Promise<string | null>
    getDueReminders: () => Promise<unknown[]>
    getWithReminders: () => Promise<unknown[]>
    getWithDeadlines: () => Promise<unknown[]>
    markReminderNotified: (id: string) => Promise<{ success: boolean; error?: string }>
  }
  momDrafts: {
    create: (data: unknown, userId: string) => Promise<{ success: boolean; draft?: unknown; error?: string }>
    getById: (id: string) => Promise<unknown | null>
    getByMom: (momInternalId: string) => Promise<unknown[]>
    getLatest: (momInternalId: string) => Promise<unknown | null>
    saveFile: (draftId: string, fileBase64: string, filename: string, userId: string) => Promise<{ success: boolean; error?: string }>
    getFilePath: (draftId: string) => Promise<string | null>
    showInFolder: (draftId: string) => Promise<{ success: boolean; error?: string }>
    delete: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
  }
  backup: {
    create: (userId: string, username: string, displayName: string, includeEmails: boolean) => Promise<{ success: boolean; filePath?: string; error?: string }>
    selectFile: () => Promise<{ success: boolean; filePath?: string; error?: string }>
    analyze: (zipPath: string) => Promise<{ success: boolean; info?: unknown; error?: string }>
    compare: (info: unknown, userId: string, username: string, displayName: string) => Promise<unknown>
    restore: (zipPath: string, userId: string, username: string, displayName: string) => Promise<{ success: boolean; error?: string }>
    getStatus: () => Promise<unknown>
    getEmailsSize: () => Promise<{ totalBytes: number; fileCount: number }>
    checkReminder: (reminderDays: number) => Promise<{ shouldRemind: boolean; daysSinceBackup: number | null; lastBackupDate: string | null }>
    onProgress: (callback: (progress: unknown) => void) => void
    offProgress: () => void
    onSessionInvalidated: (callback: () => void) => void
    offSessionInvalidated: () => void
  }
  database: {
    refresh: () => Promise<{ success: boolean; error?: string }>
  }
  seed: {
    run: (userId: string, options?: { users?: number; topics?: number; recordsPerTopic?: number; letters?: number; moms?: number; issues?: number; attendanceMonths?: number; reminders?: number; credentials?: number; references?: number }) => Promise<{
      success: boolean
      message: string
      counts: Record<string, number>
      error?: string
    }>
    clear: (userId: string) => Promise<{ success: boolean; message: string; error?: string }>
  }
  settings: {
    get: (key: string) => Promise<string | null>
    getAll: () => Promise<Record<string, string>>
    update: (key: string, value: string, userId: string) => Promise<{ success: boolean; error?: string }>
    updateAll: (settings: Record<string, string>, userId: string) => Promise<{ success: boolean; error?: string }>
  }
  dialog: {
    openFile: (options?: {
      title?: string
      filters?: { name: string; extensions: string[] }[]
      multiple?: boolean
    }) => Promise<{
      canceled: boolean
      files?: { path: string; filename: string; buffer: string; size: number }[]
    }>
    showMessage: (options: {
      type?: 'none' | 'info' | 'error' | 'question' | 'warning'
      title?: string
      message: string
      detail?: string
      buttons?: string[]
    }) => Promise<{ response: number }>
  }
  file: {
    openExternal: (filePath: string) => Promise<{ success: boolean; error?: string }>
    showInFolder: (filePath: string) => Promise<{ success: boolean; error?: string }>
  }
  logger: {
    getLogs: (filter?: { level?: string; limit?: number }) => Promise<{ timestamp: string; level: string; message: string }[]>
    clearLogs: () => Promise<{ success: boolean }>
    getStats: () => Promise<{ total: number; errors: number; warnings: number }>
    log: (level: string, message: string) => void
  }
  scheduledEmails: {
    create: (data: unknown, userId: string) => Promise<{ success: boolean; schedule?: unknown; error?: string }>
    getAll: (includeInactive?: boolean) => Promise<unknown[]>
    getById: (id: string) => Promise<unknown | null>
    update: (id: string, data: unknown, userId: string) => Promise<{ success: boolean; error?: string }>
    delete: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    getInstances: (startDate?: string, endDate?: string, status?: string) => Promise<unknown[]>
    getTodayInstances: () => Promise<unknown[]>
    getPendingCounts: () => Promise<{ pending: number; overdue: number; total: number }>
    generateInstances: (date: string) => Promise<number>
    markSent: (instanceId: string, userId: string) => Promise<{ success: boolean; error?: string }>
    dismiss: (instanceId: string, userId: string, notes?: string) => Promise<{ success: boolean; error?: string }>
    reset: (instanceId: string, userId: string) => Promise<{ success: boolean; error?: string }>
    getInstanceById: (instanceId: string) => Promise<unknown | null>
    composeEmail: (instanceId: string, userId: string) => Promise<{ success: boolean; subject?: string; body?: string; to?: string; cc?: string; error?: string }>
    getHistory: (scheduleId: string) => Promise<unknown[]>
    previewPlaceholders: (text: string, date: string, language: 'en' | 'ar', userId: string) => Promise<string>
  }
  updater: {
    getVersion: () => Promise<string>
    importZip: () => Promise<{ success: boolean; message?: string; error?: string }>
    applyUpdate: () => Promise<{ success: boolean; error?: string }>
    cancelUpdate: () => Promise<{ success: boolean; error?: string }>
    checkPending: () => Promise<{ pending: boolean }>
  }
  dashboard: {
    getStats: () => Promise<unknown>
    getDiskSpace: () => Promise<{ available: number; total: number; used: number; percentUsed: number; isLow: boolean; drive: string } | null>
    getRecentActivity: (limit?: number) => Promise<unknown[]>
    getActivityByMonth: (year: number) => Promise<unknown[]>
    getTopTopics: (limit?: number) => Promise<unknown[]>
  }
  calendar: {
    getEvents: (year: number, month: number) => Promise<unknown[]>
    getEventsForDate: (date: string) => Promise<unknown[]>
    getUpcoming: (days?: number) => Promise<unknown[]>
  }
  tags: {
    create: (data: unknown, userId: string) => Promise<{ success: boolean; tag?: unknown; error?: string }>
    getAll: () => Promise<unknown[]>
    getById: (id: string) => Promise<unknown | null>
    update: (id: string, data: unknown, userId: string) => Promise<{ success: boolean; error?: string }>
    delete: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    getRecordTags: (recordId: string) => Promise<unknown[]>
    setRecordTags: (recordId: string, tagIds: string[], userId: string) => Promise<{ success: boolean; error?: string }>
    getIssueTags: (issueId: string) => Promise<unknown[]>
    setIssueTags: (issueId: string, tagIds: string[], userId: string) => Promise<{ success: boolean; error?: string }>
    getLetterTags: (letterId: string) => Promise<unknown[]>
    setLetterTags: (letterId: string, tagIds: string[], userId: string) => Promise<{ success: boolean; error?: string }>
    getMomTags: (momId: string) => Promise<unknown[]>
    setMomTags: (momId: string, tagIds: string[], userId: string) => Promise<{ success: boolean; error?: string }>
    getRecordsByTag: (tagId: string) => Promise<unknown[]>
    getIssuesByTag: (tagId: string) => Promise<unknown[]>
    getLettersByTag: (tagId: string) => Promise<unknown[]>
    getMomsByTag: (tagId: string) => Promise<unknown[]>
  }
  advancedSearch: {
    search: (filters: unknown, userId?: string) => Promise<{ results: unknown[]; total: number; offset: number; limit: number; searchTerms?: string[] }>
    suggestions: (partialQuery: string, userId: string, limit?: number) => Promise<{ text: string; type: string; count?: number }[]>
    history: (userId: string, limit?: number) => Promise<unknown[]>
    clearHistory: (userId: string) => Promise<{ success: boolean }>
    deleteHistoryEntry: (id: string, userId: string) => Promise<boolean>
    rebuildFtsIndexes: () => Promise<{ success: boolean; error?: string }>
    getFtsStats: () => Promise<unknown>
    highlight: (text: string, searchTerms: string[], maxLength?: number) => Promise<{ text: string; highlighted: boolean }[]>
    createSaved: (userId: string, name: string, filters: unknown) => Promise<{ success: boolean; search?: unknown; error?: string }>
    getSaved: (userId: string) => Promise<unknown[]>
    getSavedById: (id: string) => Promise<unknown | null>
    updateSaved: (id: string, name: string, filters: unknown) => Promise<{ success: boolean; error?: string }>
    deleteSaved: (id: string) => Promise<{ success: boolean; error?: string }>
  }
  history: {
    undoCreate: (entityType: string, entityId: string, userId: string) => Promise<{ success: boolean; error?: string }>
    undoUpdate: (entityType: string, entityId: string, previousData: Record<string, unknown>, userId: string) => Promise<{ success: boolean; error?: string }>
    undoDelete: (entityType: string, entityId: string, userId: string) => Promise<{ success: boolean; error?: string }>
    redoCreate: (entityType: string, entityId: string, userId: string) => Promise<{ success: boolean; error?: string }>
    redoUpdate: (entityType: string, entityId: string, afterData: Record<string, unknown>, userId: string) => Promise<{ success: boolean; error?: string }>
    redoDelete: (entityType: string, entityId: string, userId: string) => Promise<{ success: boolean; error?: string }>
    getEntity: (entityType: string, entityId: string) => Promise<Record<string, unknown> | null>
  }
  pins: {
    toggle: (entityType: string, entityId: string, userId: string) => Promise<{ success: boolean; pinned: boolean; error?: string }>
    isPinned: (entityType: string, entityId: string, userId: string) => Promise<boolean>
    getPinnedIds: (entityType: string, userId: string) => Promise<string[]>
    getPinStatuses: (entityType: string, entityIds: string[], userId: string) => Promise<Record<string, boolean>>
  }
  export: {
    topics: () => Promise<{ success: boolean; filePath?: string; error?: string }>
    letters: () => Promise<{ success: boolean; filePath?: string; error?: string }>
    moms: () => Promise<{ success: boolean; filePath?: string; error?: string }>
    issues: () => Promise<{ success: boolean; filePath?: string; error?: string }>
    attendance: (year: number, month?: number) => Promise<{ success: boolean; filePath?: string; error?: string }>
    searchResults: (results: any[]) => Promise<{ success: boolean; filePath?: string; error?: string }>
    recordsByTopic: (topicId: string) => Promise<{ success: boolean; filePath?: string; error?: string }>
    customData: (data: any[], sheetName: string, filename: string) => Promise<{ success: boolean; filePath?: string; error?: string }>
  }
  filterPresets: {
    create: (userId: string, entityType: string, name: string, filters: Record<string, unknown>, isDefault?: boolean, isShared?: boolean) => Promise<{ success: boolean; preset?: unknown; error?: string }>
    getAll: (userId: string, entityType: string) => Promise<unknown[]>
    getById: (id: string) => Promise<unknown | null>
    getDefault: (userId: string, entityType: string) => Promise<unknown | null>
    update: (id: string, userId: string, input: { name?: string; filters?: Record<string, unknown>; isDefault?: boolean; isShared?: boolean }) => Promise<{ success: boolean; error?: string }>
    delete: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    setDefault: (id: string, userId: string, entityType: string) => Promise<{ success: boolean; error?: string }>
    clearDefault: (userId: string, entityType: string) => Promise<{ success: boolean; error?: string }>
    getStats: (userId: string) => Promise<{ totalPresets: number; byEntityType: Record<string, number>; sharedPresets: number }>
  }
  health: {
    runChecks: () => Promise<{
      overall: 'healthy' | 'warning' | 'critical'
      timestamp: string
      checks: Array<{
        name: string
        status: 'healthy' | 'warning' | 'critical'
        message: string
        value?: number | string
        threshold?: number | string
        unit?: string
      }>
      summary: { healthy: number; warning: number; critical: number }
    }>
    getMetrics: () => Promise<{
      memory: { total: number; used: number; free: number; percentUsed: number }
      cpu: { cores: number; model: string; loadAverage: number[] }
      disk: { total: number; used: number; free: number; percentUsed: number }
      uptime: { system: number; app: number }
    }>
    getLastStatus: () => Promise<{
      overall: 'healthy' | 'warning' | 'critical'
      timestamp: string
      checks: Array<{
        name: string
        status: 'healthy' | 'warning' | 'critical'
        message: string
        value?: number | string
        threshold?: number | string
        unit?: string
      }>
      summary: { healthy: number; warning: number; critical: number }
    } | null>
    forceCheckpoint: () => Promise<{ success: boolean; error?: string }>
    optimizeDatabase: () => Promise<{ success: boolean; error?: string; sizeBefore?: number; sizeAfter?: number }>
    analyzeDatabase: () => Promise<{ success: boolean; error?: string }>
  }
  integrity: {
    check: () => Promise<{
      valid: boolean
      checks: Array<{
        name: string
        description: string
        passed: boolean
        details?: string
        repairAvailable?: boolean
      }>
      totalChecks: number
      passedChecks: number
      failedChecks: number
      timestamp: string
    }>
    getStartupResult: () => Promise<{
      valid: boolean
      checks: Array<{
        name: string
        description: string
        passed: boolean
        details?: string
        repairAvailable?: boolean
      }>
      totalChecks: number
      passedChecks: number
      failedChecks: number
      timestamp: string
    } | null>
    isStartupComplete: () => Promise<boolean>
    repairOrphanedRecords: () => Promise<{ success: boolean; repaired: number; errors: string[] }>
    rebuildFtsIndexes: () => Promise<{ success: boolean; repaired: number; errors: string[] }>
    repairForeignKeyViolations: () => Promise<{ success: boolean; repaired: number; errors: string[] }>
    repairOrphanedEmails: () => Promise<{ success: boolean; repaired: number; errors: string[] }>
    repairOrphanedAttachments: () => Promise<{ success: boolean; repaired: number; errors: string[] }>
  }
  sync: {
    getEntityVersion: (entityType: string, entityId: string) => Promise<{
      entity_type: string
      entity_id: string
      version: number
      updated_at: string
      updated_by: string | null
      checksum: string
    } | null>
    updateEntityVersion: (entityType: string, entityId: string, data: Record<string, unknown>, userId: string | null) => Promise<{
      entity_type: string
      entity_id: string
      version: number
      updated_at: string
      updated_by: string | null
      checksum: string
    }>
    checkConflict: (
      entityType: string,
      entityId: string,
      clientVersion: number,
      clientData: Record<string, unknown>,
      originalData: Record<string, unknown>
    ) => Promise<{
      entity_type: string
      entity_id: string
      local_version: number
      local_updated_at: string
      local_updated_by: string | null
      server_version: number
      server_updated_at: string
      server_updated_by: string | null
      field_conflicts: Array<{
        field: string
        local_value: unknown
        server_value: unknown
        original_value: unknown
      }>
    } | null>
    mergeConflict: (
      conflict: unknown,
      clientData: Record<string, unknown>,
      strategy: 'keep_local' | 'keep_server' | 'keep_newer' | 'manual',
      manualResolutions?: Record<string, unknown>
    ) => Promise<{
      success: boolean
      merged_data?: Record<string, unknown>
      conflicts_resolved?: number
      strategy_used: string
      error?: string
    }>
    getRecentChanges: (entityType?: string, since?: string, limit?: number) => Promise<Array<{
      entity_type: string
      entity_id: string
      version: number
      updated_at: string
      updated_by: string | null
      checksum: string
    }>>
  }
  notifications: {
    create: (input: {
      user_id: string
      type: 'mention' | 'assignment' | 'comment' | 'status_change' | 'reminder' | 'system'
      title: string
      message: string
      entity_type?: string
      entity_id?: string
      actor_id?: string
      actor_name?: string
      send_email?: boolean
    }) => Promise<{
      id: string
      user_id: string
      type: string
      title: string
      message: string
      entity_type?: string
      entity_id?: string
      actor_id?: string
      actor_name?: string
      is_read: boolean
      email_sent: boolean
      created_at: string
      read_at?: string
    }>
    get: (userId: string, options?: {
      unreadOnly?: boolean
      limit?: number
      offset?: number
      type?: 'mention' | 'assignment' | 'comment' | 'status_change' | 'reminder' | 'system'
    }) => Promise<{
      notifications: Array<{
        id: string
        user_id: string
        type: string
        title: string
        message: string
        entity_type?: string
        entity_id?: string
        actor_id?: string
        actor_name?: string
        is_read: boolean
        email_sent: boolean
        created_at: string
        read_at?: string
      }>
      total: number
      unread: number
    }>
    markAsRead: (notificationId: string, userId: string) => Promise<boolean>
    markAllAsRead: (userId: string) => Promise<number>
    getUnreadCount: (userId: string) => Promise<number>
    processMentions: (
      text: string,
      entityType: string,
      entityId: string,
      actorId: string,
      actorName: string,
      entityTitle: string
    ) => Promise<unknown[]>
    getPreferences: (userId: string) => Promise<Record<string, boolean>>
    updatePreferences: (userId: string, preferences: Partial<Record<string, boolean>>) => Promise<void>
  }
  documentVersions: {
    create: (input: {
      document_type: 'letter_attachment' | 'record_attachment' | 'mom_draft' | 'letter_draft'
      document_id: string
      file_path: string
      file_name: string
      mime_type: string
      created_by: string | null
      change_summary?: string
    }) => Promise<{
      id: string
      document_type: string
      document_id: string
      version_number: number
      file_path: string
      file_name: string
      file_size: number
      file_hash: string
      mime_type: string
      created_by: string | null
      created_at: string
      change_summary: string | null
      is_current: boolean
    }>
    getVersions: (documentType: string, documentId: string) => Promise<Array<{
      id: string
      document_type: string
      document_id: string
      version_number: number
      file_path: string
      file_name: string
      file_size: number
      file_hash: string
      mime_type: string
      created_by: string | null
      created_at: string
      change_summary: string | null
      is_current: boolean
    }>>
    getVersion: (versionId: string) => Promise<{
      id: string
      document_type: string
      document_id: string
      version_number: number
      file_path: string
      file_name: string
      file_size: number
      file_hash: string
      mime_type: string
      created_by: string | null
      created_at: string
      change_summary: string | null
      is_current: boolean
    } | null>
    getCurrentVersion: (documentType: string, documentId: string) => Promise<{
      id: string
      document_type: string
      document_id: string
      version_number: number
      file_path: string
      file_name: string
      file_size: number
      file_hash: string
      mime_type: string
      created_by: string | null
      created_at: string
      change_summary: string | null
      is_current: boolean
    } | null>
    restore: (versionId: string, userId: string) => Promise<{
      id: string
      document_type: string
      document_id: string
      version_number: number
      file_path: string
      file_name: string
      file_size: number
      file_hash: string
      mime_type: string
      created_by: string | null
      created_at: string
      change_summary: string | null
      is_current: boolean
    } | null>
    compare: (versionId1: string, versionId2: string) => Promise<{
      older_version: unknown
      newer_version: unknown
      size_change: number
      size_change_percent: number
      time_between: number
    } | null>
    getCount: (documentType: string, documentId: string) => Promise<number>
    verifyIntegrity: (versionId: string) => Promise<{ valid: boolean; details?: string }>
  }
  ocr: {
    recognizeImage: (imagePath: string, language: string) => Promise<{
      text: string
      confidence: number
      words: Array<{
        text: string
        confidence: number
        bbox: { x0: number; y0: number; x1: number; y1: number }
      }>
      paragraphs: string[]
      language: string
      processingTime: number
    }>
    extractAndIndex: (
      attachmentId: string,
      attachmentType: 'record_attachment' | 'letter_attachment',
      filePath: string,
      language: string,
      userId: string | null
    ) => Promise<{ success: boolean; text?: string; error?: string }>
    getExtractedText: (attachmentId: string) => Promise<{
      text: string
      confidence: number
      language: string
      extractedAt: string
    } | null>
    searchText: (query: string, attachmentType?: string, limit?: number) => Promise<Array<{
      attachmentId: string
      attachmentType: string
      matchedText: string
      confidence: number
    }>>
    deleteExtractedText: (attachmentId: string) => Promise<boolean>
    getStats: () => Promise<{
      totalExtracted: number
      byType: Record<string, number>
      averageConfidence: number
      totalTextLength: number
    }>
  }
  signatures: {
    create: (input: {
      user_id: string
      name: string
      type: 'signature' | 'stamp' | 'initials'
      image_data: string
      width: number
      height: number
      is_default?: boolean
    }) => Promise<{
      id: string
      user_id: string
      name: string
      type: 'signature' | 'stamp' | 'initials'
      image_data: string
      width: number
      height: number
      is_default: boolean
      created_at: string
      updated_at: string
    }>
    getAll: (userId: string, type?: string) => Promise<Array<{
      id: string
      user_id: string
      name: string
      type: 'signature' | 'stamp' | 'initials'
      image_data: string
      width: number
      height: number
      is_default: boolean
      created_at: string
      updated_at: string
    }>>
    get: (signatureId: string) => Promise<{
      id: string
      user_id: string
      name: string
      type: 'signature' | 'stamp' | 'initials'
      image_data: string
      width: number
      height: number
      is_default: boolean
      created_at: string
      updated_at: string
    } | null>
    getDefault: (userId: string, type: string) => Promise<{
      id: string
      user_id: string
      name: string
      type: 'signature' | 'stamp' | 'initials'
      image_data: string
      width: number
      height: number
      is_default: boolean
      created_at: string
      updated_at: string
    } | null>
    update: (signatureId: string, updates: { name?: string; image_data?: string; is_default?: boolean }, userId: string) => Promise<{ success: boolean; error?: string }>
    delete: (signatureId: string, userId: string) => Promise<{ success: boolean; error?: string }>
    place: (input: {
      document_type: string
      document_id: string
      signature_id: string
      page_number: number
      x_position: number
      y_position: number
      scale?: number
      rotation?: number
      placed_by: string
    }) => Promise<{
      id: string
      document_type: string
      document_id: string
      signature_id: string
      page_number: number
      x_position: number
      y_position: number
      scale: number
      rotation: number
      placed_by: string
      placed_at: string
    }>
    getPlacements: (documentType: string, documentId: string) => Promise<Array<{
      id: string
      document_type: string
      document_id: string
      signature_id: string
      page_number: number
      x_position: number
      y_position: number
      scale: number
      rotation: number
      placed_by: string
      placed_at: string
    }>>
    removePlacement: (placementId: string, userId: string) => Promise<{ success: boolean; error?: string }>
    getForExport: (documentType: string, documentId: string) => Promise<Array<{
      placement: unknown
      signature: unknown
    }>>
  }
  views: {
    create: (input: {
      name: string
      entity_type: string
      config: {
        filters: Array<{ field: string; operator: string; value: unknown }>
        sorts: Array<{ field: string; direction: 'asc' | 'desc' }>
        columns?: Array<{ id: string; visible: boolean; width?: number; order: number }>
        groupBy?: string
        pageSize?: number
        customSettings?: Record<string, unknown>
      }
      is_default?: boolean
      is_shared?: boolean
      created_by: number
    }) => Promise<{
      id: number
      name: string
      entity_type: string
      config: unknown
      is_default: boolean
      is_shared: boolean
      created_by: number
      created_at: string
      updated_at: string
    }>
    getById: (id: number) => Promise<{
      id: number
      name: string
      entity_type: string
      config: unknown
      is_default: boolean
      is_shared: boolean
      created_by: number
      created_at: string
      updated_at: string
    } | null>
    getViews: (entityType: string, userId: number, includeShared?: boolean) => Promise<Array<{
      id: number
      name: string
      entity_type: string
      config: unknown
      is_default: boolean
      is_shared: boolean
      created_by: number
      created_at: string
      updated_at: string
    }>>
    getDefault: (entityType: string, userId: number) => Promise<{
      id: number
      name: string
      entity_type: string
      config: unknown
      is_default: boolean
      is_shared: boolean
      created_by: number
      created_at: string
      updated_at: string
    } | null>
    update: (id: number, input: {
      name?: string
      config?: unknown
      is_default?: boolean
      is_shared?: boolean
    }, userId: number) => Promise<{
      id: number
      name: string
      entity_type: string
      config: unknown
      is_default: boolean
      is_shared: boolean
      created_by: number
      created_at: string
      updated_at: string
    } | null>
    delete: (id: number, userId: number) => Promise<boolean>
    duplicate: (id: number, newName: string, userId: number) => Promise<{
      id: number
      name: string
      entity_type: string
      config: unknown
      is_default: boolean
      is_shared: boolean
      created_by: number
      created_at: string
      updated_at: string
    } | null>
    toggleShare: (id: number, userId: number) => Promise<{
      id: number
      name: string
      entity_type: string
      config: unknown
      is_default: boolean
      is_shared: boolean
      created_by: number
      created_at: string
      updated_at: string
    } | null>
  }
  mentions: {
    create: (input: {
      entity_type: 'record' | 'mom' | 'letter' | 'issue'
      entity_id: string
      mentioned_user_id: string
      note?: string
    }, userId: string) => Promise<{ success: boolean; mention?: unknown; error?: string }>
    createBulk: (inputs: Array<{
      entity_type: 'record' | 'mom' | 'letter' | 'issue'
      entity_id: string
      mentioned_user_id: string
      note?: string
    }>, userId: string) => Promise<{ success: boolean; count?: number; error?: string }>
    getById: (id: string) => Promise<unknown | null>
    getForUser: (userId: string, filters?: { status?: string; entity_type?: string }) => Promise<unknown[]>
    getSentByUser: (userId: string, filters?: { status?: string; entity_type?: string }) => Promise<unknown[]>
    getForEntity: (entityType: string, entityId: string) => Promise<unknown[]>
    getAll: (filters?: { status?: string; entity_type?: string }) => Promise<unknown[]>
    acknowledge: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    archive: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    updateNote: (id: string, note: string, userId: string) => Promise<{ success: boolean; error?: string }>
    delete: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    getUnacknowledgedCount: (userId: string) => Promise<number>
    getCounts: (userId: string) => Promise<{ pending: number; acknowledged: number; archived: number; sent: number }>
    searchUsers: (query: string) => Promise<Array<{ id: string; display_name: string; username: string }>>
    cleanup: () => Promise<{ success: boolean; deleted?: number; error?: string }>
  }
}

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
const electronAPI: ElectronAPI = {
  app: {
    isFirstRun: () => ipcRenderer.invoke('app:isFirstRun'),
    showNotification: (title, body) => ipcRenderer.invoke('app:showNotification', title, body),
    getInfo: () => ipcRenderer.invoke('app:getInfo'),
    setWindowTitle: (title) => ipcRenderer.invoke('app:setWindowTitle', title),
    getZoomFactor: () => ipcRenderer.invoke('app:getZoomFactor'),
    setZoomFactor: (factor) => ipcRenderer.invoke('app:setZoomFactor', factor)
  },
  auth: {
    login: (username, password) => ipcRenderer.invoke('auth:login', username, password),
    logout: (token, userId) => ipcRenderer.invoke('auth:logout', token, userId),
    verifyToken: (token) => ipcRenderer.invoke('auth:verifyToken', token),
    createUser: (username, password, displayName, role) =>
      ipcRenderer.invoke('auth:createUser', username, password, displayName, role),
    getAllUsers: () => ipcRenderer.invoke('auth:getAllUsers'),
    getUserById: (id: string) => ipcRenderer.invoke('auth:getUserById', id),
    updateUser: (id, updates, updatedBy) => ipcRenderer.invoke('auth:updateUser', id, updates, updatedBy),
    changePassword: (userId, currentPassword, newPassword) =>
      ipcRenderer.invoke('auth:changePassword', userId, currentPassword, newPassword),
    hasAdminUser: () => ipcRenderer.invoke('auth:hasAdminUser'),
    resetPassword: (userId, newPassword, adminId) =>
      ipcRenderer.invoke('auth:resetPassword', userId, newPassword, adminId),
    deleteUser: (userId, adminId) =>
      ipcRenderer.invoke('auth:deleteUser', userId, adminId),
    checkUsername: (username) => ipcRenderer.invoke('auth:checkUsername', username),
    // Session management
    updateSessionActivity: (token) => ipcRenderer.invoke('auth:updateSessionActivity', token),
    extendSession: (token) => ipcRenderer.invoke('auth:extendSession', token),
    getSessionInfo: (token) => ipcRenderer.invoke('auth:getSessionInfo', token),
    getSessionTimeout: () => ipcRenderer.invoke('auth:getSessionTimeout'),
    setSessionTimeout: (minutes) => ipcRenderer.invoke('auth:setSessionTimeout', minutes),
    resetUserLockout: (username, adminId) => ipcRenderer.invoke('auth:resetUserLockout', username, adminId),
    getUserLockoutStatus: (username) => ipcRenderer.invoke('auth:getUserLockoutStatus', username)
  },
  twofa: {
    isEnabled: (userId) => ipcRenderer.invoke('twofa:isEnabled', userId),
    setEnabled: (userId, enabled, adminId) => ipcRenderer.invoke('twofa:setEnabled', userId, enabled, adminId),
    generateSessionToken: () => ipcRenderer.invoke('twofa:generateSessionToken'),
    initiate: (userId, sessionToken) => ipcRenderer.invoke('twofa:initiate', userId, sessionToken),
    verify: (sessionToken, code) => ipcRenderer.invoke('twofa:verify', sessionToken, code),
    cancel: (sessionToken) => ipcRenderer.invoke('twofa:cancel', sessionToken),
    getRemainingTime: (sessionToken) => ipcRenderer.invoke('twofa:getRemainingTime', sessionToken)
  },
  search: {
    global: (query, limit) => ipcRenderer.invoke('search:global', query, limit)
  },
  topics: {
    create: (data, userId) => ipcRenderer.invoke('topics:create', data, userId),
    getAll: (filters?) => ipcRenderer.invoke('topics:getAll', filters),
    getById: (id) => ipcRenderer.invoke('topics:getById', id),
    update: (id, data, userId) => ipcRenderer.invoke('topics:update', id, data, userId),
    delete: (id, userId) => ipcRenderer.invoke('topics:delete', id, userId),
    search: (query) => ipcRenderer.invoke('topics:search', query)
  },
  records: {
    create: (data, userId) => ipcRenderer.invoke('records:create', data, userId),
    getByTopic: (topicId, subcategoryId) => ipcRenderer.invoke('records:getByTopic', topicId, subcategoryId),
    getById: (id) => ipcRenderer.invoke('records:getById', id),
    update: (id, data, userId) => ipcRenderer.invoke('records:update', id, data, userId),
    delete: (id, userId) => ipcRenderer.invoke('records:delete', id, userId),
    search: (query, topicId) => ipcRenderer.invoke('records:search', query, topicId),
    linkMom: (recordId, momId, userId) => ipcRenderer.invoke('records:linkMom', recordId, momId, userId),
    unlinkMom: (recordId, momId, userId) => ipcRenderer.invoke('records:unlinkMom', recordId, momId, userId),
    linkLetter: (recordId, letterId, userId) => ipcRenderer.invoke('records:linkLetter', recordId, letterId, userId),
    unlinkLetter: (recordId, letterId, userId) => ipcRenderer.invoke('records:unlinkLetter', recordId, letterId, userId),
    getLinkedMoms: (recordId) => ipcRenderer.invoke('records:getLinkedMoms', recordId),
    getLinkedLetters: (recordId) => ipcRenderer.invoke('records:getLinkedLetters', recordId)
  },
  recordAttachments: {
    getByRecord: (recordId) => ipcRenderer.invoke('recordAttachments:getByRecord', recordId),
    add: (data, userId) => ipcRenderer.invoke('recordAttachments:add', data, userId),
    delete: (attachmentId, userId) => ipcRenderer.invoke('recordAttachments:delete', attachmentId, userId),
    open: (attachmentId) => ipcRenderer.invoke('recordAttachments:open', attachmentId),
    getFilePath: (attachmentId) => ipcRenderer.invoke('recordAttachments:getFilePath', attachmentId),
    showInFolder: (attachmentId) => ipcRenderer.invoke('recordAttachments:showInFolder', attachmentId)
  },
  subcategories: {
    create: (data, userId) => ipcRenderer.invoke('subcategories:create', data, userId),
    getByTopic: (topicId) => ipcRenderer.invoke('subcategories:getByTopic', topicId),
    getById: (id) => ipcRenderer.invoke('subcategories:getById', id),
    update: (id, data, userId) => ipcRenderer.invoke('subcategories:update', id, data, userId),
    delete: (id, userId) => ipcRenderer.invoke('subcategories:delete', id, userId)
  },
  emails: {
    archive: (emailData, topicId, userId, subcategoryId) => ipcRenderer.invoke('emails:archive', emailData, topicId, userId, subcategoryId),
    getById: (id) => ipcRenderer.invoke('emails:getById', id),
    getByRecord: (recordId) => ipcRenderer.invoke('emails:getByRecord', recordId),
    search: (query) => ipcRenderer.invoke('emails:search', query),
    isArchived: (outlookEntryId) => ipcRenderer.invoke('emails:isArchived', outlookEntryId),
    getArchivedIds: () => ipcRenderer.invoke('emails:getArchivedIds'),
    openFile: (emailId) => ipcRenderer.invoke('emails:openFile', emailId),
    getArchiveInfo: (outlookEntryId) => ipcRenderer.invoke('emails:getArchiveInfo', outlookEntryId),
    showInFolder: (emailId) => ipcRenderer.invoke('emails:showInFolder', emailId)
  },
  outlook: {
    connect: () => ipcRenderer.invoke('outlook:connect'),
    disconnect: () => ipcRenderer.invoke('outlook:disconnect'),
    isConnected: () => ipcRenderer.invoke('outlook:isConnected'),
    clearCache: () => ipcRenderer.invoke('outlook:clearCache'),
    getMailboxes: () => ipcRenderer.invoke('outlook:getMailboxes'),
    getFolders: (mailboxId) => ipcRenderer.invoke('outlook:getFolders', mailboxId),
    getEmails: (folderId, storeId, limit) => ipcRenderer.invoke('outlook:getEmails', folderId, storeId, limit),
    getEmailDetails: (entryId, storeId) => ipcRenderer.invoke('outlook:getEmailDetails', entryId, storeId),
    composeAttendanceEmail: (date, attachmentPath, toEmails, ccEmails, subjectTemplate, bodyTemplate) => ipcRenderer.invoke('outlook:composeAttendanceEmail', date, attachmentPath, toEmails, ccEmails, subjectTemplate, bodyTemplate)
  },
  reminders: {
    create: (data, userId) => ipcRenderer.invoke('reminders:create', data, userId),
    getAll: () => ipcRenderer.invoke('reminders:getAll'),
    getUpcoming: (days) => ipcRenderer.invoke('reminders:getUpcoming', days),
    getOverdue: () => ipcRenderer.invoke('reminders:getOverdue'),
    complete: (id, userId) => ipcRenderer.invoke('reminders:complete', id, userId),
    delete: (id, userId) => ipcRenderer.invoke('reminders:delete', id, userId)
  },
  audit: {
    getLog: (options) => ipcRenderer.invoke('audit:getLog', options),
    verifyIntegrity: () => ipcRenderer.invoke('audit:verifyIntegrity'),
    getStats: () => ipcRenderer.invoke('audit:getStats'),
    runBackgroundIntegrityCheck: () => ipcRenderer.invoke('audit:runBackgroundIntegrityCheck'),
    getIntegrityStatus: () => ipcRenderer.invoke('audit:getIntegrityStatus'),
    verifyRange: (startId, endId) => ipcRenderer.invoke('audit:verifyRange', startId, endId),
    getLatestId: () => ipcRenderer.invoke('audit:getLatestId')
  },
  handover: {
    getWeekInfo: () => ipcRenderer.invoke('handover:getWeekInfo'),
    getRecords: (startDate, endDate) => ipcRenderer.invoke('handover:getRecords', startDate, endDate),
    getSummary: (records) => ipcRenderer.invoke('handover:getSummary', records),
    export: (records, weekInfo, userId, replaceExisting) => ipcRenderer.invoke('handover:export', records, weekInfo, userId, replaceExisting),
    getArchives: () => ipcRenderer.invoke('handover:getArchives'),
    deleteArchive: (id, userId) => ipcRenderer.invoke('handover:deleteArchive', id, userId),
    openFile: (id) => ipcRenderer.invoke('handover:openFile', id)
  },
  authorities: {
    create: (data, userId) => ipcRenderer.invoke('authorities:create', data, userId),
    getAll: () => ipcRenderer.invoke('authorities:getAll'),
    getById: (id) => ipcRenderer.invoke('authorities:getById', id),
    getByType: (type) => ipcRenderer.invoke('authorities:getByType', type),
    getInternal: () => ipcRenderer.invoke('authorities:getInternal'),
    getExternal: () => ipcRenderer.invoke('authorities:getExternal'),
    search: (query) => ipcRenderer.invoke('authorities:search', query),
    findByEmailDomain: (email) => ipcRenderer.invoke('authorities:findByEmailDomain', email),
    update: (id, data, userId) => ipcRenderer.invoke('authorities:update', id, data, userId),
    delete: (id, userId) => ipcRenderer.invoke('authorities:delete', id, userId),
    getStats: () => ipcRenderer.invoke('authorities:getStats')
  },
  contacts: {
    create: (data, userId) => ipcRenderer.invoke('contacts:create', data, userId),
    getAll: () => ipcRenderer.invoke('contacts:getAll'),
    getById: (id) => ipcRenderer.invoke('contacts:getById', id),
    getByAuthority: (authorityId) => ipcRenderer.invoke('contacts:getByAuthority', authorityId),
    search: (query) => ipcRenderer.invoke('contacts:search', query),
    update: (id, data, userId) => ipcRenderer.invoke('contacts:update', id, data, userId),
    delete: (id, userId) => ipcRenderer.invoke('contacts:delete', id, userId)
  },
  letters: {
    create: (data, userId) => ipcRenderer.invoke('letters:create', data, userId),
    getAll: (filters?) => ipcRenderer.invoke('letters:getAll', filters),
    getById: (id) => ipcRenderer.invoke('letters:getById', id),
    getByTopic: (topicId, subcategoryId) => ipcRenderer.invoke('letters:getByTopic', topicId, subcategoryId),
    getByAuthority: (authorityId) => ipcRenderer.invoke('letters:getByAuthority', authorityId),
    search: (params) => ipcRenderer.invoke('letters:search', params),
    update: (id, data, userId) => ipcRenderer.invoke('letters:update', id, data, userId),
    delete: (id, userId) => ipcRenderer.invoke('letters:delete', id, userId),
    saveFile: (letterId, fileBuffer, filename, userId) => ipcRenderer.invoke('letters:saveFile', letterId, fileBuffer, filename, userId),
    getFilePath: (letterId) => ipcRenderer.invoke('letters:getFilePath', letterId),
    getStats: () => ipcRenderer.invoke('letters:getStats'),
    getPending: () => ipcRenderer.invoke('letters:getPending'),
    getOverdue: () => ipcRenderer.invoke('letters:getOverdue'),
    getByLetterId: (letterId) => ipcRenderer.invoke('letters:getByLetterId', letterId),
    getLinkedMoms: (letterInternalId) => ipcRenderer.invoke('letters:getLinkedMoms', letterInternalId)
  },
  letterDrafts: {
    create: (data, userId) => ipcRenderer.invoke('letterDrafts:create', data, userId),
    getById: (id) => ipcRenderer.invoke('letterDrafts:getById', id),
    getByLetter: (letterId) => ipcRenderer.invoke('letterDrafts:getByLetter', letterId),
    getLatest: (letterId) => ipcRenderer.invoke('letterDrafts:getLatest', letterId),
    getFinal: (letterId) => ipcRenderer.invoke('letterDrafts:getFinal', letterId),
    update: (id, data, userId) => ipcRenderer.invoke('letterDrafts:update', id, data, userId),
    updateStatus: (id, status, userId) => ipcRenderer.invoke('letterDrafts:updateStatus', id, status, userId),
    approve: (id, userId) => ipcRenderer.invoke('letterDrafts:approve', id, userId),
    markAsSent: (id, userId) => ipcRenderer.invoke('letterDrafts:markAsSent', id, userId),
    delete: (id, userId) => ipcRenderer.invoke('letterDrafts:delete', id, userId),
    saveFile: (draftId, fileBuffer, filename, userId) => ipcRenderer.invoke('letterDrafts:saveFile', draftId, fileBuffer, filename, userId),
    getFilePath: (draftId) => ipcRenderer.invoke('letterDrafts:getFilePath', draftId),
    showInFolder: (draftId) => ipcRenderer.invoke('letterDrafts:showInFolder', draftId)
  },
  letterReferences: {
    create: (data, userId) => ipcRenderer.invoke('letterReferences:create', data, userId),
    getById: (id) => ipcRenderer.invoke('letterReferences:getById', id),
    getFrom: (letterId) => ipcRenderer.invoke('letterReferences:getFrom', letterId),
    getTo: (letterId) => ipcRenderer.invoke('letterReferences:getTo', letterId),
    getAll: (letterId) => ipcRenderer.invoke('letterReferences:getAll', letterId),
    getByType: (letterId, type, direction) => ipcRenderer.invoke('letterReferences:getByType', letterId, type, direction),
    getLetterWithRefs: (letterId) => ipcRenderer.invoke('letterReferences:getLetterWithRefs', letterId),
    update: (id, data, userId) => ipcRenderer.invoke('letterReferences:update', id, data, userId),
    delete: (id, userId) => ipcRenderer.invoke('letterReferences:delete', id, userId),
    buildGraph: (letterId, maxDepth) => ipcRenderer.invoke('letterReferences:buildGraph', letterId, maxDepth),
    getChain: (letterId) => ipcRenderer.invoke('letterReferences:getChain', letterId),
    findByPattern: (pattern) => ipcRenderer.invoke('letterReferences:findByPattern', pattern),
    findByRefNumber: (refNumber) => ipcRenderer.invoke('letterReferences:findByRefNumber', refNumber),
    createByRefNumber: (sourceId, targetRefNumber, referenceType, notes, userId) => ipcRenderer.invoke('letterReferences:createByRefNumber', sourceId, targetRefNumber, referenceType, notes, userId),
    getProcessFlow: (letterId) => ipcRenderer.invoke('letterReferences:getProcessFlow', letterId)
  },
  letterAttachments: {
    add: (letterId, fileBase64, filename, userId, draftId) => ipcRenderer.invoke('letterAttachments:add', letterId, fileBase64, filename, userId, draftId),
    getById: (id) => ipcRenderer.invoke('letterAttachments:getById', id),
    getByLetter: (letterId) => ipcRenderer.invoke('letterAttachments:getByLetter', letterId),
    getByDraft: (draftId) => ipcRenderer.invoke('letterAttachments:getByDraft', draftId),
    delete: (id, userId) => ipcRenderer.invoke('letterAttachments:delete', id, userId),
    getFilePath: (id) => ipcRenderer.invoke('letterAttachments:getFilePath', id),
    showInFolder: (id) => ipcRenderer.invoke('letterAttachments:showInFolder', id),
    getDataDirectory: () => ipcRenderer.invoke('letterAttachments:getDataDirectory')
  },
  issues: {
    create: (data, userId) => ipcRenderer.invoke('issues:create', data, userId),
    getById: (id) => ipcRenderer.invoke('issues:getById', id),
    getOpen: (filters) => ipcRenderer.invoke('issues:getOpen', filters),
    getCompleted: (filters) => ipcRenderer.invoke('issues:getCompleted', filters),
    update: (id, data, userId) => ipcRenderer.invoke('issues:update', id, data, userId),
    close: (id, closureNote, userId) => ipcRenderer.invoke('issues:close', id, closureNote, userId),
    reopen: (id, userId) => ipcRenderer.invoke('issues:reopen', id, userId),
    addComment: (issueId, comment, userId, linkedRecordIds?) => ipcRenderer.invoke('issues:addComment', issueId, comment, userId, linkedRecordIds),
    searchRecordsForLinking: (query, topicId) => ipcRenderer.invoke('issues:searchRecordsForLinking', query, topicId),
    getRecordForLinking: (id) => ipcRenderer.invoke('issues:getRecordForLinking', id),
    updateComment: (historyId, comment, userId) => ipcRenderer.invoke('issues:updateComment', historyId, comment, userId),
    addLinkedRecords: (historyId, recordIds, userId) => ipcRenderer.invoke('issues:addLinkedRecords', historyId, recordIds, userId),
    getCommentEdits: (historyId) => ipcRenderer.invoke('issues:getCommentEdits', historyId),
    getHistory: (issueId) => ipcRenderer.invoke('issues:getHistory', issueId),
    getOpenSummary: () => ipcRenderer.invoke('issues:getOpenSummary'),
    getStats: () => ipcRenderer.invoke('issues:getStats'),
    getDueReminders: () => ipcRenderer.invoke('issues:getDueReminders'),
    getWithReminders: (days) => ipcRenderer.invoke('issues:getWithReminders', days),
    markReminderNotified: (id) => ipcRenderer.invoke('issues:markReminderNotified', id)
  },
  credentials: {
    create: (data, userId) => ipcRenderer.invoke('credentials:create', data, userId),
    getAll: (filters) => ipcRenderer.invoke('credentials:getAll', filters),
    getById: (id) => ipcRenderer.invoke('credentials:getById', id),
    getPassword: (id, userId) => ipcRenderer.invoke('credentials:getPassword', id, userId),
    update: (id, data, userId) => ipcRenderer.invoke('credentials:update', id, data, userId),
    delete: (id, userId) => ipcRenderer.invoke('credentials:delete', id, userId)
  },
  secureReferences: {
    create: (data, userId) => ipcRenderer.invoke('secureReferences:create', data, userId),
    getAll: (filters) => ipcRenderer.invoke('secureReferences:getAll', filters),
    getById: (id) => ipcRenderer.invoke('secureReferences:getById', id),
    update: (id, data, userId) => ipcRenderer.invoke('secureReferences:update', id, data, userId),
    delete: (id, userId) => ipcRenderer.invoke('secureReferences:delete', id, userId),
    addFile: (refId, fileBase64, filename, userId) => ipcRenderer.invoke('secureReferences:addFile', refId, fileBase64, filename, userId),
    getFiles: (refId) => ipcRenderer.invoke('secureReferences:getFiles', refId),
    deleteFile: (fileId, userId) => ipcRenderer.invoke('secureReferences:deleteFile', fileId, userId),
    getFilePath: (fileId) => ipcRenderer.invoke('secureReferences:getFilePath', fileId),
    getStats: (isAdmin?: boolean) => ipcRenderer.invoke('secureReferences:getStats', isAdmin)
  },
  keyfile: {
    exists: () => ipcRenderer.invoke('keyfile:exists'),
    export: () => ipcRenderer.invoke('keyfile:export'),
    import: () => ipcRenderer.invoke('keyfile:import')
  },
  categories: {
    getAll: () => ipcRenderer.invoke('categories:getAll'),
    getByType: (type) => ipcRenderer.invoke('categories:getByType', type),
    getById: (id) => ipcRenderer.invoke('categories:getById', id),
    create: (data, userId) => ipcRenderer.invoke('categories:create', data, userId),
    update: (id, data, userId) => ipcRenderer.invoke('categories:update', id, data, userId),
    delete: (id, reassignTo, userId) => ipcRenderer.invoke('categories:delete', id, reassignTo, userId),
    reorder: (ids, userId) => ipcRenderer.invoke('categories:reorder', ids, userId)
  },
  attendance: {
    createCondition: (data, userId) => ipcRenderer.invoke('attendance:createCondition', data, userId),
    updateCondition: (id, data, userId) => ipcRenderer.invoke('attendance:updateCondition', id, data, userId),
    deleteCondition: (id, userId) => ipcRenderer.invoke('attendance:deleteCondition', id, userId),
    getConditions: (includeDeleted) => ipcRenderer.invoke('attendance:getConditions', includeDeleted),
    saveEntry: (data, userId) => ipcRenderer.invoke('attendance:saveEntry', data, userId),
    saveBulkEntries: (data, userId) => ipcRenderer.invoke('attendance:saveBulkEntries', data, userId),
    deleteEntry: (entryId, userId) => ipcRenderer.invoke('attendance:deleteEntry', entryId, userId),
    deleteBulkEntries: (shiftId, entryDate, userId) => ipcRenderer.invoke('attendance:deleteBulkEntries', shiftId, entryDate, userId),
    getEntry: (userId, entryDate) => ipcRenderer.invoke('attendance:getEntry', userId, entryDate),
    getEntriesForYear: (filters) => ipcRenderer.invoke('attendance:getEntriesForYear', filters),
    getSummary: (userId, year) => ipcRenderer.invoke('attendance:getSummary', userId, year),
    getAllSummaries: (year) => ipcRenderer.invoke('attendance:getAllSummaries', year),
    getAvailableYears: () => ipcRenderer.invoke('attendance:getAvailableYears'),
    isYearEditable: (year) => ipcRenderer.invoke('attendance:isYearEditable', year),
    createShift: (data, userId) => ipcRenderer.invoke('attendance:createShift', data, userId),
    updateShift: (id, data, userId) => ipcRenderer.invoke('attendance:updateShift', id, data, userId),
    deleteShift: (id, userId) => ipcRenderer.invoke('attendance:deleteShift', id, userId),
    getShifts: (includeDeleted) => ipcRenderer.invoke('attendance:getShifts', includeDeleted),
    exportUserPdfDialog: (targetUserId, year, userId) => ipcRenderer.invoke('attendance:exportUserPdfDialog', targetUserId, year, userId),
    exportPdfDialog: (year, userId) => ipcRenderer.invoke('attendance:exportPdfDialog', year, userId),
    exportDepartmentReportDialog: (date, userId) => ipcRenderer.invoke('attendance:exportDepartmentReportDialog', date, userId),
    getDepartmentReportInfo: (date) => ipcRenderer.invoke('attendance:getDepartmentReportInfo', date),
    openDepartmentReport: (date) => ipcRenderer.invoke('attendance:openDepartmentReport', date)
  },
  momLocations: {
    create: (data, userId) => ipcRenderer.invoke('momLocations:create', data, userId),
    update: (id, data, userId) => ipcRenderer.invoke('momLocations:update', id, data, userId),
    delete: (id, userId) => ipcRenderer.invoke('momLocations:delete', id, userId),
    getAll: () => ipcRenderer.invoke('momLocations:getAll')
  },
  moms: {
    create: (data, userId) => ipcRenderer.invoke('moms:create', data, userId),
    getById: (id) => ipcRenderer.invoke('moms:getById', id),
    getByMomId: (momId) => ipcRenderer.invoke('moms:getByMomId', momId),
    getAll: (filters) => ipcRenderer.invoke('moms:getAll', filters),
    update: (id, data, userId) => ipcRenderer.invoke('moms:update', id, data, userId),
    delete: (id, userId) => ipcRenderer.invoke('moms:delete', id, userId),
    deleteAll: (userId) => ipcRenderer.invoke('moms:deleteAll', userId),
    close: (id, userId) => ipcRenderer.invoke('moms:close', id, userId),
    reopen: (id, userId) => ipcRenderer.invoke('moms:reopen', id, userId),
    saveFile: (momId, fileBase64, filename, userId) => ipcRenderer.invoke('moms:saveFile', momId, fileBase64, filename, userId),
    getFilePath: (momId) => ipcRenderer.invoke('moms:getFilePath', momId),
    showInFolder: (momId) => ipcRenderer.invoke('moms:showInFolder', momId),
    getStats: () => ipcRenderer.invoke('moms:getStats'),
    linkTopic: (momInternalId, topicId, userId) => ipcRenderer.invoke('moms:linkTopic', momInternalId, topicId, userId),
    unlinkTopic: (momInternalId, topicId, userId) => ipcRenderer.invoke('moms:unlinkTopic', momInternalId, topicId, userId),
    getLinkedTopics: (momInternalId) => ipcRenderer.invoke('moms:getLinkedTopics', momInternalId),
    linkRecord: (momInternalId, recordId, userId) => ipcRenderer.invoke('moms:linkRecord', momInternalId, recordId, userId),
    unlinkRecord: (momInternalId, recordId, userId) => ipcRenderer.invoke('moms:unlinkRecord', momInternalId, recordId, userId),
    getLinkedRecords: (momInternalId) => ipcRenderer.invoke('moms:getLinkedRecords', momInternalId),
    linkLetter: (momInternalId, letterInternalId, userId) => ipcRenderer.invoke('moms:linkLetter', momInternalId, letterInternalId, userId),
    unlinkLetter: (momInternalId, letterInternalId, userId) => ipcRenderer.invoke('moms:unlinkLetter', momInternalId, letterInternalId, userId),
    getLinkedLetters: (momInternalId) => ipcRenderer.invoke('moms:getLinkedLetters', momInternalId),
    getByTopic: (topicId) => ipcRenderer.invoke('moms:getByTopic', topicId),
    getByRecord: (recordId) => ipcRenderer.invoke('moms:getByRecord', recordId),
    getHistory: (momInternalId) => ipcRenderer.invoke('moms:getHistory', momInternalId)
  },
  momActions: {
    create: (data, userId) => ipcRenderer.invoke('momActions:create', data, userId),
    getById: (id) => ipcRenderer.invoke('momActions:getById', id),
    getByMom: (momInternalId) => ipcRenderer.invoke('momActions:getByMom', momInternalId),
    update: (id, data, userId) => ipcRenderer.invoke('momActions:update', id, data, userId),
    resolve: (id, data, userId) => ipcRenderer.invoke('momActions:resolve', id, data, userId),
    reopen: (id, userId) => ipcRenderer.invoke('momActions:reopen', id, userId),
    saveResolutionFile: (actionId, fileBase64, filename, userId) => ipcRenderer.invoke('momActions:saveResolutionFile', actionId, fileBase64, filename, userId),
    getResolutionFilePath: (actionId) => ipcRenderer.invoke('momActions:getResolutionFilePath', actionId),
    getDueReminders: () => ipcRenderer.invoke('momActions:getDueReminders'),
    getWithReminders: () => ipcRenderer.invoke('momActions:getWithReminders'),
    getWithDeadlines: () => ipcRenderer.invoke('momActions:getWithDeadlines'),
    markReminderNotified: (id) => ipcRenderer.invoke('momActions:markReminderNotified', id)
  },
  momDrafts: {
    create: (data, userId) => ipcRenderer.invoke('momDrafts:create', data, userId),
    getById: (id) => ipcRenderer.invoke('momDrafts:getById', id),
    getByMom: (momInternalId) => ipcRenderer.invoke('momDrafts:getByMom', momInternalId),
    getLatest: (momInternalId) => ipcRenderer.invoke('momDrafts:getLatest', momInternalId),
    saveFile: (draftId, fileBase64, filename, userId) => ipcRenderer.invoke('momDrafts:saveFile', draftId, fileBase64, filename, userId),
    getFilePath: (draftId) => ipcRenderer.invoke('momDrafts:getFilePath', draftId),
    showInFolder: (draftId) => ipcRenderer.invoke('momDrafts:showInFolder', draftId),
    delete: (id, userId) => ipcRenderer.invoke('momDrafts:delete', id, userId)
  },
  backup: {
    create: (userId, username, displayName, includeEmails) => ipcRenderer.invoke('backup:create', userId, username, displayName, includeEmails),
    selectFile: () => ipcRenderer.invoke('backup:selectFile'),
    analyze: (zipPath) => ipcRenderer.invoke('backup:analyze', zipPath),
    compare: (info, userId, username, displayName) => ipcRenderer.invoke('backup:compare', info, userId, username, displayName),
    restore: (zipPath, userId, username, displayName) => ipcRenderer.invoke('backup:restore', zipPath, userId, username, displayName),
    getStatus: () => ipcRenderer.invoke('backup:getStatus'),
    getEmailsSize: () => ipcRenderer.invoke('backup:getEmailsSize'),
    checkReminder: (reminderDays) => ipcRenderer.invoke('backup:checkReminder', reminderDays),
    onProgress: (callback) => {
      ipcRenderer.on('backup:progress', (_event, progress) => callback(progress))
    },
    offProgress: () => {
      ipcRenderer.removeAllListeners('backup:progress')
    },
    onSessionInvalidated: (callback) => {
      ipcRenderer.on('backup:sessionInvalidated', () => callback())
    },
    offSessionInvalidated: () => {
      ipcRenderer.removeAllListeners('backup:sessionInvalidated')
    }
  },
  database: {
    refresh: () => {
      console.log('[Preload] database.refresh called at', new Date().toISOString())
      console.log('[Preload] database.refresh call stack:', new Error().stack)
      return ipcRenderer.invoke('database:refresh')
    }
  },
  seed: {
    run: (userId, options) => ipcRenderer.invoke('seed:run', userId, options),
    clear: (userId) => ipcRenderer.invoke('seed:clear', userId)
  },
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    update: (key, value, userId) => ipcRenderer.invoke('settings:update', key, value, userId),
    updateAll: (settings, userId) => ipcRenderer.invoke('settings:updateAll', settings, userId)
  },
  dialog: {
    openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
    showMessage: (options) => ipcRenderer.invoke('dialog:showMessage', options)
  },
  file: {
    openExternal: (filePath) => ipcRenderer.invoke('file:openExternal', filePath),
    showInFolder: (filePath) => ipcRenderer.invoke('file:showInFolder', filePath)
  },
  logger: {
    getLogs: (filter) => ipcRenderer.invoke('logger:getLogs', filter),
    clearLogs: () => ipcRenderer.invoke('logger:clearLogs'),
    getStats: () => ipcRenderer.invoke('logger:getStats'),
    log: (level, message) => ipcRenderer.send('logger:log', level, message)
  },
  scheduledEmails: {
    create: (data, userId) => ipcRenderer.invoke('scheduledEmails:create', data, userId),
    getAll: (includeInactive) => ipcRenderer.invoke('scheduledEmails:getAll', includeInactive),
    getById: (id) => ipcRenderer.invoke('scheduledEmails:getById', id),
    update: (id, data, userId) => ipcRenderer.invoke('scheduledEmails:update', id, data, userId),
    delete: (id, userId) => ipcRenderer.invoke('scheduledEmails:delete', id, userId),
    getInstances: (startDate, endDate, status) => ipcRenderer.invoke('scheduledEmails:getInstances', startDate, endDate, status),
    getTodayInstances: () => ipcRenderer.invoke('scheduledEmails:getTodayInstances'),
    getPendingCounts: () => ipcRenderer.invoke('scheduledEmails:getPendingCounts'),
    generateInstances: (date) => ipcRenderer.invoke('scheduledEmails:generateInstances', date),
    markSent: (instanceId, userId) => ipcRenderer.invoke('scheduledEmails:markSent', instanceId, userId),
    dismiss: (instanceId, userId, notes) => ipcRenderer.invoke('scheduledEmails:dismiss', instanceId, userId, notes),
    reset: (instanceId, userId) => ipcRenderer.invoke('scheduledEmails:reset', instanceId, userId),
    getInstanceById: (instanceId) => ipcRenderer.invoke('scheduledEmails:getInstanceById', instanceId),
    composeEmail: (instanceId, userId) => ipcRenderer.invoke('scheduledEmails:composeEmail', instanceId, userId),
    getHistory: (scheduleId) => ipcRenderer.invoke('scheduledEmails:getHistory', scheduleId),
    previewPlaceholders: (text, date, language, userId) => ipcRenderer.invoke('scheduledEmails:previewPlaceholders', text, date, language, userId)
  },
  updater: {
    getVersion: () => ipcRenderer.invoke('updater:getVersion'),
    importZip: () => ipcRenderer.invoke('updater:importZip'),
    applyUpdate: () => ipcRenderer.invoke('updater:applyUpdate'),
    cancelUpdate: () => ipcRenderer.invoke('updater:cancelUpdate'),
    checkPending: () => ipcRenderer.invoke('updater:checkPending')
  },
  dashboard: {
    getStats: () => ipcRenderer.invoke('dashboard:getStats'),
    getDiskSpace: () => ipcRenderer.invoke('dashboard:getDiskSpace'),
    getRecentActivity: (limit) => ipcRenderer.invoke('dashboard:getRecentActivity', limit),
    getActivityByMonth: (year) => ipcRenderer.invoke('dashboard:getActivityByMonth', year),
    getTopTopics: (limit) => ipcRenderer.invoke('dashboard:getTopTopics', limit)
  },
  calendar: {
    getEvents: (year, month) => ipcRenderer.invoke('calendar:getEvents', year, month),
    getEventsForDate: (date) => ipcRenderer.invoke('calendar:getEventsForDate', date),
    getUpcoming: (days) => ipcRenderer.invoke('calendar:getUpcoming', days)
  },
  tags: {
    create: (data, userId) => ipcRenderer.invoke('tags:create', data, userId),
    getAll: () => ipcRenderer.invoke('tags:getAll'),
    getById: (id) => ipcRenderer.invoke('tags:getById', id),
    update: (id, data, userId) => ipcRenderer.invoke('tags:update', id, data, userId),
    delete: (id, userId) => ipcRenderer.invoke('tags:delete', id, userId),
    getRecordTags: (recordId) => ipcRenderer.invoke('tags:getRecordTags', recordId),
    setRecordTags: (recordId, tagIds, userId) => ipcRenderer.invoke('tags:setRecordTags', recordId, tagIds, userId),
    getIssueTags: (issueId) => ipcRenderer.invoke('tags:getIssueTags', issueId),
    setIssueTags: (issueId, tagIds, userId) => ipcRenderer.invoke('tags:setIssueTags', issueId, tagIds, userId),
    getLetterTags: (letterId) => ipcRenderer.invoke('tags:getLetterTags', letterId),
    setLetterTags: (letterId, tagIds, userId) => ipcRenderer.invoke('tags:setLetterTags', letterId, tagIds, userId),
    getMomTags: (momId) => ipcRenderer.invoke('tags:getMomTags', momId),
    setMomTags: (momId, tagIds, userId) => ipcRenderer.invoke('tags:setMomTags', momId, tagIds, userId),
    getRecordsByTag: (tagId) => ipcRenderer.invoke('tags:getRecordsByTag', tagId),
    getIssuesByTag: (tagId) => ipcRenderer.invoke('tags:getIssuesByTag', tagId),
    getLettersByTag: (tagId) => ipcRenderer.invoke('tags:getLettersByTag', tagId),
    getMomsByTag: (tagId) => ipcRenderer.invoke('tags:getMomsByTag', tagId)
  },
  advancedSearch: {
    search: (filters, userId) => ipcRenderer.invoke('search:advanced', filters, userId),
    suggestions: (partialQuery, userId, limit) => ipcRenderer.invoke('search:suggestions', partialQuery, userId, limit),
    history: (userId, limit) => ipcRenderer.invoke('search:history', userId, limit),
    clearHistory: (userId) => ipcRenderer.invoke('search:clearHistory', userId),
    deleteHistoryEntry: (id, userId) => ipcRenderer.invoke('search:deleteHistoryEntry', id, userId),
    rebuildFtsIndexes: () => ipcRenderer.invoke('search:rebuildFtsIndexes'),
    getFtsStats: () => ipcRenderer.invoke('search:getFtsStats'),
    highlight: (text, searchTerms, maxLength) => ipcRenderer.invoke('search:highlight', text, searchTerms, maxLength),
    createSaved: (userId, name, filters) => ipcRenderer.invoke('search:createSaved', userId, name, filters),
    getSaved: (userId) => ipcRenderer.invoke('search:getSaved', userId),
    getSavedById: (id) => ipcRenderer.invoke('search:getSavedById', id),
    updateSaved: (id, name, filters) => ipcRenderer.invoke('search:updateSaved', id, name, filters),
    deleteSaved: (id) => ipcRenderer.invoke('search:deleteSaved', id)
  },
  history: {
    undoCreate: (entityType, entityId, userId) => ipcRenderer.invoke('history:undoCreate', entityType, entityId, userId),
    undoUpdate: (entityType, entityId, previousData, userId) => ipcRenderer.invoke('history:undoUpdate', entityType, entityId, previousData, userId),
    undoDelete: (entityType, entityId, userId) => ipcRenderer.invoke('history:undoDelete', entityType, entityId, userId),
    redoCreate: (entityType, entityId, userId) => ipcRenderer.invoke('history:redoCreate', entityType, entityId, userId),
    redoUpdate: (entityType, entityId, afterData, userId) => ipcRenderer.invoke('history:redoUpdate', entityType, entityId, afterData, userId),
    redoDelete: (entityType, entityId, userId) => ipcRenderer.invoke('history:redoDelete', entityType, entityId, userId),
    getEntity: (entityType, entityId) => ipcRenderer.invoke('history:getEntity', entityType, entityId)
  },
  pins: {
    toggle: (entityType, entityId, userId) => ipcRenderer.invoke('pins:toggle', entityType, entityId, userId),
    isPinned: (entityType, entityId, userId) => ipcRenderer.invoke('pins:isPinned', entityType, entityId, userId),
    getPinnedIds: (entityType, userId) => ipcRenderer.invoke('pins:getPinnedIds', entityType, userId),
    getPinStatuses: (entityType, entityIds, userId) => ipcRenderer.invoke('pins:getPinStatuses', entityType, entityIds, userId)
  },
  export: {
    topics: () => ipcRenderer.invoke('export:topics'),
    letters: () => ipcRenderer.invoke('export:letters'),
    moms: () => ipcRenderer.invoke('export:moms'),
    issues: () => ipcRenderer.invoke('export:issues'),
    attendance: (year, month) => ipcRenderer.invoke('export:attendance', year, month),
    searchResults: (results) => ipcRenderer.invoke('export:searchResults', results),
    recordsByTopic: (topicId) => ipcRenderer.invoke('export:recordsByTopic', topicId),
    customData: (data, sheetName, filename) => ipcRenderer.invoke('export:customData', data, sheetName, filename)
  },
  filterPresets: {
    create: (userId, entityType, name, filters, isDefault, isShared) =>
      ipcRenderer.invoke('filterPresets:create', userId, entityType, name, filters, isDefault, isShared),
    getAll: (userId, entityType) => ipcRenderer.invoke('filterPresets:getAll', userId, entityType),
    getById: (id) => ipcRenderer.invoke('filterPresets:getById', id),
    getDefault: (userId, entityType) => ipcRenderer.invoke('filterPresets:getDefault', userId, entityType),
    update: (id, userId, input) => ipcRenderer.invoke('filterPresets:update', id, userId, input),
    delete: (id, userId) => ipcRenderer.invoke('filterPresets:delete', id, userId),
    setDefault: (id, userId, entityType) => ipcRenderer.invoke('filterPresets:setDefault', id, userId, entityType),
    clearDefault: (userId, entityType) => ipcRenderer.invoke('filterPresets:clearDefault', userId, entityType),
    getStats: (userId) => ipcRenderer.invoke('filterPresets:getStats', userId)
  },
  health: {
    runChecks: () => ipcRenderer.invoke('health:runChecks'),
    getMetrics: () => ipcRenderer.invoke('health:getMetrics'),
    getLastStatus: () => ipcRenderer.invoke('health:getLastStatus'),
    forceCheckpoint: () => ipcRenderer.invoke('health:forceCheckpoint'),
    optimizeDatabase: () => ipcRenderer.invoke('health:optimizeDatabase'),
    analyzeDatabase: () => ipcRenderer.invoke('health:analyzeDatabase')
  },
  integrity: {
    check: () => ipcRenderer.invoke('integrity:check'),
    getStartupResult: () => ipcRenderer.invoke('integrity:getStartupResult'),
    isStartupComplete: () => ipcRenderer.invoke('integrity:isStartupComplete'),
    repairOrphanedRecords: () => ipcRenderer.invoke('integrity:repairOrphanedRecords'),
    rebuildFtsIndexes: () => ipcRenderer.invoke('integrity:rebuildFtsIndexes'),
    repairForeignKeyViolations: () => ipcRenderer.invoke('integrity:repairForeignKeyViolations'),
    repairOrphanedEmails: () => ipcRenderer.invoke('integrity:repairOrphanedEmails'),
    repairOrphanedAttachments: () => ipcRenderer.invoke('integrity:repairOrphanedAttachments')
  },
  sync: {
    getEntityVersion: (entityType, entityId) => ipcRenderer.invoke('sync:getEntityVersion', entityType, entityId),
    updateEntityVersion: (entityType, entityId, data, userId) =>
      ipcRenderer.invoke('sync:updateEntityVersion', entityType, entityId, data, userId),
    checkConflict: (entityType, entityId, clientVersion, clientData, originalData) =>
      ipcRenderer.invoke('sync:checkConflict', entityType, entityId, clientVersion, clientData, originalData),
    mergeConflict: (conflict, clientData, strategy, manualResolutions) =>
      ipcRenderer.invoke('sync:mergeConflict', conflict, clientData, strategy, manualResolutions),
    getRecentChanges: (entityType, since, limit) =>
      ipcRenderer.invoke('sync:getRecentChanges', entityType, since, limit)
  },
  notifications: {
    create: (input) => ipcRenderer.invoke('notifications:create', input),
    get: (userId, options) => ipcRenderer.invoke('notifications:get', userId, options),
    markAsRead: (notificationId, userId) => ipcRenderer.invoke('notifications:markAsRead', notificationId, userId),
    markAllAsRead: (userId) => ipcRenderer.invoke('notifications:markAllAsRead', userId),
    getUnreadCount: (userId) => ipcRenderer.invoke('notifications:getUnreadCount', userId),
    processMentions: (text, entityType, entityId, actorId, actorName, entityTitle) =>
      ipcRenderer.invoke('notifications:processMentions', text, entityType, entityId, actorId, actorName, entityTitle),
    getPreferences: (userId) => ipcRenderer.invoke('notifications:getPreferences', userId),
    updatePreferences: (userId, preferences) => ipcRenderer.invoke('notifications:updatePreferences', userId, preferences)
  },
  documentVersions: {
    create: (input) => ipcRenderer.invoke('documentVersions:create', input),
    getVersions: (documentType, documentId) => ipcRenderer.invoke('documentVersions:getVersions', documentType, documentId),
    getVersion: (versionId) => ipcRenderer.invoke('documentVersions:getVersion', versionId),
    getCurrentVersion: (documentType, documentId) => ipcRenderer.invoke('documentVersions:getCurrentVersion', documentType, documentId),
    restore: (versionId, userId) => ipcRenderer.invoke('documentVersions:restore', versionId, userId),
    compare: (versionId1, versionId2) => ipcRenderer.invoke('documentVersions:compare', versionId1, versionId2),
    getCount: (documentType, documentId) => ipcRenderer.invoke('documentVersions:getCount', documentType, documentId),
    verifyIntegrity: (versionId) => ipcRenderer.invoke('documentVersions:verifyIntegrity', versionId)
  },
  ocr: {
    recognizeImage: (imagePath, language) => ipcRenderer.invoke('ocr:recognizeImage', imagePath, language),
    extractAndIndex: (attachmentId, attachmentType, filePath, language, userId) =>
      ipcRenderer.invoke('ocr:extractAndIndex', attachmentId, attachmentType, filePath, language, userId),
    getExtractedText: (attachmentId) => ipcRenderer.invoke('ocr:getExtractedText', attachmentId),
    searchText: (query, attachmentType, limit) => ipcRenderer.invoke('ocr:searchText', query, attachmentType, limit),
    deleteExtractedText: (attachmentId) => ipcRenderer.invoke('ocr:deleteExtractedText', attachmentId),
    getStats: () => ipcRenderer.invoke('ocr:getStats')
  },
  signatures: {
    create: (input) => ipcRenderer.invoke('signatures:create', input),
    getAll: (userId, type) => ipcRenderer.invoke('signatures:getAll', userId, type),
    get: (signatureId) => ipcRenderer.invoke('signatures:get', signatureId),
    getDefault: (userId, type) => ipcRenderer.invoke('signatures:getDefault', userId, type),
    update: (signatureId, updates, userId) => ipcRenderer.invoke('signatures:update', signatureId, updates, userId),
    delete: (signatureId, userId) => ipcRenderer.invoke('signatures:delete', signatureId, userId),
    place: (input) => ipcRenderer.invoke('signatures:place', input),
    getPlacements: (documentType, documentId) => ipcRenderer.invoke('signatures:getPlacements', documentType, documentId),
    removePlacement: (placementId, userId) => ipcRenderer.invoke('signatures:removePlacement', placementId, userId),
    getForExport: (documentType, documentId) => ipcRenderer.invoke('signatures:getForExport', documentType, documentId)
  },
  views: {
    create: (input) => ipcRenderer.invoke('views:create', input),
    getById: (id) => ipcRenderer.invoke('views:getById', id),
    getViews: (entityType, userId, includeShared) => ipcRenderer.invoke('views:getViews', entityType, userId, includeShared),
    getDefault: (entityType, userId) => ipcRenderer.invoke('views:getDefault', entityType, userId),
    update: (id, input, userId) => ipcRenderer.invoke('views:update', id, input, userId),
    delete: (id, userId) => ipcRenderer.invoke('views:delete', id, userId),
    duplicate: (id, newName, userId) => ipcRenderer.invoke('views:duplicate', id, newName, userId),
    toggleShare: (id, userId) => ipcRenderer.invoke('views:toggleShare', id, userId)
  },
  customFields: {
    createDefinition: (input) => ipcRenderer.invoke('customFields:createDefinition', input),
    getDefinitions: (entityType) => ipcRenderer.invoke('customFields:getDefinitions', entityType),
    getDefinitionById: (id) => ipcRenderer.invoke('customFields:getDefinitionById', id),
    getDefinitionByName: (entityType, name) => ipcRenderer.invoke('customFields:getDefinitionByName', entityType, name),
    updateDefinition: (id, input, userId) => ipcRenderer.invoke('customFields:updateDefinition', id, input, userId),
    deleteDefinition: (id, userId) => ipcRenderer.invoke('customFields:deleteDefinition', id, userId),
    reorderDefinitions: (entityType, fieldIds, userId) => ipcRenderer.invoke('customFields:reorderDefinitions', entityType, fieldIds, userId),
    setFieldValue: (fieldId, entityType, entityId, value) => ipcRenderer.invoke('customFields:setFieldValue', fieldId, entityType, entityId, value),
    setFieldValues: (entityType, entityId, values) => ipcRenderer.invoke('customFields:setFieldValues', entityType, entityId, values),
    getFieldValues: (entityType, entityId) => ipcRenderer.invoke('customFields:getFieldValues', entityType, entityId),
    getFieldValuesWithDefinitions: (entityType, entityId) => ipcRenderer.invoke('customFields:getFieldValuesWithDefinitions', entityType, entityId),
    deleteFieldValues: (entityType, entityId) => ipcRenderer.invoke('customFields:deleteFieldValues', entityType, entityId),
    searchByField: (entityType, fieldName, value, operator) => ipcRenderer.invoke('customFields:searchByField', entityType, fieldName, value, operator)
  },
  import: {
    preview: (filePath) => ipcRenderer.invoke('import:preview', filePath),
    getSuggestedMappings: (entityType, headers) => ipcRenderer.invoke('import:getSuggestedMappings', entityType, headers),
    execute: (config) => ipcRenderer.invoke('import:execute', config),
    getProgress: () => ipcRenderer.invoke('import:getProgress'),
    cancel: () => ipcRenderer.invoke('import:cancel'),
    generateTemplate: (entityType) => ipcRenderer.invoke('import:generateTemplate', entityType),
    selectFile: () => ipcRenderer.invoke('import:selectFile'),
    onProgress: (callback) => {
      ipcRenderer.on('import:progress', (_event, progress) => callback(progress))
      return () => ipcRenderer.removeAllListeners('import:progress')
    }
  },
  mentions: {
    create: (input, userId) => ipcRenderer.invoke('mentions:create', input, userId),
    createBulk: (inputs, userId) => ipcRenderer.invoke('mentions:createBulk', inputs, userId),
    getById: (id) => ipcRenderer.invoke('mentions:getById', id),
    getForUser: (userId, filters) => ipcRenderer.invoke('mentions:getForUser', userId, filters),
    getSentByUser: (userId, filters) => ipcRenderer.invoke('mentions:getSentByUser', userId, filters),
    getForEntity: (entityType, entityId) => ipcRenderer.invoke('mentions:getForEntity', entityType, entityId),
    getAll: (filters) => ipcRenderer.invoke('mentions:getAll', filters),
    acknowledge: (id, userId) => ipcRenderer.invoke('mentions:acknowledge', id, userId),
    archive: (id, userId) => ipcRenderer.invoke('mentions:archive', id, userId),
    updateNote: (id, note, userId) => ipcRenderer.invoke('mentions:updateNote', id, note, userId),
    delete: (id, userId) => ipcRenderer.invoke('mentions:delete', id, userId),
    getUnacknowledgedCount: (userId) => ipcRenderer.invoke('mentions:getUnacknowledgedCount', userId),
    getCounts: (userId) => ipcRenderer.invoke('mentions:getCounts', userId),
    searchUsers: (query) => ipcRenderer.invoke('mentions:searchUsers', query),
    cleanup: () => ipcRenderer.invoke('mentions:cleanup')
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// TypeScript declaration for window.electronAPI
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
