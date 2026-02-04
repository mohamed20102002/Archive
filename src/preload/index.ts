import { contextBridge, ipcRenderer } from 'electron'

// Type definitions for the exposed API
export interface ElectronAPI {
  app: {
    isFirstRun: () => Promise<boolean>
    showNotification: (title: string, body: string) => Promise<void>
    getInfo: () => Promise<{ version: string; platform: string; isPackaged: boolean }>
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
    verifyToken: (token: string) => Promise<{ valid: boolean; error?: string }>
    createUser: (username: string, password: string, displayName: string, role: 'admin' | 'user') => Promise<{
      success: boolean
      user?: unknown
      error?: string
    }>
    getAllUsers: () => Promise<unknown[]>
    updateUser: (id: string, updates: unknown, updatedBy: string) => Promise<{ success: boolean; error?: string }>
    changePassword: (userId: string, currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
    hasAdminUser: () => Promise<boolean>
    resetPassword: (userId: string, newPassword: string, adminId: string) => Promise<{ success: boolean; error?: string }>
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
  }
  outlook: {
    connect: () => Promise<{ success: boolean; error?: string }>
    disconnect: () => Promise<void>
    isConnected: () => Promise<boolean>
    getMailboxes: () => Promise<unknown[]>
    getFolders: (mailboxId: string) => Promise<unknown[]>
    getEmails: (folderId: string, storeId: string, limit?: number) => Promise<unknown[]>
    getEmailDetails: (entryId: string, storeId: string) => Promise<unknown | null>
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
  }
  handover: {
    getWeekInfo: (offsetWeeks?: number) => Promise<unknown>
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
    search: (query: string) => Promise<unknown[]>
    findByEmailDomain: (email: string) => Promise<unknown | null>
    update: (id: string, data: unknown, userId: string) => Promise<{ success: boolean; error?: string }>
    delete: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    getStats: () => Promise<{ total: number; byType: Record<string, number> }>
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
  attendance: {
    createCondition: (data: unknown, userId: string) => Promise<{ success: boolean; condition?: unknown; error?: string }>
    updateCondition: (id: string, data: unknown, userId: string) => Promise<{ success: boolean; error?: string }>
    deleteCondition: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    getConditions: (includeDeleted?: boolean) => Promise<unknown[]>
    saveEntry: (data: unknown, userId: string) => Promise<{ success: boolean; entry?: unknown; error?: string }>
    saveBulkEntries: (data: unknown, userId: string) => Promise<{ success: boolean; count?: number; error?: string }>
    deleteEntry: (entryId: string, userId: string) => Promise<{ success: boolean; error?: string }>
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
    close: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    reopen: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
    saveFile: (momId: string, fileBase64: string, filename: string, userId: string) => Promise<{ success: boolean; error?: string }>
    getFilePath: (momId: string) => Promise<string | null>
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
    delete: (id: string, userId: string) => Promise<{ success: boolean; error?: string }>
  }
  settings: {
    get: (key: string) => Promise<string | null>
    getAll: () => Promise<Record<string, string>>
    update: (key: string, value: string, userId: string) => Promise<{ success: boolean; error?: string }>
    updateAll: (settings: Record<string, string>, userId: string) => Promise<{ success: boolean; error?: string }>
  }
  ai: {
    getStatus: () => Promise<{ available: boolean; modelLoaded: boolean; modelName: string | null; error?: string }>
    summarize: (topicId: string, mode?: string) => Promise<{ success: boolean; summary?: string; error?: string }>
    dispose: () => Promise<void>
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
  }
  file: {
    openExternal: (filePath: string) => Promise<{ success: boolean; error?: string }>
    showInFolder: (filePath: string) => Promise<{ success: boolean; error?: string }>
  }
}

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
const electronAPI: ElectronAPI = {
  app: {
    isFirstRun: () => ipcRenderer.invoke('app:isFirstRun'),
    showNotification: (title, body) => ipcRenderer.invoke('app:showNotification', title, body),
    getInfo: () => ipcRenderer.invoke('app:getInfo')
  },
  auth: {
    login: (username, password) => ipcRenderer.invoke('auth:login', username, password),
    logout: (token, userId) => ipcRenderer.invoke('auth:logout', token, userId),
    verifyToken: (token) => ipcRenderer.invoke('auth:verifyToken', token),
    createUser: (username, password, displayName, role) =>
      ipcRenderer.invoke('auth:createUser', username, password, displayName, role),
    getAllUsers: () => ipcRenderer.invoke('auth:getAllUsers'),
    updateUser: (id, updates, updatedBy) => ipcRenderer.invoke('auth:updateUser', id, updates, updatedBy),
    changePassword: (userId, currentPassword, newPassword) =>
      ipcRenderer.invoke('auth:changePassword', userId, currentPassword, newPassword),
    hasAdminUser: () => ipcRenderer.invoke('auth:hasAdminUser'),
    resetPassword: (userId, newPassword, adminId) =>
      ipcRenderer.invoke('auth:resetPassword', userId, newPassword, adminId)
  },
  topics: {
    create: (data, userId) => ipcRenderer.invoke('topics:create', data, userId),
    getAll: () => ipcRenderer.invoke('topics:getAll'),
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
    search: (query, topicId) => ipcRenderer.invoke('records:search', query, topicId)
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
    openFile: (emailId) => ipcRenderer.invoke('emails:openFile', emailId)
  },
  outlook: {
    connect: () => ipcRenderer.invoke('outlook:connect'),
    disconnect: () => ipcRenderer.invoke('outlook:disconnect'),
    isConnected: () => ipcRenderer.invoke('outlook:isConnected'),
    getMailboxes: () => ipcRenderer.invoke('outlook:getMailboxes'),
    getFolders: (mailboxId) => ipcRenderer.invoke('outlook:getFolders', mailboxId),
    getEmails: (folderId, storeId, limit) => ipcRenderer.invoke('outlook:getEmails', folderId, storeId, limit),
    getEmailDetails: (entryId, storeId) => ipcRenderer.invoke('outlook:getEmailDetails', entryId, storeId)
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
    getStats: () => ipcRenderer.invoke('audit:getStats')
  },
  handover: {
    getWeekInfo: (offsetWeeks) => ipcRenderer.invoke('handover:getWeekInfo', offsetWeeks),
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
    search: (query) => ipcRenderer.invoke('authorities:search', query),
    findByEmailDomain: (email) => ipcRenderer.invoke('authorities:findByEmailDomain', email),
    update: (id, data, userId) => ipcRenderer.invoke('authorities:update', id, data, userId),
    delete: (id, userId) => ipcRenderer.invoke('authorities:delete', id, userId),
    getStats: () => ipcRenderer.invoke('authorities:getStats')
  },
  letters: {
    create: (data, userId) => ipcRenderer.invoke('letters:create', data, userId),
    getAll: () => ipcRenderer.invoke('letters:getAll'),
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
    getFilePath: (draftId) => ipcRenderer.invoke('letterDrafts:getFilePath', draftId)
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
    getStats: () => ipcRenderer.invoke('secureReferences:getStats')
  },
  attendance: {
    createCondition: (data, userId) => ipcRenderer.invoke('attendance:createCondition', data, userId),
    updateCondition: (id, data, userId) => ipcRenderer.invoke('attendance:updateCondition', id, data, userId),
    deleteCondition: (id, userId) => ipcRenderer.invoke('attendance:deleteCondition', id, userId),
    getConditions: (includeDeleted) => ipcRenderer.invoke('attendance:getConditions', includeDeleted),
    saveEntry: (data, userId) => ipcRenderer.invoke('attendance:saveEntry', data, userId),
    saveBulkEntries: (data, userId) => ipcRenderer.invoke('attendance:saveBulkEntries', data, userId),
    deleteEntry: (entryId, userId) => ipcRenderer.invoke('attendance:deleteEntry', entryId, userId),
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
    exportPdfDialog: (year, userId) => ipcRenderer.invoke('attendance:exportPdfDialog', year, userId)
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
    close: (id, userId) => ipcRenderer.invoke('moms:close', id, userId),
    reopen: (id, userId) => ipcRenderer.invoke('moms:reopen', id, userId),
    saveFile: (momId, fileBase64, filename, userId) => ipcRenderer.invoke('moms:saveFile', momId, fileBase64, filename, userId),
    getFilePath: (momId) => ipcRenderer.invoke('moms:getFilePath', momId),
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
    delete: (id, userId) => ipcRenderer.invoke('momDrafts:delete', id, userId)
  },
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    update: (key, value, userId) => ipcRenderer.invoke('settings:update', key, value, userId),
    updateAll: (settings, userId) => ipcRenderer.invoke('settings:updateAll', settings, userId)
  },
  ai: {
    getStatus: () => ipcRenderer.invoke('ai:getStatus'),
    summarize: (topicId, mode) => ipcRenderer.invoke('ai:summarize', topicId, mode),
    dispose: () => ipcRenderer.invoke('ai:dispose')
  },
  dialog: {
    openFile: (options) => ipcRenderer.invoke('dialog:openFile', options)
  },
  file: {
    openExternal: (filePath) => ipcRenderer.invoke('file:openExternal', filePath),
    showInFolder: (filePath) => ipcRenderer.invoke('file:showInFolder', filePath)
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// TypeScript declaration for window.electronAPI
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
