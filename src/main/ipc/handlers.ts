import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as authService from '../services/auth.service'
import * as topicService from '../services/topic.service'
import * as recordService from '../services/record.service'
import * as subcategoryService from '../services/subcategory.service'
import * as emailService from '../services/email.service'
import * as outlookService from '../services/outlook.service'
import * as reminderService from '../services/reminder.service'
import * as handoverService from '../services/handover.service'
import * as authorityService from '../services/authority.service'
import * as letterService from '../services/letter.service'
import * as letterDraftService from '../services/letter-draft.service'
import * as letterReferenceService from '../services/letter-reference.service'
import * as letterAttachmentService from '../services/letter-attachment.service'
import * as issueService from '../services/issue.service'
import * as credentialService from '../services/credential.service'
import * as secureReferenceService from '../services/secure-reference.service'
import * as auditService from '../database/audit'

export function registerIpcHandlers(): void {
  // ===== Auth Handlers =====

  ipcMain.handle('auth:login', async (_event, username: string, password: string) => {
    return authService.login(username, password)
  })

  ipcMain.handle('auth:logout', async (_event, token: string, userId: string) => {
    authService.logout(token, userId)
  })

  ipcMain.handle('auth:verifyToken', async (_event, token: string) => {
    return authService.verifyToken(token)
  })

  ipcMain.handle('auth:createUser', async (_event, username: string, password: string, displayName: string, role: 'admin' | 'user') => {
    return authService.createUser(username, password, displayName, role)
  })

  ipcMain.handle('auth:getAllUsers', async () => {
    return authService.getAllUsers()
  })

  ipcMain.handle('auth:updateUser', async (_event, id: string, updates: unknown, updatedBy: string) => {
    return authService.updateUser(id, updates as Parameters<typeof authService.updateUser>[1], updatedBy)
  })

  ipcMain.handle('auth:changePassword', async (_event, userId: string, currentPassword: string, newPassword: string) => {
    return authService.changePassword(userId, currentPassword, newPassword)
  })

  ipcMain.handle('auth:hasAdminUser', async () => {
    return authService.hasAdminUser()
  })

  ipcMain.handle('auth:resetPassword', async (_event, userId: string, newPassword: string, adminId: string) => {
    return authService.resetPassword(userId, newPassword, adminId)
  })

  // ===== Topic Handlers =====

  ipcMain.handle('topics:create', async (_event, data: unknown, userId: string) => {
    return topicService.createTopic(data as topicService.CreateTopicData, userId)
  })

  ipcMain.handle('topics:getAll', async () => {
    return topicService.getAllTopics()
  })

  ipcMain.handle('topics:getById', async (_event, id: string) => {
    return topicService.getTopicById(id)
  })

  ipcMain.handle('topics:update', async (_event, id: string, data: unknown, userId: string) => {
    return topicService.updateTopic(id, data as topicService.UpdateTopicData, userId)
  })

  ipcMain.handle('topics:delete', async (_event, id: string, userId: string) => {
    return topicService.deleteTopic(id, userId)
  })

  ipcMain.handle('topics:search', async (_event, query: string) => {
    return topicService.searchTopics(query)
  })

  // ===== Record Handlers =====

  ipcMain.handle('records:create', async (_event, data: unknown, userId: string) => {
    return recordService.createRecord(data as recordService.CreateRecordData, userId)
  })

  ipcMain.handle('records:getByTopic', async (_event, topicId: string, subcategoryId?: string | null) => {
    return recordService.getRecordsByTopic(topicId, subcategoryId)
  })

  ipcMain.handle('records:getById', async (_event, id: string) => {
    return recordService.getRecordById(id)
  })

  ipcMain.handle('records:update', async (_event, id: string, data: unknown, userId: string) => {
    return recordService.updateRecord(id, data as recordService.UpdateRecordData, userId)
  })

  ipcMain.handle('records:delete', async (_event, id: string, userId: string) => {
    return recordService.deleteRecord(id, userId)
  })

  ipcMain.handle('records:search', async (_event, query: string, topicId?: string) => {
    return recordService.searchRecords(query, topicId)
  })

  // ===== Subcategory Handlers =====

  ipcMain.handle('subcategories:create', async (_event, data: unknown, userId: string) => {
    return subcategoryService.createSubcategory(data as subcategoryService.CreateSubcategoryData, userId)
  })

  ipcMain.handle('subcategories:getByTopic', async (_event, topicId: string) => {
    return subcategoryService.getSubcategoriesByTopic(topicId)
  })

  ipcMain.handle('subcategories:getById', async (_event, id: string) => {
    return subcategoryService.getSubcategoryById(id)
  })

  ipcMain.handle('subcategories:update', async (_event, id: string, data: unknown, userId: string) => {
    return subcategoryService.updateSubcategory(id, data as subcategoryService.UpdateSubcategoryData, userId)
  })

  ipcMain.handle('subcategories:delete', async (_event, id: string, userId: string) => {
    return subcategoryService.deleteSubcategory(id, userId)
  })

  // ===== Email Handlers =====

  ipcMain.handle('emails:archive', async (_event, emailData: unknown, topicId: string, userId: string, subcategoryId?: string) => {
    return emailService.archiveEmail(emailData as Parameters<typeof emailService.archiveEmail>[0], topicId, userId, subcategoryId)
  })

  ipcMain.handle('emails:getById', async (_event, id: string) => {
    return emailService.getEmailById(id)
  })

  ipcMain.handle('emails:getByRecord', async (_event, recordId: string) => {
    return emailService.getEmailByRecord(recordId)
  })

  ipcMain.handle('emails:search', async (_event, query: string) => {
    return emailService.searchEmails(query)
  })

  ipcMain.handle('emails:isArchived', async (_event, outlookEntryId: string) => {
    return emailService.isEmailArchived(outlookEntryId)
  })

  ipcMain.handle('emails:getArchivedIds', async () => {
    return emailService.getArchivedEmailIds()
  })

  ipcMain.handle('emails:openFile', async (_event, emailId: string) => {
    return emailService.openEmailFile(emailId)
  })

  // ===== Outlook Handlers =====

  ipcMain.handle('outlook:connect', async () => {
    return outlookService.connect()
  })

  ipcMain.handle('outlook:disconnect', async () => {
    outlookService.disconnect()
  })

  ipcMain.handle('outlook:isConnected', async () => {
    return outlookService.getIsConnected()
  })

  ipcMain.handle('outlook:getMailboxes', async () => {
    try {
      return outlookService.getMailboxes()
    } catch (error: any) {
      console.error('Error getting mailboxes:', error)
      throw error
    }
  })

  ipcMain.handle('outlook:getFolders', async (_event, storeId: string) => {
    console.log('=== outlook:getFolders called ===')
    console.log('storeId:', storeId)
    try {
      const folders = outlookService.getFolders(storeId)
      console.log('Folders loaded:', folders.length)
      if (folders.length > 0) {
        console.log('First folder:', JSON.stringify(folders[0], null, 2))
      }
      return folders
    } catch (error: any) {
      console.error('Error getting folders:', error)
      throw error
    }
  })

  ipcMain.handle('outlook:getEmails', async (_event, folderId: string, storeId: string, limit?: number) => {
    console.log('=== outlook:getEmails called ===')
    console.log('folderId:', folderId)
    console.log('storeId:', storeId)
    console.log('limit:', limit)
    try {
      const emails = outlookService.getEmails(folderId, storeId, limit)
      console.log('Emails loaded:', emails.length)
      return emails
    } catch (error: any) {
      console.error('Error getting emails:', error)
      throw error
    }
  })

  ipcMain.handle('outlook:getEmailDetails', async (_event, entryId: string, storeId: string) => {
    console.log('=== outlook:getEmailDetails called ===')
    console.log('entryId:', entryId)
    console.log('storeId:', storeId)
    try {
      const email = outlookService.getEmailDetails(entryId, storeId)
      console.log('Email details loaded:', email?.subject)
      return email
    } catch (error: any) {
      console.error('Error getting email details:', error)
      throw error
    }
  })

  // ===== Reminder Handlers =====

  ipcMain.handle('reminders:create', async (_event, data: unknown, userId: string) => {
    return reminderService.createReminder(data as reminderService.CreateReminderData, userId)
  })

  ipcMain.handle('reminders:getAll', async () => {
    return reminderService.getAllReminders()
  })

  ipcMain.handle('reminders:getUpcoming', async (_event, days?: number) => {
    return reminderService.getUpcomingReminders(days)
  })

  ipcMain.handle('reminders:getOverdue', async () => {
    return reminderService.getOverdueReminders()
  })

  ipcMain.handle('reminders:complete', async (_event, id: string, userId: string) => {
    return reminderService.completeReminder(id, userId)
  })

  ipcMain.handle('reminders:delete', async (_event, id: string, userId: string) => {
    return reminderService.deleteReminder(id, userId)
  })

  // ===== Audit Handlers =====

  ipcMain.handle('audit:getLog', async (_event, options?: unknown) => {
    return auditService.getAuditLog(options as Parameters<typeof auditService.getAuditLog>[0])
  })

  ipcMain.handle('audit:verifyIntegrity', async () => {
    return auditService.verifyAuditIntegrity()
  })

  ipcMain.handle('audit:getStats', async () => {
    return auditService.getAuditStats()
  })

  // ===== Handover Handlers =====

  ipcMain.handle('handover:getWeekInfo', async (_event, offsetWeeks?: number) => {
    return handoverService.getWeekInfo(offsetWeeks)
  })

  ipcMain.handle('handover:getRecords', async (_event, startDate: string, endDate: string) => {
    return handoverService.getHandoverRecords(startDate, endDate)
  })

  ipcMain.handle('handover:getSummary', async (_event, records: handoverService.HandoverRecord[]) => {
    return handoverService.getHandoverSummary(records)
  })

  ipcMain.handle('handover:export', async (_event, records: handoverService.HandoverRecord[], weekInfo: handoverService.WeekInfo, userId: string, replaceExisting?: boolean) => {
    return handoverService.exportToWord(records, weekInfo, userId, replaceExisting || false)
  })

  ipcMain.handle('handover:getArchives', async () => {
    return handoverService.getHandoverArchives()
  })

  ipcMain.handle('handover:deleteArchive', async (_event, id: string, userId: string) => {
    return handoverService.deleteHandoverArchive(id, userId)
  })

  ipcMain.handle('handover:openFile', async (_event, id: string) => {
    return handoverService.openHandoverFile(id)
  })

  // ===== Authority Handlers =====

  ipcMain.handle('authorities:create', async (_event, data: unknown, userId: string) => {
    return authorityService.createAuthority(data as authorityService.CreateAuthorityData, userId)
  })

  ipcMain.handle('authorities:getAll', async () => {
    return authorityService.getAllAuthorities()
  })

  ipcMain.handle('authorities:getById', async (_event, id: string) => {
    return authorityService.getAuthorityById(id)
  })

  ipcMain.handle('authorities:getByType', async (_event, type: string) => {
    return authorityService.getAuthoritiesByType(type)
  })

  ipcMain.handle('authorities:search', async (_event, query: string) => {
    return authorityService.searchAuthorities(query)
  })

  ipcMain.handle('authorities:findByEmailDomain', async (_event, email: string) => {
    return authorityService.findAuthorityByEmailDomain(email)
  })

  ipcMain.handle('authorities:update', async (_event, id: string, data: unknown, userId: string) => {
    return authorityService.updateAuthority(id, data as authorityService.UpdateAuthorityData, userId)
  })

  ipcMain.handle('authorities:delete', async (_event, id: string, userId: string) => {
    return authorityService.deleteAuthority(id, userId)
  })

  ipcMain.handle('authorities:getStats', async () => {
    return authorityService.getAuthorityStats()
  })

  // ===== Letter Handlers =====

  ipcMain.handle('letters:create', async (_event, data: unknown, userId: string) => {
    return letterService.createLetter(data as letterService.CreateLetterData, userId)
  })

  ipcMain.handle('letters:getAll', async () => {
    return letterService.getAllLetters()
  })

  ipcMain.handle('letters:getById', async (_event, id: string) => {
    return letterService.getLetterById(id)
  })

  ipcMain.handle('letters:getByTopic', async (_event, topicId: string, subcategoryId?: string) => {
    return letterService.getLettersByTopic(topicId, subcategoryId)
  })

  ipcMain.handle('letters:getByAuthority', async (_event, authorityId: string) => {
    return letterService.getLettersByAuthority(authorityId)
  })

  ipcMain.handle('letters:search', async (_event, params: unknown) => {
    const result = letterService.searchLetters(params as letterService.LetterSearchParams)
    return result.letters
  })

  ipcMain.handle('letters:update', async (_event, id: string, data: unknown, userId: string) => {
    return letterService.updateLetter(id, data as letterService.UpdateLetterData, userId)
  })

  ipcMain.handle('letters:delete', async (_event, id: string, userId: string) => {
    return letterService.deleteLetter(id, userId)
  })

  ipcMain.handle('letters:saveFile', async (_event, letterId: string, fileBase64: string, filename: string, userId: string) => {
    // Convert base64 string to Buffer
    const fileBuffer = Buffer.from(fileBase64, 'base64')
    return letterService.saveLetterFile(letterId, fileBuffer, filename, userId)
  })

  ipcMain.handle('letters:getFilePath', async (_event, letterId: string) => {
    return letterService.getLetterFilePath(letterId)
  })

  ipcMain.handle('letters:getStats', async () => {
    return letterService.getLetterStats()
  })

  ipcMain.handle('letters:getPending', async () => {
    return letterService.getPendingLetters()
  })

  ipcMain.handle('letters:getOverdue', async () => {
    return letterService.getOverdueLetters()
  })

  // ===== Letter Draft Handlers =====

  ipcMain.handle('letterDrafts:create', async (_event, data: unknown, userId: string) => {
    return letterDraftService.createDraft(data as letterDraftService.CreateDraftData, userId)
  })

  ipcMain.handle('letterDrafts:getById', async (_event, id: string) => {
    return letterDraftService.getDraftById(id)
  })

  ipcMain.handle('letterDrafts:getByLetter', async (_event, letterId: string) => {
    return letterDraftService.getDraftsByLetter(letterId)
  })

  ipcMain.handle('letterDrafts:getLatest', async (_event, letterId: string) => {
    return letterDraftService.getLatestDraft(letterId)
  })

  ipcMain.handle('letterDrafts:getFinal', async (_event, letterId: string) => {
    return letterDraftService.getFinalDraft(letterId)
  })

  ipcMain.handle('letterDrafts:update', async (_event, id: string, data: unknown, userId: string) => {
    return letterDraftService.updateDraft(id, data as letterDraftService.UpdateDraftData, userId)
  })

  ipcMain.handle('letterDrafts:updateStatus', async (_event, id: string, status: letterDraftService.DraftStatus, userId: string) => {
    return letterDraftService.updateDraftStatus(id, status, userId)
  })

  ipcMain.handle('letterDrafts:approve', async (_event, id: string, userId: string) => {
    return letterDraftService.approveDraft(id, userId)
  })

  ipcMain.handle('letterDrafts:markAsSent', async (_event, id: string, userId: string) => {
    return letterDraftService.markDraftAsSent(id, userId)
  })

  ipcMain.handle('letterDrafts:delete', async (_event, id: string, userId: string) => {
    return letterDraftService.deleteDraft(id, userId)
  })

  ipcMain.handle('letterDrafts:saveFile', async (_event, draftId: string, fileBase64: string, filename: string, userId: string) => {
    // Convert base64 string to Buffer
    const fileBuffer = Buffer.from(fileBase64, 'base64')
    return letterDraftService.saveDraftFile(draftId, fileBuffer, filename, userId)
  })

  ipcMain.handle('letterDrafts:getFilePath', async (_event, draftId: string) => {
    return letterDraftService.getDraftFilePath(draftId)
  })

  // ===== Letter Reference Handlers =====

  ipcMain.handle('letterReferences:create', async (_event, data: unknown, userId: string) => {
    return letterReferenceService.createReference(data as letterReferenceService.CreateReferenceData, userId)
  })

  ipcMain.handle('letterReferences:getById', async (_event, id: string) => {
    return letterReferenceService.getReferenceById(id)
  })

  ipcMain.handle('letterReferences:getFrom', async (_event, letterId: string) => {
    return letterReferenceService.getReferencesFrom(letterId)
  })

  ipcMain.handle('letterReferences:getTo', async (_event, letterId: string) => {
    return letterReferenceService.getReferencesTo(letterId)
  })

  ipcMain.handle('letterReferences:getAll', async (_event, letterId: string) => {
    return letterReferenceService.getAllReferences(letterId)
  })

  ipcMain.handle('letterReferences:getByType', async (_event, letterId: string, type: letterReferenceService.ReferenceType, direction?: 'from' | 'to' | 'both') => {
    return letterReferenceService.getReferencesByType(letterId, type, direction)
  })

  ipcMain.handle('letterReferences:getLetterWithRefs', async (_event, letterId: string) => {
    return letterReferenceService.getLetterWithReferences(letterId)
  })

  ipcMain.handle('letterReferences:update', async (_event, id: string, data: unknown, userId: string) => {
    return letterReferenceService.updateReference(id, data as { reference_type?: letterReferenceService.ReferenceType; notes?: string }, userId)
  })

  ipcMain.handle('letterReferences:delete', async (_event, id: string, userId: string) => {
    return letterReferenceService.deleteReference(id, userId)
  })

  ipcMain.handle('letterReferences:buildGraph', async (_event, letterId: string, maxDepth?: number) => {
    return letterReferenceService.buildReferenceGraph(letterId, maxDepth)
  })

  ipcMain.handle('letterReferences:getChain', async (_event, letterId: string) => {
    return letterReferenceService.getLetterChain(letterId)
  })

  ipcMain.handle('letterReferences:findByPattern', async (_event, pattern: string) => {
    return letterReferenceService.findLettersByReferencePattern(pattern)
  })

  ipcMain.handle('letterReferences:findByRefNumber', async (_event, refNumber: string) => {
    return letterReferenceService.findLetterByReferenceNumber(refNumber)
  })

  ipcMain.handle('letterReferences:createByRefNumber', async (_event, sourceId: string, targetRefNumber: string, referenceType: letterReferenceService.ReferenceType, notes: string | null, userId: string) => {
    return letterReferenceService.createReferenceByRefNumber(sourceId, targetRefNumber, referenceType, notes, userId)
  })

  ipcMain.handle('letterReferences:getProcessFlow', async (_event, letterId: string) => {
    return letterReferenceService.getProcessFlowData(letterId)
  })

  // ===== Letter Attachment Handlers =====

  ipcMain.handle('letterAttachments:add', async (_event, letterId: string, fileBase64: string, filename: string, userId: string, draftId?: string) => {
    const fileBuffer = Buffer.from(fileBase64, 'base64')
    return letterAttachmentService.addAttachment(letterId, fileBuffer, filename, userId, draftId)
  })

  ipcMain.handle('letterAttachments:getById', async (_event, id: string) => {
    return letterAttachmentService.getAttachmentById(id)
  })

  ipcMain.handle('letterAttachments:getByLetter', async (_event, letterId: string) => {
    return letterAttachmentService.getAttachmentsByLetter(letterId)
  })

  ipcMain.handle('letterAttachments:getByDraft', async (_event, draftId: string) => {
    return letterAttachmentService.getAttachmentsByDraft(draftId)
  })

  ipcMain.handle('letterAttachments:delete', async (_event, id: string, userId: string) => {
    return letterAttachmentService.deleteAttachment(id, userId)
  })

  ipcMain.handle('letterAttachments:getFilePath', async (_event, id: string) => {
    return letterAttachmentService.getAttachmentFilePath(id)
  })

  ipcMain.handle('letterAttachments:getDataDirectory', async () => {
    return letterAttachmentService.getDataDirectoryPath()
  })

  // ===== Issue Handlers =====

  ipcMain.handle('issues:create', async (_event, data: unknown, userId: string) => {
    return issueService.createIssue(data as issueService.CreateIssueData, userId)
  })

  ipcMain.handle('issues:getById', async (_event, id: string) => {
    return issueService.getIssueById(id)
  })

  ipcMain.handle('issues:getOpen', async (_event, filters?: unknown) => {
    return issueService.getOpenIssues(filters as issueService.IssueFilters | undefined)
  })

  ipcMain.handle('issues:getCompleted', async (_event, filters?: unknown) => {
    return issueService.getCompletedIssues(filters as issueService.IssueFilters | undefined)
  })

  ipcMain.handle('issues:update', async (_event, id: string, data: unknown, userId: string) => {
    return issueService.updateIssue(id, data as issueService.UpdateIssueData, userId)
  })

  ipcMain.handle('issues:close', async (_event, id: string, closureNote: string | null, userId: string) => {
    return issueService.closeIssue(id, closureNote, userId)
  })

  ipcMain.handle('issues:reopen', async (_event, id: string, userId: string) => {
    return issueService.reopenIssue(id, userId)
  })

  ipcMain.handle('issues:addComment', async (_event, issueId: string, comment: string, userId: string) => {
    return issueService.addComment(issueId, comment, userId)
  })

  ipcMain.handle('issues:getHistory', async (_event, issueId: string) => {
    return issueService.getIssueHistory(issueId)
  })

  ipcMain.handle('issues:getStats', async () => {
    return issueService.getIssueStats()
  })

  ipcMain.handle('issues:getDueReminders', async () => {
    return issueService.getIssuesWithDueReminders()
  })

  ipcMain.handle('issues:getWithReminders', async (_event, days?: number) => {
    return issueService.getIssuesWithReminders(days)
  })

  ipcMain.handle('issues:markReminderNotified', async (_event, id: string) => {
    return issueService.markReminderNotified(id)
  })

  // ===== Credential Handlers =====

  ipcMain.handle('credentials:create', async (_event, data: unknown, userId: string) => {
    return credentialService.createCredential(data as credentialService.CreateCredentialData, userId)
  })

  ipcMain.handle('credentials:getAll', async (_event, filters?: unknown) => {
    return credentialService.getAllCredentials(filters as credentialService.CredentialFilters | undefined)
  })

  ipcMain.handle('credentials:getById', async (_event, id: string) => {
    return credentialService.getCredentialById(id)
  })

  ipcMain.handle('credentials:getPassword', async (_event, id: string, userId: string) => {
    return credentialService.getCredentialPassword(id, userId)
  })

  ipcMain.handle('credentials:update', async (_event, id: string, data: unknown, userId: string) => {
    return credentialService.updateCredential(id, data as credentialService.UpdateCredentialData, userId)
  })

  ipcMain.handle('credentials:delete', async (_event, id: string, userId: string) => {
    return credentialService.deleteCredential(id, userId)
  })

  // ===== Secure Reference Handlers =====

  ipcMain.handle('secureReferences:create', async (_event, data: unknown, userId: string) => {
    return secureReferenceService.createReference(data as secureReferenceService.CreateReferenceData, userId)
  })

  ipcMain.handle('secureReferences:getAll', async (_event, filters?: unknown) => {
    return secureReferenceService.getAllReferences(filters as secureReferenceService.ReferenceFilters | undefined)
  })

  ipcMain.handle('secureReferences:getById', async (_event, id: string) => {
    return secureReferenceService.getReferenceById(id)
  })

  ipcMain.handle('secureReferences:update', async (_event, id: string, data: unknown, userId: string) => {
    return secureReferenceService.updateReference(id, data as secureReferenceService.UpdateReferenceData, userId)
  })

  ipcMain.handle('secureReferences:delete', async (_event, id: string, userId: string) => {
    return secureReferenceService.deleteReference(id, userId)
  })

  ipcMain.handle('secureReferences:addFile', async (_event, refId: string, fileBase64: string, filename: string, userId: string) => {
    const fileBuffer = Buffer.from(fileBase64, 'base64')
    return secureReferenceService.addReferenceFile(refId, fileBuffer, filename, userId)
  })

  ipcMain.handle('secureReferences:getFiles', async (_event, refId: string) => {
    return secureReferenceService.getReferenceFiles(refId)
  })

  ipcMain.handle('secureReferences:deleteFile', async (_event, fileId: string, userId: string) => {
    return secureReferenceService.deleteReferenceFile(fileId, userId)
  })

  ipcMain.handle('secureReferences:getFilePath', async (_event, fileId: string) => {
    return secureReferenceService.getReferenceFilePath(fileId)
  })

  ipcMain.handle('secureReferences:getStats', async () => {
    return credentialService.getSecureResourceStats()
  })

  // ===== File Dialog Handlers =====

  ipcMain.handle('dialog:openFile', async (_event, options?: {
    title?: string
    filters?: { name: string; extensions: string[] }[]
    multiple?: boolean
  }) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { canceled: true, filePaths: [] }

    const result = await dialog.showOpenDialog(win, {
      title: options?.title || 'Select File',
      filters: options?.filters || [
        { name: 'Documents', extensions: ['pdf', 'doc', 'docx'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: options?.multiple ? ['openFile', 'multiSelections'] : ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true, filePaths: [] }
    }

    // Read file data for each selected file
    const files = result.filePaths.map(filePath => {
      const buffer = fs.readFileSync(filePath)
      const filename = filePath.split(/[\\/]/).pop() || 'file'
      return {
        path: filePath,
        filename,
        buffer: buffer.toString('base64'),
        size: buffer.length
      }
    })

    return { canceled: false, files }
  })

  ipcMain.handle('file:openExternal', async (_event, filePath: string) => {
    try {
      await shell.openPath(filePath)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('file:showInFolder', async (_event, filePath: string) => {
    try {
      shell.showItemInFolder(filePath)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  console.log('IPC handlers registered')
}
