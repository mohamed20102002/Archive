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
import * as settingsService from '../services/settings.service'
import * as aiService from '../services/ai.service'
import * as attendanceService from '../services/attendance.service'
import * as attendancePdfService from '../services/attendance-pdf.service'
import * as momService from '../services/mom.service'

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

  ipcMain.handle('letters:getByLetterId', async (_event, letterId: string) => {
    return letterService.getLetterByLetterId(letterId)
  })

  ipcMain.handle('letters:getLinkedMoms', async (_event, letterInternalId: string) => {
    return letterService.getLinkedMoms(letterInternalId)
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

  ipcMain.handle('issues:addComment', async (_event, issueId: string, comment: string, userId: string, linkedRecordIds?: string[]) => {
    return issueService.addComment(issueId, comment, userId, linkedRecordIds)
  })

  ipcMain.handle('issues:searchRecordsForLinking', async (_event, query: string, topicId?: string) => {
    return issueService.searchRecordsForLinking(query, topicId)
  })

  ipcMain.handle('issues:getRecordForLinking', async (_event, id: string) => {
    return issueService.getRecordForLinking(id)
  })

  ipcMain.handle('issues:updateComment', async (_event, historyId: string, comment: string, userId: string) => {
    return issueService.updateComment(historyId, comment, userId)
  })

  ipcMain.handle('issues:addLinkedRecords', async (_event, historyId: string, recordIds: string[], userId: string) => {
    return issueService.addLinkedRecordsToComment(historyId, recordIds, userId)
  })

  ipcMain.handle('issues:getCommentEdits', async (_event, historyId: string) => {
    return issueService.getCommentEdits(historyId)
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

  // ===== Settings Handlers =====

  ipcMain.handle('settings:get', async (_event, key: string) => {
    return settingsService.getSetting(key)
  })

  ipcMain.handle('settings:getAll', async () => {
    return settingsService.getAllSettings()
  })

  ipcMain.handle('settings:update', async (_event, key: string, value: string, userId: string) => {
    return settingsService.updateSetting(key, value, userId)
  })

  ipcMain.handle('settings:updateAll', async (_event, settings: Record<string, string>, userId: string) => {
    return settingsService.updateSettings(settings, userId)
  })

  // ===== AI Handlers =====

  ipcMain.handle('ai:getStatus', async () => {
    return aiService.getModelStatus()
  })

  ipcMain.handle('ai:summarize', async (_event, topicId: string, mode?: string) => {
    return aiService.summarizeTopic(topicId, (mode as any) || 'full')
  })

  ipcMain.handle('ai:dispose', async () => {
    aiService.disposeModel()
  })

  // ===== Attendance Handlers =====

  ipcMain.handle('attendance:createCondition', async (_event, data: unknown, userId: string) => {
    return attendanceService.createCondition(data as attendanceService.CreateConditionData, userId)
  })

  ipcMain.handle('attendance:updateCondition', async (_event, id: string, data: unknown, userId: string) => {
    return attendanceService.updateCondition(id, data as attendanceService.UpdateConditionData, userId)
  })

  ipcMain.handle('attendance:deleteCondition', async (_event, id: string, userId: string) => {
    return attendanceService.deleteCondition(id, userId)
  })

  ipcMain.handle('attendance:getConditions', async (_event, includeDeleted?: boolean) => {
    return attendanceService.getAllConditions(includeDeleted)
  })

  ipcMain.handle('attendance:saveEntry', async (_event, data: unknown, userId: string) => {
    return attendanceService.saveEntry(data as attendanceService.SaveEntryData, userId)
  })

  ipcMain.handle('attendance:saveBulkEntries', async (_event, data: unknown, userId: string) => {
    return attendanceService.saveBulkEntries(data as attendanceService.BulkSaveEntryData, userId)
  })

  ipcMain.handle('attendance:deleteEntry', async (_event, entryId: string, userId: string) => {
    return attendanceService.deleteEntry(entryId, userId)
  })

  ipcMain.handle('attendance:getEntry', async (_event, userId: string, entryDate: string) => {
    return attendanceService.getEntry(userId, entryDate)
  })

  ipcMain.handle('attendance:getEntriesForYear', async (_event, filters: unknown) => {
    return attendanceService.getEntriesForYear(filters as attendanceService.AttendanceFilters)
  })

  ipcMain.handle('attendance:getSummary', async (_event, userId: string, year: number) => {
    return attendanceService.getSummaryForYear(userId, year)
  })

  ipcMain.handle('attendance:getAllSummaries', async (_event, year: number) => {
    return attendanceService.getAllSummariesForYear(year)
  })

  ipcMain.handle('attendance:getAvailableYears', async () => {
    return attendanceService.getAvailableYears()
  })

  ipcMain.handle('attendance:isYearEditable', async (_event, year: number) => {
    return attendanceService.isYearEditable(year)
  })

  // Shift CRUD
  ipcMain.handle('attendance:createShift', async (_event, data: unknown, userId: string) => {
    return attendanceService.createShift(data as attendanceService.CreateShiftData, userId)
  })

  ipcMain.handle('attendance:updateShift', async (_event, id: string, data: unknown, userId: string) => {
    return attendanceService.updateShift(id, data as attendanceService.UpdateShiftData, userId)
  })

  ipcMain.handle('attendance:deleteShift', async (_event, id: string, userId: string) => {
    return attendanceService.deleteShift(id, userId)
  })

  ipcMain.handle('attendance:getShifts', async (_event, includeDeleted?: boolean) => {
    return attendanceService.getAllShifts(includeDeleted)
  })

  // PDF export with save dialog
  ipcMain.handle('attendance:exportUserPdfDialog', async (_event, targetUserId: string, year: number, userId: string) => {
    const result = await attendancePdfService.exportUserPdf(targetUserId, year, userId)
    if (!result.success || !result.buffer) {
      return { success: false, error: result.error || 'Failed to generate PDF' }
    }

    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No active window' }

    const dialogResult = await dialog.showSaveDialog(win, {
      title: 'Save Attendance PDF',
      defaultPath: `attendance_${year}.pdf`,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    })

    if (dialogResult.canceled || !dialogResult.filePath) {
      return { success: false, error: 'Export canceled' }
    }

    fs.writeFileSync(dialogResult.filePath, result.buffer)
    return { success: true, filePath: dialogResult.filePath }
  })

  ipcMain.handle('attendance:exportPdfDialog', async (_event, year: number, userId: string) => {
    const result = await attendancePdfService.exportYearPdf(year, userId)
    if (!result.success || !result.buffer) {
      return { success: false, error: result.error || 'Failed to generate PDF' }
    }

    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No active window' }

    const dialogResult = await dialog.showSaveDialog(win, {
      title: 'Save Attendance PDF',
      defaultPath: `attendance_all_${year}.pdf`,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    })

    if (dialogResult.canceled || !dialogResult.filePath) {
      return { success: false, error: 'Export canceled' }
    }

    fs.writeFileSync(dialogResult.filePath, result.buffer)
    return { success: true, filePath: dialogResult.filePath }
  })

  // ===== MOM Location Handlers =====

  ipcMain.handle('momLocations:create', async (_event, data: unknown, userId: string) => {
    return momService.createLocation(data as momService.CreateMomLocationData, userId)
  })

  ipcMain.handle('momLocations:update', async (_event, id: string, data: unknown, userId: string) => {
    return momService.updateLocation(id, data as momService.UpdateMomLocationData, userId)
  })

  ipcMain.handle('momLocations:delete', async (_event, id: string, userId: string) => {
    return momService.deleteLocation(id, userId)
  })

  ipcMain.handle('momLocations:getAll', async () => {
    return momService.getAllLocations()
  })

  // ===== MOM Handlers =====

  ipcMain.handle('moms:create', async (_event, data: unknown, userId: string) => {
    return momService.createMom(data as momService.CreateMomData, userId)
  })

  ipcMain.handle('moms:getById', async (_event, id: string) => {
    return momService.getMomById(id)
  })

  ipcMain.handle('moms:getByMomId', async (_event, momId: string) => {
    return momService.getMomByMomId(momId)
  })

  ipcMain.handle('moms:getAll', async (_event, filters?: unknown) => {
    return momService.getAllMoms(filters as momService.MomFilters | undefined)
  })

  ipcMain.handle('moms:update', async (_event, id: string, data: unknown, userId: string) => {
    return momService.updateMom(id, data as momService.UpdateMomData, userId)
  })

  ipcMain.handle('moms:delete', async (_event, id: string, userId: string) => {
    return momService.deleteMom(id, userId)
  })

  ipcMain.handle('moms:close', async (_event, id: string, userId: string) => {
    return momService.closeMom(id, userId)
  })

  ipcMain.handle('moms:reopen', async (_event, id: string, userId: string) => {
    return momService.reopenMom(id, userId)
  })

  ipcMain.handle('moms:saveFile', async (_event, momId: string, fileBase64: string, filename: string, userId: string) => {
    const fileBuffer = Buffer.from(fileBase64, 'base64')
    return momService.saveMomFile(momId, fileBuffer, filename, userId)
  })

  ipcMain.handle('moms:getFilePath', async (_event, momId: string) => {
    return momService.getMomFilePath(momId)
  })

  ipcMain.handle('moms:getStats', async () => {
    return momService.getMomStats()
  })

  ipcMain.handle('moms:linkTopic', async (_event, momInternalId: string, topicId: string, userId: string) => {
    return momService.linkTopic(momInternalId, topicId, userId)
  })

  ipcMain.handle('moms:unlinkTopic', async (_event, momInternalId: string, topicId: string, userId: string) => {
    return momService.unlinkTopic(momInternalId, topicId, userId)
  })

  ipcMain.handle('moms:getLinkedTopics', async (_event, momInternalId: string) => {
    return momService.getLinkedTopics(momInternalId)
  })

  ipcMain.handle('moms:linkRecord', async (_event, momInternalId: string, recordId: string, userId: string) => {
    return momService.linkRecord(momInternalId, recordId, userId)
  })

  ipcMain.handle('moms:unlinkRecord', async (_event, momInternalId: string, recordId: string, userId: string) => {
    return momService.unlinkRecord(momInternalId, recordId, userId)
  })

  ipcMain.handle('moms:getLinkedRecords', async (_event, momInternalId: string) => {
    return momService.getLinkedRecords(momInternalId)
  })

  // MOM-Letter linking
  ipcMain.handle('moms:linkLetter', async (_event, momInternalId: string, letterInternalId: string, userId: string) => {
    return momService.linkLetter(momInternalId, letterInternalId, userId)
  })

  ipcMain.handle('moms:unlinkLetter', async (_event, momInternalId: string, letterInternalId: string, userId: string) => {
    return momService.unlinkLetter(momInternalId, letterInternalId, userId)
  })

  ipcMain.handle('moms:getLinkedLetters', async (_event, momInternalId: string) => {
    return momService.getLinkedLetters(momInternalId)
  })

  ipcMain.handle('moms:getByTopic', async (_event, topicId: string) => {
    return momService.getMomsByTopic(topicId)
  })

  ipcMain.handle('moms:getByRecord', async (_event, recordId: string) => {
    return momService.getMomsByRecord(recordId)
  })

  ipcMain.handle('moms:getHistory', async (_event, momInternalId: string) => {
    return momService.getMomHistory(momInternalId)
  })

  // ===== MOM Action Handlers =====

  ipcMain.handle('momActions:create', async (_event, data: unknown, userId: string) => {
    return momService.createAction(data as momService.CreateMomActionData, userId)
  })

  ipcMain.handle('momActions:getById', async (_event, id: string) => {
    return momService.getActionById(id)
  })

  ipcMain.handle('momActions:getByMom', async (_event, momInternalId: string) => {
    return momService.getActionsByMom(momInternalId)
  })

  ipcMain.handle('momActions:update', async (_event, id: string, data: unknown, userId: string) => {
    return momService.updateAction(id, data as momService.UpdateMomActionData, userId)
  })

  ipcMain.handle('momActions:resolve', async (_event, id: string, data: unknown, userId: string) => {
    return momService.resolveAction(id, data as momService.ResolveMomActionData, userId)
  })

  ipcMain.handle('momActions:reopen', async (_event, id: string, userId: string) => {
    return momService.reopenAction(id, userId)
  })

  ipcMain.handle('momActions:saveResolutionFile', async (_event, actionId: string, fileBase64: string, filename: string, userId: string) => {
    const fileBuffer = Buffer.from(fileBase64, 'base64')
    return momService.saveActionResolutionFile(actionId, fileBuffer, filename, userId)
  })

  ipcMain.handle('momActions:getResolutionFilePath', async (_event, actionId: string) => {
    return momService.getActionResolutionFilePath(actionId)
  })

  ipcMain.handle('momActions:getDueReminders', async () => {
    return momService.getActionsWithDueReminders()
  })

  ipcMain.handle('momActions:getWithReminders', async () => {
    return momService.getActionsWithReminders()
  })

  ipcMain.handle('momActions:getWithDeadlines', async () => {
    return momService.getActionsWithDeadlines()
  })

  ipcMain.handle('momActions:markReminderNotified', async (_event, id: string) => {
    return momService.markActionReminderNotified(id)
  })

  // ===== MOM Draft Handlers =====

  ipcMain.handle('momDrafts:create', async (_event, data: unknown, userId: string) => {
    return momService.createDraft(data as momService.CreateMomDraftData, userId)
  })

  ipcMain.handle('momDrafts:getById', async (_event, id: string) => {
    return momService.getDraftById(id)
  })

  ipcMain.handle('momDrafts:getByMom', async (_event, momInternalId: string) => {
    return momService.getDraftsByMom(momInternalId)
  })

  ipcMain.handle('momDrafts:getLatest', async (_event, momInternalId: string) => {
    return momService.getLatestDraft(momInternalId)
  })

  ipcMain.handle('momDrafts:saveFile', async (_event, draftId: string, fileBase64: string, filename: string, userId: string) => {
    const fileBuffer = Buffer.from(fileBase64, 'base64')
    return momService.saveDraftFile(draftId, fileBuffer, filename, userId)
  })

  ipcMain.handle('momDrafts:getFilePath', async (_event, draftId: string) => {
    return momService.getDraftFilePath(draftId)
  })

  ipcMain.handle('momDrafts:delete', async (_event, id: string, userId: string) => {
    return momService.deleteDraft(id, userId)
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
