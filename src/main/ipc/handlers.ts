import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as authService from '../services/auth.service'
import * as topicService from '../services/topic.service'
import * as recordService from '../services/record.service'
import * as subcategoryService from '../services/subcategory.service'
import * as emailService from '../services/email.service'
import * as outlookService from '../services/outlook.service'
import * as reminderService from '../services/reminder.service'
import * as handoverService from '../services/handover.service'
import * as authorityService from '../services/authority.service'
import * as contactService from '../services/contact.service'
import * as letterService from '../services/letter.service'
import * as letterDraftService from '../services/letter-draft.service'
import * as letterReferenceService from '../services/letter-reference.service'
import * as letterAttachmentService from '../services/letter-attachment.service'
import * as issueService from '../services/issue.service'
import * as credentialService from '../services/credential.service'
import * as secureReferenceService from '../services/secure-reference.service'
import * as secureResourcesCrypto from '../services/secure-resources-crypto'
import * as auditService from '../database/audit'
import { runBackgroundIntegrityCheck, getIntegrityStatus, verifyAuditRange, getLatestAuditId } from '../database/audit'
import * as settingsService from '../services/settings.service'
import * as attendanceService from '../services/attendance.service'
import * as attendancePdfService from '../services/attendance-pdf.service'
import * as momService from '../services/mom.service'
import * as backupService from '../services/backup.service'
import * as seedService from '../services/seed.service'
import * as recordAttachmentService from '../services/record-attachment.service'
import * as loggerService from '../services/logger.service'
import * as searchService from '../services/search.service'
import * as scheduledEmailService from '../services/scheduled-email.service'
import * as categoryService from '../services/category.service'
import * as dashboardService from '../services/dashboard.service'
import * as calendarService from '../services/calendar.service'
import * as tagService from '../services/tag.service'
import * as exportService from '../services/export.service'
import * as historyService from '../services/history.service'
import * as pinService from '../services/pin.service'
import * as twofaService from '../services/twofa.service'
import * as healthService from '../services/health.service'
import * as integrityService from '../services/integrity.service'
import * as filterPresetService from '../services/filter-preset.service'
import * as syncService from '../services/sync.service'
import * as notificationService from '../services/notification.service'
import * as documentVersionService from '../services/document-version.service'
import * as ocrService from '../services/ocr.service'
import * as signatureService from '../services/signature.service'
import * as viewService from '../services/view.service'
import * as customFieldService from '../services/custom-field.service'
import * as importService from '../services/import.service'
import * as mentionService from '../services/mention.service'
import { refreshDatabase, isRestoreInProgress } from '../database/connection'

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

  ipcMain.handle('auth:getUserById', async (_event, id: string) => {
    return authService.getUserById(id)
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

  ipcMain.handle('auth:deleteUser', async (_event, userId: string, adminId: string) => {
    return authService.deleteUser(userId, adminId)
  })

  ipcMain.handle('auth:checkUsername', async (_event, username: string) => {
    return authService.checkUsernameExists(username)
  })

  // Session management handlers
  ipcMain.handle('auth:updateSessionActivity', async (_event, token: string) => {
    return authService.updateSessionActivity(token)
  })

  ipcMain.handle('auth:extendSession', async (_event, token: string) => {
    return authService.extendSession(token)
  })

  ipcMain.handle('auth:getSessionInfo', async (_event, token: string) => {
    return authService.getSessionInfo(token)
  })

  ipcMain.handle('auth:getSessionTimeout', async () => {
    return authService.getSessionTimeout()
  })

  ipcMain.handle('auth:setSessionTimeout', async (_event, minutes: number) => {
    return authService.setSessionTimeout(minutes)
  })

  ipcMain.handle('auth:resetUserLockout', async (_event, username: string, adminId: string) => {
    return authService.resetUserLockout(username, adminId)
  })

  ipcMain.handle('auth:getUserLockoutStatus', async (_event, username: string) => {
    return authService.getUserLockoutStatus(username)
  })

  // ===== Two-Factor Authentication Handlers =====
  ipcMain.handle('twofa:isEnabled', async (_event, userId: string) => {
    return twofaService.isTwoFAEnabled(userId)
  })

  ipcMain.handle('twofa:setEnabled', async (_event, userId: string, enabled: boolean, adminId: string) => {
    return twofaService.setTwoFAEnabled(userId, enabled, adminId)
  })

  ipcMain.handle('twofa:generateSessionToken', async () => {
    return twofaService.generateTwoFASessionToken()
  })

  ipcMain.handle('twofa:initiate', async (_event, userId: string, sessionToken: string) => {
    return twofaService.initiateTwoFA(userId, sessionToken)
  })

  ipcMain.handle('twofa:verify', async (_event, sessionToken: string, code: string) => {
    return twofaService.verifyTwoFACode(sessionToken, code)
  })

  ipcMain.handle('twofa:cancel', async (_event, sessionToken: string) => {
    return twofaService.cancelTwoFA(sessionToken)
  })

  ipcMain.handle('twofa:getRemainingTime', async (_event, sessionToken: string) => {
    return twofaService.getTwoFARemainingTime(sessionToken)
  })

  // ===== Global Search Handler =====
  ipcMain.handle('search:global', async (_event, query: string, limit?: number) => {
    return searchService.globalSearch(query, limit)
  })

  // ===== Topic Handlers =====

  ipcMain.handle('topics:create', async (_event, data: unknown, userId: string) => {
    return topicService.createTopic(data as topicService.CreateTopicData, userId)
  })

  ipcMain.handle('topics:getAll', async (_event, filters?: unknown) => {
    return topicService.getAllTopics(filters as topicService.TopicFilters | undefined)
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

  // Record link handlers (multiple MOMs/Letters)
  ipcMain.handle('records:linkMom', async (_event, recordId: string, momId: string, userId: string) => {
    return recordService.linkMomToRecord(recordId, momId, userId)
  })

  ipcMain.handle('records:unlinkMom', async (_event, recordId: string, momId: string, userId: string) => {
    return recordService.unlinkMomFromRecord(recordId, momId, userId)
  })

  ipcMain.handle('records:linkLetter', async (_event, recordId: string, letterId: string, userId: string) => {
    return recordService.linkLetterToRecord(recordId, letterId, userId)
  })

  ipcMain.handle('records:unlinkLetter', async (_event, recordId: string, letterId: string, userId: string) => {
    return recordService.unlinkLetterFromRecord(recordId, letterId, userId)
  })

  ipcMain.handle('records:getLinkedMoms', async (_event, recordId: string) => {
    return recordService.getRecordLinkedMoms(recordId)
  })

  ipcMain.handle('records:getLinkedLetters', async (_event, recordId: string) => {
    return recordService.getRecordLinkedLetters(recordId)
  })

  // ===== Record Attachment Handlers =====

  ipcMain.handle('recordAttachments:getByRecord', async (_event, recordId: string) => {
    return recordAttachmentService.getAttachmentsByRecordId(recordId)
  })

  ipcMain.handle('recordAttachments:add', async (_event, data: { recordId: string; filename: string; buffer: string; topicTitle: string }, userId: string) => {
    const fileBuffer = Buffer.from(data.buffer, 'base64')
    return recordAttachmentService.addAttachment({
      recordId: data.recordId,
      filename: data.filename,
      buffer: fileBuffer,
      topicTitle: data.topicTitle
    }, userId)
  })

  ipcMain.handle('recordAttachments:delete', async (_event, attachmentId: string, userId: string) => {
    return recordAttachmentService.deleteAttachment(attachmentId, userId)
  })

  ipcMain.handle('recordAttachments:open', async (_event, attachmentId: string) => {
    const fullPath = recordAttachmentService.getAttachmentFullPath(attachmentId)
    if (!fullPath) {
      return { success: false, error: 'Attachment not found' }
    }
    try {
      await shell.openPath(fullPath)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('recordAttachments:getFilePath', async (_event, attachmentId: string) => {
    return recordAttachmentService.getAttachmentFullPath(attachmentId)
  })

  ipcMain.handle('recordAttachments:showInFolder', async (_event, attachmentId: string) => {
    const fullPath = recordAttachmentService.getAttachmentFullPath(attachmentId)
    if (!fullPath) {
      return { success: false, error: 'Attachment not found' }
    }
    try {
      shell.showItemInFolder(fullPath)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
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

  ipcMain.handle('emails:getArchiveInfo', async (_event, outlookEntryId: string) => {
    return emailService.getEmailArchiveInfo(outlookEntryId)
  })

  ipcMain.handle('emails:showInFolder', async (_event, emailId: string) => {
    const email = emailService.getEmailById(emailId)
    if (!email) {
      return { success: false, error: 'Email not found' }
    }
    try {
      // getEmailStoragePath returns the email's folder directly
      const emailFolder = emailService.getEmailStoragePath(email)
      await shell.openPath(emailFolder)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
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

  ipcMain.handle('outlook:clearCache', async () => {
    outlookService.clearCache()
    return { success: true }
  })

  ipcMain.handle('outlook:getMailboxes', async () => {
    try {
      return await outlookService.getMailboxes()
    } catch (error: any) {
      console.error('Error getting mailboxes:', error)
      throw error
    }
  })

  ipcMain.handle('outlook:getFolders', async (_event, storeId: string) => {
    console.log('=== outlook:getFolders called ===')
    console.log('storeId:', storeId)
    try {
      const folders = await outlookService.getFolders(storeId)
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
      const emails = await outlookService.getEmails(folderId, storeId, limit)
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
      const email = await outlookService.getEmailDetails(entryId, storeId)
      console.log('Email details loaded:', email?.subject)
      return email
    } catch (error: any) {
      console.error('Error getting email details:', error)
      throw error
    }
  })

  ipcMain.handle('outlook:composeAttendanceEmail', async (_event, date: string, attachmentPath: string, toEmails: string, ccEmails?: string, subjectTemplate?: string, bodyTemplate?: string) => {
    console.log('=== outlook:composeAttendanceEmail called ===')
    console.log('date:', date, 'attachmentPath:', attachmentPath)
    return outlookService.composeAttendanceReportEmail(date, attachmentPath, toEmails, ccEmails, subjectTemplate, bodyTemplate)
  })

  // ===== Reminder Handlers =====

  ipcMain.handle('reminders:create', async (_event, data: unknown, userId: string) => {
    return reminderService.createReminder(data as reminderService.CreateReminderData, userId)
  })

  ipcMain.handle('reminders:getAll', async () => {
    // Return empty during restore to avoid database access
    if (isRestoreInProgress()) return []
    return reminderService.getAllReminders()
  })

  ipcMain.handle('reminders:getUpcoming', async (_event, days?: number) => {
    if (isRestoreInProgress()) return []
    return reminderService.getUpcomingReminders(days)
  })

  ipcMain.handle('reminders:getOverdue', async () => {
    if (isRestoreInProgress()) return []
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
    if (isRestoreInProgress()) return { entries: [], totalCount: 0, page: 1, pageSize: 50 }
    return auditService.getAuditLog(options as Parameters<typeof auditService.getAuditLog>[0])
  })

  ipcMain.handle('audit:verifyIntegrity', async () => {
    if (isRestoreInProgress()) return { valid: false, totalEntries: 0, checkedEntries: 0, invalidEntries: [], stats: {} }
    return auditService.verifyAuditIntegrity()
  })

  ipcMain.handle('audit:getStats', async () => {
    if (isRestoreInProgress()) return {}
    return auditService.getAuditStats()
  })

  ipcMain.handle('audit:runBackgroundIntegrityCheck', async () => {
    if (isRestoreInProgress()) return
    return runBackgroundIntegrityCheck()
  })

  ipcMain.handle('audit:getIntegrityStatus', async () => {
    // Returns cached status, no database access
    return getIntegrityStatus()
  })

  ipcMain.handle('audit:verifyRange', async (_event, startId: number, endId: number) => {
    if (isRestoreInProgress()) return { valid: false, entries: [] }
    return verifyAuditRange(startId, endId)
  })

  ipcMain.handle('audit:getLatestId', async () => {
    if (isRestoreInProgress()) return 0
    return getLatestAuditId()
  })

  // ===== Handover Handlers =====

  ipcMain.handle('handover:getWeekInfo', async () => {
    return handoverService.getWeekInfo()
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

  ipcMain.handle('authorities:getInternal', async () => {
    return authorityService.getInternalAuthorities()
  })

  ipcMain.handle('authorities:getExternal', async () => {
    return authorityService.getExternalAuthorities()
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

  // ===== Contact Handlers =====

  ipcMain.handle('contacts:create', async (_event, data: unknown, userId: string) => {
    return contactService.createContact(data as contactService.CreateContactData, userId)
  })

  ipcMain.handle('contacts:getAll', async () => {
    return contactService.getAllContacts()
  })

  ipcMain.handle('contacts:getById', async (_event, id: string) => {
    return contactService.getContactById(id)
  })

  ipcMain.handle('contacts:getByAuthority', async (_event, authorityId: string) => {
    return contactService.getContactsByAuthority(authorityId)
  })

  ipcMain.handle('contacts:search', async (_event, query: string) => {
    return contactService.searchContacts(query)
  })

  ipcMain.handle('contacts:update', async (_event, id: string, data: unknown, userId: string) => {
    return contactService.updateContact(id, data as contactService.UpdateContactData, userId)
  })

  ipcMain.handle('contacts:delete', async (_event, id: string, userId: string) => {
    return contactService.deleteContact(id, userId)
  })

  // ===== Letter Handlers =====

  ipcMain.handle('letters:create', async (_event, data: unknown, userId: string) => {
    const letterData = data as letterService.CreateLetterData & { tags?: string[] }
    const result = letterService.createLetter(letterData, userId)
    // Save tags if provided
    if (result.success && result.letter && letterData.tags && letterData.tags.length > 0) {
      tagService.setLetterTags(result.letter.id, letterData.tags, userId)
    }
    return result
  })

  ipcMain.handle('letters:getAll', async (_event, filters?: unknown) => {
    return letterService.getAllLetters(filters as letterService.LetterFilters | undefined)
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
    const letterData = data as letterService.UpdateLetterData & { tags?: string[] }
    const result = letterService.updateLetter(id, letterData, userId)
    // Save tags if provided
    if (result.success && letterData.tags !== undefined) {
      tagService.setLetterTags(id, letterData.tags, userId)
    }
    return result
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

  ipcMain.handle('letterDrafts:showInFolder', async (_event, draftId: string) => {
    const filePath = letterDraftService.getDraftFilePath(draftId)
    if (!filePath) {
      return { success: false, error: 'Draft file not found' }
    }
    try {
      shell.showItemInFolder(filePath)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
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

  ipcMain.handle('letterAttachments:showInFolder', async (_event, id: string) => {
    const filePath = letterAttachmentService.getAttachmentFilePath(id)
    if (!filePath) {
      return { success: false, error: 'Attachment not found' }
    }
    try {
      shell.showItemInFolder(filePath)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('letterAttachments:getDataDirectory', async () => {
    return letterAttachmentService.getDataDirectoryPath()
  })

  // ===== Issue Handlers =====

  ipcMain.handle('issues:create', async (_event, data: unknown, userId: string) => {
    const issueData = data as issueService.CreateIssueData & { tag_ids?: string[] }
    const result = issueService.createIssue(issueData, userId)
    // Save tags if provided
    if (result.success && result.issue && issueData.tag_ids && issueData.tag_ids.length > 0) {
      tagService.setIssueTags(result.issue.id, issueData.tag_ids, userId)
    }
    return result
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
    const issueData = data as issueService.UpdateIssueData & { tag_ids?: string[] }
    const result = issueService.updateIssue(id, issueData, userId)
    // Save tags if provided
    if (result.success && issueData.tag_ids !== undefined) {
      tagService.setIssueTags(id, issueData.tag_ids, userId)
    }
    return result
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

  ipcMain.handle('issues:getOpenSummary', async () => {
    return issueService.getOpenIssuesSummary()
  })

  ipcMain.handle('issues:getStats', async () => {
    return issueService.getIssueStats()
  })

  ipcMain.handle('issues:getDueReminders', async () => {
    return issueService.getIssuesWithDueReminders()
  })

  ipcMain.handle('issues:getWithReminders', async (_event, days?: number) => {
    // Return empty during restore to avoid database access
    if (isRestoreInProgress()) return []
    return issueService.getIssuesWithReminders(days)
  })

  ipcMain.handle('issues:markReminderNotified', async (_event, id: string) => {
    return issueService.markReminderNotified(id)
  })

  // ===== Credential Handlers =====

  ipcMain.handle('credentials:create', async (_event, data: unknown, userId: string) => {
    return credentialService.createCredential(data as credentialService.CreateCredentialData, userId)
  })

  ipcMain.handle('credentials:getAll', async (_event, filters?: { query?: string; category?: string; isAdmin?: boolean }) => {
    return credentialService.getAllCredentials(filters)
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

  ipcMain.handle('secureReferences:getAll', async (_event, filters?: { query?: string; category?: string; isAdmin?: boolean }) => {
    return secureReferenceService.getAllReferences(filters)
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

  ipcMain.handle('secureReferences:getStats', async (_event, isAdmin?: boolean) => {
    return credentialService.getSecureResourceStats(isAdmin ?? true)
  })

  // ===== Keyfile Handlers =====

  ipcMain.handle('keyfile:exists', async () => {
    return secureResourcesCrypto.keyfileExists()
  })

  ipcMain.handle('keyfile:export', async () => {
    const { dialog } = await import('electron')
    const result = await dialog.showSaveDialog({
      title: 'Export Encryption Keyfile',
      defaultPath: 'keyfile_backup.key',
      filters: [{ name: 'Keyfile', extensions: ['key'] }]
    })

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Export cancelled' }
    }

    return secureResourcesCrypto.exportKeyfile(result.filePath)
  })

  ipcMain.handle('keyfile:import', async () => {
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog({
      title: 'Import Encryption Keyfile',
      filters: [{ name: 'Keyfile', extensions: ['key'] }],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'Import cancelled' }
    }

    return secureResourcesCrypto.importKeyfile(result.filePaths[0])
  })

  // ===== Resource Category Handlers =====

  ipcMain.handle('categories:getAll', async () => {
    return categoryService.getAllCategories()
  })

  ipcMain.handle('categories:getByType', async (_event, type: 'credential' | 'reference') => {
    return categoryService.getCategories(type)
  })

  ipcMain.handle('categories:getById', async (_event, id: string) => {
    return categoryService.getCategoryById(id)
  })

  ipcMain.handle('categories:create', async (_event, data: categoryService.CreateCategoryData, userId: string) => {
    return categoryService.createCategory(data, userId)
  })

  ipcMain.handle('categories:update', async (_event, id: string, data: categoryService.UpdateCategoryData, userId: string) => {
    return categoryService.updateCategory(id, data, userId)
  })

  ipcMain.handle('categories:delete', async (_event, id: string, reassignTo: string, userId: string) => {
    return categoryService.deleteCategory(id, reassignTo, userId)
  })

  ipcMain.handle('categories:reorder', async (_event, ids: string[], userId: string) => {
    return categoryService.reorderCategories(ids, userId)
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

  ipcMain.handle('attendance:deleteBulkEntries', async (_event, shiftId: string, entryDate: string, userId: string) => {
    return attendanceService.deleteBulkEntries(shiftId, entryDate, userId)
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

    // Create filename with user name (sanitize for filesystem)
    const sanitizedName = (result.userDisplayName || 'user')
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
    const defaultFileName = `Attendance_${sanitizedName}_${year}.pdf`

    const dialogResult = await dialog.showSaveDialog(win, {
      title: 'Save Attendance PDF',
      defaultPath: defaultFileName,
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

  // Department Report PDF export - saves directly to archive folder
  ipcMain.handle('attendance:exportDepartmentReportDialog', async (_event, date: string, userId: string) => {
    const result = await attendancePdfService.exportDepartmentReportPdf(date, userId)
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to generate PDF' }
    }

    // Get the archive path where it was saved
    const filePath = attendancePdfService.getDepartmentReportPath(date)
    return { success: true, filePath }
  })

  // Department Report Archive handlers
  ipcMain.handle('attendance:getDepartmentReportInfo', (_event, date: string) => {
    return attendancePdfService.getDepartmentReportInfo(date)
  })

  ipcMain.handle('attendance:openDepartmentReport', (_event, date: string) => {
    return attendancePdfService.openDepartmentReport(date)
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
    const momData = data as momService.CreateMomData & { tag_ids?: string[] }
    const result = momService.createMom(momData, userId)
    // Save tags if provided
    if (result.success && result.mom && momData.tag_ids && momData.tag_ids.length > 0) {
      tagService.setMomTags(result.mom.id, momData.tag_ids, userId)
    }
    return result
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
    const momData = data as momService.UpdateMomData & { tag_ids?: string[] }
    const result = momService.updateMom(id, momData, userId)
    // Save tags if provided
    if (result.success && momData.tag_ids !== undefined) {
      tagService.setMomTags(id, momData.tag_ids, userId)
    }
    return result
  })

  ipcMain.handle('moms:delete', async (_event, id: string, userId: string) => {
    return momService.deleteMom(id, userId)
  })

  ipcMain.handle('moms:deleteAll', async (_event, userId: string) => {
    return momService.deleteAllMoms(userId)
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

  ipcMain.handle('moms:showInFolder', async (_event, momId: string) => {
    const filePath = momService.getMomFilePath(momId)
    if (!filePath) {
      return { success: false, error: 'MOM file not found' }
    }
    try {
      shell.showItemInFolder(filePath)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
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
    // Return empty during restore to avoid database access
    if (isRestoreInProgress()) return []
    return momService.getActionsWithReminders()
  })

  ipcMain.handle('momActions:getWithDeadlines', async () => {
    // Return empty during restore to avoid database access
    if (isRestoreInProgress()) return []
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

  ipcMain.handle('momDrafts:showInFolder', async (_event, draftId: string) => {
    const filePath = momService.getDraftFilePath(draftId)
    if (!filePath) {
      return { success: false, error: 'Draft file not found' }
    }
    try {
      shell.showItemInFolder(filePath)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
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

  // ===== Backup Handlers =====

  ipcMain.handle('backup:create', async (_event, userId: string, username: string, displayName: string, includeEmails: boolean) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No active window' }

    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`
    const defaultName = `Backup_${dateStr}_${username}.zip`

    const dialogResult = await dialog.showSaveDialog(win, {
      title: 'Save Backup',
      defaultPath: defaultName,
      filters: [{ name: 'ZIP Archives', extensions: ['zip'] }]
    })

    if (dialogResult.canceled || !dialogResult.filePath) {
      return { success: false, error: 'Backup canceled' }
    }

    return backupService.createBackup(userId, username, displayName, dialogResult.filePath, includeEmails)
  })

  ipcMain.handle('backup:getEmailsSize', async () => {
    return backupService.getEmailsFolderSize()
  })

  ipcMain.handle('backup:selectFile', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No active window' }

    const dialogResult = await dialog.showOpenDialog(win, {
      title: 'Select Backup File',
      filters: [{ name: 'ZIP Archives', extensions: ['zip'] }],
      properties: ['openFile']
    })

    if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
      return { success: false, error: 'Selection canceled' }
    }

    return { success: true, filePath: dialogResult.filePaths[0] }
  })

  ipcMain.handle('backup:analyze', async (_event, zipPath: string) => {
    console.log('[IPC backup:analyze] Called with path:', zipPath)
    try {
      // Check file exists
      if (!fs.existsSync(zipPath)) {
        return { success: false, error: `[DEBUG] File not found: ${zipPath}` }
      }
      const stat = fs.statSync(zipPath)
      console.log('[IPC backup:analyze] File size:', stat.size, 'bytes')

      const result = await backupService.analyzeBackup(zipPath)
      console.log('[IPC backup:analyze] Result:', JSON.stringify(result).substring(0, 500))
      return result
    } catch (err: any) {
      console.error('[IPC backup:analyze] Error:', err)
      return { success: false, error: `[DEBUG CATCH] ${err.message || err}` }
    }
  })

  ipcMain.handle('backup:compare', async (_event, backupInfo: unknown, userId: string, username: string, displayName: string) => {
    return backupService.compareBackup(backupInfo as backupService.BackupInfo, userId, username, displayName)
  })

  ipcMain.handle('backup:restore', async (_event, zipPath: string, userId: string, username: string, displayName: string) => {
    return backupService.restoreBackup(zipPath, userId, username, displayName)
  })

  ipcMain.handle('backup:getStatus', async () => {
    return backupService.getBackupStatus()
  })

  ipcMain.handle('backup:checkReminder', async (_event, reminderDays: number) => {
    return backupService.checkBackupReminder(reminderDays)
  })

  // ===== Database Handlers =====

  ipcMain.handle('database:refresh', async () => {
    console.log('[IPC] database:refresh called from renderer at', new Date().toISOString())
    console.log('[IPC] database:refresh call stack:', new Error().stack)
    try {
      refreshDatabase()
      return { success: true }
    } catch (err: any) {
      console.error('Database refresh failed:', err)
      return { success: false, error: err.message }
    }
  })

  // ===== Seed Handlers =====

  ipcMain.handle('seed:run', async (_event, userId: string, options?: seedService.SeedOptions) => {
    return seedService.seedDatabase(userId, options)
  })

  ipcMain.handle('seed:clear', async (_event, userId: string) => {
    return seedService.clearAllData(userId)
  })

  // ===== Logger Handlers =====

  ipcMain.handle('logger:getLogs', async (_event, filter?: { level?: string; limit?: number }) => {
    return loggerService.getLogs(filter as any)
  })

  ipcMain.handle('logger:clearLogs', async () => {
    loggerService.clearLogs()
    return { success: true }
  })

  ipcMain.handle('logger:getStats', async () => {
    return loggerService.getLogStats()
  })

  // One-way log from renderer (for persistent logging across page reloads)
  ipcMain.on('logger:log', (_event, level: string, message: string) => {
    const validLevels = ['log', 'info', 'warn', 'error'] as const
    const logLevel = validLevels.includes(level as any) ? (level as any) : 'log'
    loggerService.addLog(logLevel, [message])
  })

  // ===== Dialog Handlers =====

  ipcMain.handle('dialog:showMessage', async (_event, options: {
    type?: 'none' | 'info' | 'error' | 'question' | 'warning'
    title?: string
    message: string
    detail?: string
    buttons?: string[]
  }) => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showMessageBox(win || undefined as any, {
      type: options.type || 'info',
      title: options.title || 'Message',
      message: options.message,
      detail: options.detail,
      buttons: options.buttons || ['OK']
    })
    return { response: result.response }
  })

  // ===== Scheduled Email Handlers =====

  ipcMain.handle('scheduledEmails:create', async (_event, data: unknown, userId: string) => {
    return scheduledEmailService.createSchedule(data as scheduledEmailService.CreateEmailScheduleInput, userId)
  })

  ipcMain.handle('scheduledEmails:getAll', async (_event, includeInactive?: boolean) => {
    return scheduledEmailService.getAllSchedules(includeInactive)
  })

  ipcMain.handle('scheduledEmails:getById', async (_event, id: string) => {
    return scheduledEmailService.getScheduleById(id)
  })

  ipcMain.handle('scheduledEmails:update', async (_event, id: string, data: unknown, userId: string) => {
    return scheduledEmailService.updateSchedule(id, data as scheduledEmailService.UpdateEmailScheduleInput, userId)
  })

  ipcMain.handle('scheduledEmails:delete', async (_event, id: string, userId: string) => {
    return scheduledEmailService.deleteSchedule(id, userId)
  })

  ipcMain.handle('scheduledEmails:getInstances', async (_event, startDate?: string, endDate?: string, status?: string) => {
    return scheduledEmailService.getInstances(startDate, endDate, status)
  })

  ipcMain.handle('scheduledEmails:getTodayInstances', async () => {
    return scheduledEmailService.getTodayInstances()
  })

  ipcMain.handle('scheduledEmails:getPendingCounts', async () => {
    // Return empty counts during restore to avoid database access
    if (isRestoreInProgress()) return { today: 0, overdue: 0 }
    return scheduledEmailService.getPendingCounts()
  })

  ipcMain.handle('scheduledEmails:generateInstances', async (_event, date: string) => {
    // Return empty during restore to avoid database access
    if (isRestoreInProgress()) return { success: true, generated: 0 }
    const dateObj = new Date(date)
    return scheduledEmailService.generateInstancesForDate(dateObj)
  })

  ipcMain.handle('scheduledEmails:markSent', async (_event, instanceId: string, userId: string) => {
    return scheduledEmailService.markInstanceSent(instanceId, userId)
  })

  ipcMain.handle('scheduledEmails:dismiss', async (_event, instanceId: string, userId: string, notes?: string) => {
    return scheduledEmailService.dismissInstance(instanceId, userId, notes)
  })

  ipcMain.handle('scheduledEmails:reset', async (_event, instanceId: string, userId: string) => {
    return scheduledEmailService.resetInstance(instanceId, userId)
  })

  ipcMain.handle('scheduledEmails:getInstanceById', async (_event, instanceId: string) => {
    return scheduledEmailService.getInstanceById(instanceId)
  })

  ipcMain.handle('scheduledEmails:composeEmail', async (_event, instanceId: string, userId: string) => {
    return scheduledEmailService.composeEmailForInstance(instanceId, userId)
  })

  ipcMain.handle('scheduledEmails:getHistory', async (_event, scheduleId: string) => {
    return scheduledEmailService.getScheduleHistory(scheduleId)
  })

  ipcMain.handle('scheduledEmails:previewPlaceholders', async (_event, text: string, date: string, language: 'en' | 'ar', userId: string) => {
    return scheduledEmailService.previewPlaceholders(text, date, language, userId)
  })

  // ===== Dashboard Handlers =====

  ipcMain.handle('dashboard:getStats', async () => {
    return dashboardService.getDashboardStats()
  })

  ipcMain.handle('dashboard:getDiskSpace', async () => {
    return dashboardService.getDiskSpaceInfo()
  })

  ipcMain.handle('dashboard:getRecentActivity', async (_event, limit?: number) => {
    return dashboardService.getRecentActivity(limit)
  })

  ipcMain.handle('dashboard:getActivityByMonth', async (_event, year: number) => {
    return dashboardService.getActivityByMonth(year)
  })

  ipcMain.handle('dashboard:getTopTopics', async (_event, limit?: number) => {
    return dashboardService.getTopTopics(limit)
  })

  // ===== Calendar Handlers =====

  ipcMain.handle('calendar:getEvents', async (_event, year: number, month: number) => {
    return calendarService.getCalendarEvents(year, month)
  })

  ipcMain.handle('calendar:getEventsForDate', async (_event, date: string) => {
    return calendarService.getEventsForDate(date)
  })

  ipcMain.handle('calendar:getUpcoming', async (_event, days?: number) => {
    return calendarService.getUpcomingEvents(days)
  })

  // ===== Tag Handlers =====

  ipcMain.handle('tags:create', async (_event, data: unknown, userId: string) => {
    return tagService.createTag(data as tagService.CreateTagData, userId)
  })

  ipcMain.handle('tags:getAll', async () => {
    return tagService.getAllTags()
  })

  ipcMain.handle('tags:getById', async (_event, id: string) => {
    return tagService.getTagById(id)
  })

  ipcMain.handle('tags:update', async (_event, id: string, data: unknown, userId: string) => {
    return tagService.updateTag(id, data as tagService.UpdateTagData, userId)
  })

  ipcMain.handle('tags:delete', async (_event, id: string, userId: string) => {
    return tagService.deleteTag(id, userId)
  })

  // Record tags
  ipcMain.handle('tags:getRecordTags', async (_event, recordId: string) => {
    return tagService.getRecordTags(recordId)
  })

  ipcMain.handle('tags:setRecordTags', async (_event, recordId: string, tagIds: string[], userId: string) => {
    return tagService.setRecordTags(recordId, tagIds, userId)
  })

  // Issue tags
  ipcMain.handle('tags:getIssueTags', async (_event, issueId: string) => {
    return tagService.getIssueTags(issueId)
  })

  ipcMain.handle('tags:setIssueTags', async (_event, issueId: string, tagIds: string[], userId: string) => {
    return tagService.setIssueTags(issueId, tagIds, userId)
  })

  // Letter tags
  ipcMain.handle('tags:getLetterTags', async (_event, letterId: string) => {
    return tagService.getLetterTags(letterId)
  })

  ipcMain.handle('tags:setLetterTags', async (_event, letterId: string, tagIds: string[], userId: string) => {
    return tagService.setLetterTags(letterId, tagIds, userId)
  })

  // MOM tags
  ipcMain.handle('tags:getMomTags', async (_event, momId: string) => {
    return tagService.getMomTags(momId)
  })

  ipcMain.handle('tags:setMomTags', async (_event, momId: string, tagIds: string[], userId: string) => {
    return tagService.setMomTags(momId, tagIds, userId)
  })

  // Search by tag
  ipcMain.handle('tags:getRecordsByTag', async (_event, tagId: string) => {
    return tagService.getRecordsByTag(tagId)
  })

  ipcMain.handle('tags:getIssuesByTag', async (_event, tagId: string) => {
    return tagService.getIssuesByTag(tagId)
  })

  ipcMain.handle('tags:getLettersByTag', async (_event, tagId: string) => {
    return tagService.getLettersByTag(tagId)
  })

  ipcMain.handle('tags:getMomsByTag', async (_event, tagId: string) => {
    return tagService.getMomsByTag(tagId)
  })

  // ===== Advanced Search Handlers =====

  ipcMain.handle('search:advanced', async (_event, filters: unknown, userId?: string) => {
    return searchService.advancedSearch(filters as searchService.AdvancedSearchFilters, userId)
  })

  ipcMain.handle('search:suggestions', async (_event, partialQuery: string, userId: string, limit?: number) => {
    return searchService.getSearchSuggestions(partialQuery, userId, limit)
  })

  ipcMain.handle('search:history', async (_event, userId: string, limit?: number) => {
    return searchService.getSearchHistory(userId, limit)
  })

  ipcMain.handle('search:clearHistory', async (_event, userId: string) => {
    searchService.clearSearchHistory(userId)
    return { success: true }
  })

  ipcMain.handle('search:deleteHistoryEntry', async (_event, id: string, userId: string) => {
    return searchService.deleteSearchHistoryEntry(id, userId)
  })

  ipcMain.handle('search:rebuildFtsIndexes', async () => {
    return searchService.rebuildFtsIndexes()
  })

  ipcMain.handle('search:getFtsStats', async () => {
    return searchService.getFtsStats()
  })

  ipcMain.handle('search:highlight', async (_event, text: string, searchTerms: string[], maxLength?: number) => {
    return searchService.highlightMatches(text, searchTerms, maxLength)
  })

  ipcMain.handle('search:createSaved', async (_event, userId: string, name: string, filters: unknown) => {
    return searchService.createSavedSearch(userId, name, filters as searchService.AdvancedSearchFilters)
  })

  ipcMain.handle('search:getSaved', async (_event, userId: string) => {
    return searchService.getSavedSearches(userId)
  })

  ipcMain.handle('search:getSavedById', async (_event, id: string) => {
    return searchService.getSavedSearchById(id)
  })

  ipcMain.handle('search:updateSaved', async (_event, id: string, name: string, filters: unknown) => {
    return searchService.updateSavedSearch(id, name, filters as searchService.AdvancedSearchFilters)
  })

  ipcMain.handle('search:deleteSaved', async (_event, id: string) => {
    return searchService.deleteSavedSearch(id)
  })

  // ===== Export Handlers =====

  ipcMain.handle('export:topics', async () => {
    return exportService.exportTopics()
  })

  ipcMain.handle('export:letters', async () => {
    return exportService.exportLetters()
  })

  ipcMain.handle('export:moms', async () => {
    return exportService.exportMOMs()
  })

  ipcMain.handle('export:issues', async () => {
    return exportService.exportIssues()
  })

  ipcMain.handle('export:attendance', async (_event, year: number, month?: number) => {
    return exportService.exportAttendance(year, month)
  })

  ipcMain.handle('export:searchResults', async (_event, results: any[]) => {
    return exportService.exportSearchResults(results)
  })

  ipcMain.handle('export:recordsByTopic', async (_event, topicId: string) => {
    return exportService.exportRecordsByTopic(topicId)
  })

  ipcMain.handle('export:customData', async (_event, data: any[], sheetName: string, filename: string) => {
    return exportService.exportCustomData(data, sheetName, filename)
  })

  // ===== Filter Preset Handlers =====

  ipcMain.handle('filterPresets:create', async (
    _event,
    userId: string,
    entityType: filterPresetService.EntityType,
    name: string,
    filters: Record<string, unknown>,
    isDefault?: boolean,
    isShared?: boolean
  ) => {
    return filterPresetService.createFilterPreset({
      userId,
      entityType,
      name,
      filters,
      isDefault,
      isShared
    })
  })

  ipcMain.handle('filterPresets:getAll', async (
    _event,
    userId: string,
    entityType: filterPresetService.EntityType
  ) => {
    return filterPresetService.getFilterPresets(userId, entityType)
  })

  ipcMain.handle('filterPresets:getById', async (_event, id: string) => {
    return filterPresetService.getFilterPresetById(id)
  })

  ipcMain.handle('filterPresets:getDefault', async (
    _event,
    userId: string,
    entityType: filterPresetService.EntityType
  ) => {
    return filterPresetService.getDefaultPreset(userId, entityType)
  })

  ipcMain.handle('filterPresets:update', async (
    _event,
    id: string,
    userId: string,
    input: filterPresetService.UpdatePresetInput
  ) => {
    return filterPresetService.updateFilterPreset(id, userId, input)
  })

  ipcMain.handle('filterPresets:delete', async (_event, id: string, userId: string) => {
    return filterPresetService.deleteFilterPreset(id, userId)
  })

  ipcMain.handle('filterPresets:setDefault', async (
    _event,
    id: string,
    userId: string,
    entityType: filterPresetService.EntityType
  ) => {
    return filterPresetService.setDefaultPreset(id, userId, entityType)
  })

  ipcMain.handle('filterPresets:clearDefault', async (
    _event,
    userId: string,
    entityType: filterPresetService.EntityType
  ) => {
    return filterPresetService.clearDefaultPreset(userId, entityType)
  })

  ipcMain.handle('filterPresets:getStats', async (_event, userId: string) => {
    return filterPresetService.getPresetStats(userId)
  })

  // ===== History (Undo/Redo) Handlers =====

  ipcMain.handle('history:undoCreate', async (_event, entityType: historyService.EntityType, entityId: string, userId: string) => {
    return historyService.undoCreate(entityType, entityId, userId)
  })

  ipcMain.handle('history:undoUpdate', async (_event, entityType: historyService.EntityType, entityId: string, previousData: Record<string, unknown>, userId: string) => {
    return historyService.undoUpdate(entityType, entityId, previousData, userId)
  })

  ipcMain.handle('history:undoDelete', async (_event, entityType: historyService.EntityType, entityId: string, userId: string) => {
    return historyService.undoDelete(entityType, entityId, userId)
  })

  ipcMain.handle('history:redoCreate', async (_event, entityType: historyService.EntityType, entityId: string, userId: string) => {
    return historyService.redoCreate(entityType, entityId, userId)
  })

  ipcMain.handle('history:redoUpdate', async (_event, entityType: historyService.EntityType, entityId: string, afterData: Record<string, unknown>, userId: string) => {
    return historyService.redoUpdate(entityType, entityId, afterData, userId)
  })

  ipcMain.handle('history:redoDelete', async (_event, entityType: historyService.EntityType, entityId: string, userId: string) => {
    return historyService.redoDelete(entityType, entityId, userId)
  })

  ipcMain.handle('history:getEntity', async (_event, entityType: historyService.EntityType, entityId: string) => {
    return historyService.getEntityById(entityType, entityId)
  })

  // ===== Pin Handlers =====

  ipcMain.handle('pins:toggle', async (_event, entityType: pinService.PinnableEntityType, entityId: string, userId: string) => {
    return pinService.togglePin(entityType, entityId, userId)
  })

  ipcMain.handle('pins:isPinned', async (_event, entityType: pinService.PinnableEntityType, entityId: string, userId: string) => {
    return pinService.isPinned(entityType, entityId, userId)
  })

  ipcMain.handle('pins:getPinnedIds', async (_event, entityType: pinService.PinnableEntityType, userId: string) => {
    return pinService.getPinnedIds(entityType, userId)
  })

  ipcMain.handle('pins:getPinStatuses', async (_event, entityType: pinService.PinnableEntityType, entityIds: string[], userId: string) => {
    return pinService.getPinStatuses(entityType, entityIds, userId)
  })

  // ===== Health Monitoring Handlers =====

  ipcMain.handle('health:runChecks', async () => {
    // Health service already checks isRestoreInProgress internally
    return healthService.runHealthChecks()
  })

  ipcMain.handle('health:getMetrics', async () => {
    // System metrics don't require database access, safe during restore
    return healthService.getSystemMetrics()
  })

  ipcMain.handle('health:getLastStatus', async () => {
    // Returns cached status, no database access
    return healthService.getLastHealthStatus()
  })

  ipcMain.handle('health:forceCheckpoint', async () => {
    if (isRestoreInProgress()) return { success: false, error: 'Restore in progress' }
    return healthService.forceCheckpoint()
  })

  ipcMain.handle('health:optimizeDatabase', async () => {
    if (isRestoreInProgress()) return { success: false, error: 'Restore in progress' }
    return healthService.optimizeDatabase()
  })

  ipcMain.handle('health:analyzeDatabase', async () => {
    if (isRestoreInProgress()) return { success: false, error: 'Restore in progress' }
    return healthService.analyzeDatabase()
  })

  // ===== Data Integrity Handlers =====

  ipcMain.handle('integrity:check', async () => {
    if (isRestoreInProgress()) return {
      valid: false,
      checks: [],
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0,
      timestamp: new Date().toISOString()
    }
    return integrityService.checkDatabaseIntegrity()
  })

  ipcMain.handle('integrity:getStartupResult', async () => {
    // Returns cached result, no database access
    return integrityService.getStartupCheckResult()
  })

  ipcMain.handle('integrity:isStartupComplete', async () => {
    // Returns cached boolean, no database access
    return integrityService.isStartupCheckComplete()
  })

  ipcMain.handle('integrity:repairOrphanedRecords', async () => {
    if (isRestoreInProgress()) return { success: false, repaired: 0, errors: ['Restore in progress'] }
    return integrityService.repairOrphanedRecords()
  })

  ipcMain.handle('integrity:rebuildFtsIndexes', async () => {
    if (isRestoreInProgress()) return { success: false, repaired: 0, errors: ['Restore in progress'] }
    return integrityService.rebuildFtsIndexes()
  })

  ipcMain.handle('integrity:repairForeignKeyViolations', async () => {
    if (isRestoreInProgress()) return { success: false, repaired: 0, errors: ['Restore in progress'] }
    return integrityService.repairForeignKeyViolations()
  })

  ipcMain.handle('integrity:repairOrphanedEmails', async () => {
    if (isRestoreInProgress()) return { success: false, repaired: 0, errors: ['Restore in progress'] }
    return integrityService.repairOrphanedEmails()
  })

  ipcMain.handle('integrity:repairOrphanedAttachments', async () => {
    if (isRestoreInProgress()) return { success: false, repaired: 0, errors: ['Restore in progress'] }
    return integrityService.repairOrphanedAttachments()
  })

  // ===== Sync Service Handlers =====

  ipcMain.handle('sync:getEntityVersion', async (_event, entityType: string, entityId: string) => {
    return syncService.getEntityVersion(entityType, entityId)
  })

  ipcMain.handle('sync:updateEntityVersion', async (
    _event,
    entityType: string,
    entityId: string,
    data: Record<string, unknown>,
    userId: string | null
  ) => {
    return syncService.updateEntityVersion(entityType, entityId, data, userId)
  })

  ipcMain.handle('sync:checkConflict', async (
    _event,
    entityType: string,
    entityId: string,
    clientVersion: number,
    clientData: Record<string, unknown>,
    originalData: Record<string, unknown>
  ) => {
    return syncService.checkConflict(entityType, entityId, clientVersion, clientData, originalData)
  })

  ipcMain.handle('sync:mergeConflict', async (
    _event,
    conflict: syncService.ConflictInfo,
    clientData: Record<string, unknown>,
    strategy: syncService.MergeStrategy,
    manualResolutions?: Record<string, unknown>
  ) => {
    return syncService.mergeConflict(conflict, clientData, strategy, manualResolutions)
  })

  ipcMain.handle('sync:getRecentChanges', async (
    _event,
    entityType?: string,
    since?: string,
    limit?: number
  ) => {
    return syncService.getRecentChanges(entityType, since, limit)
  })

  // ===== Notification Service Handlers =====

  ipcMain.handle('notifications:create', async (_event, input: notificationService.CreateNotificationInput) => {
    return notificationService.createNotification(input)
  })

  ipcMain.handle('notifications:get', async (
    _event,
    userId: string,
    options?: {
      unreadOnly?: boolean
      limit?: number
      offset?: number
      type?: notificationService.NotificationType
    }
  ) => {
    return notificationService.getNotifications(userId, options)
  })

  ipcMain.handle('notifications:markAsRead', async (_event, notificationId: string, userId: string) => {
    return notificationService.markAsRead(notificationId, userId)
  })

  ipcMain.handle('notifications:markAllAsRead', async (_event, userId: string) => {
    return notificationService.markAllAsRead(userId)
  })

  ipcMain.handle('notifications:getUnreadCount', async (_event, userId: string) => {
    return notificationService.getUnreadCount(userId)
  })

  ipcMain.handle('notifications:processMentions', async (
    _event,
    text: string,
    entityType: string,
    entityId: string,
    actorId: string,
    actorName: string,
    entityTitle: string
  ) => {
    return notificationService.processMentions(text, entityType, entityId, actorId, actorName, entityTitle)
  })

  ipcMain.handle('notifications:getPreferences', async (_event, userId: string) => {
    return notificationService.getNotificationPreferences(userId)
  })

  ipcMain.handle('notifications:updatePreferences', async (
    _event,
    userId: string,
    preferences: Partial<Record<string, boolean>>
  ) => {
    return notificationService.updateNotificationPreferences(userId, preferences)
  })

  // ===== Document Version Handlers =====

  ipcMain.handle('documentVersions:create', async (_event, input: documentVersionService.CreateVersionInput) => {
    return documentVersionService.createVersion(input)
  })

  ipcMain.handle('documentVersions:getVersions', async (
    _event,
    documentType: documentVersionService.DocumentVersion['document_type'],
    documentId: string
  ) => {
    return documentVersionService.getVersions(documentType, documentId)
  })

  ipcMain.handle('documentVersions:getVersion', async (_event, versionId: string) => {
    return documentVersionService.getVersion(versionId)
  })

  ipcMain.handle('documentVersions:getCurrentVersion', async (
    _event,
    documentType: documentVersionService.DocumentVersion['document_type'],
    documentId: string
  ) => {
    return documentVersionService.getCurrentVersion(documentType, documentId)
  })

  ipcMain.handle('documentVersions:restore', async (_event, versionId: string, userId: string) => {
    return documentVersionService.restoreVersion(versionId, userId)
  })

  ipcMain.handle('documentVersions:compare', async (_event, versionId1: string, versionId2: string) => {
    return documentVersionService.compareVersions(versionId1, versionId2)
  })

  ipcMain.handle('documentVersions:getCount', async (
    _event,
    documentType: documentVersionService.DocumentVersion['document_type'],
    documentId: string
  ) => {
    return documentVersionService.getVersionCount(documentType, documentId)
  })

  ipcMain.handle('documentVersions:verifyIntegrity', async (_event, versionId: string) => {
    return documentVersionService.verifyIntegrity(versionId)
  })

  // ===== OCR Service Handlers =====

  ipcMain.handle('ocr:recognizeImage', async (
    _event,
    imagePath: string,
    language: ocrService.OCRLanguage
  ) => {
    return ocrService.recognizeImage(imagePath, language)
  })

  ipcMain.handle('ocr:extractAndIndex', async (
    _event,
    attachmentId: string,
    attachmentType: 'record_attachment' | 'letter_attachment',
    filePath: string,
    language: ocrService.OCRLanguage,
    userId: string | null
  ) => {
    return ocrService.extractAndIndexText(attachmentId, attachmentType, filePath, language, userId)
  })

  ipcMain.handle('ocr:getExtractedText', async (_event, attachmentId: string) => {
    return ocrService.getExtractedText(attachmentId)
  })

  ipcMain.handle('ocr:searchText', async (
    _event,
    query: string,
    attachmentType?: 'record_attachment' | 'letter_attachment',
    limit?: number
  ) => {
    return ocrService.searchExtractedText(query, attachmentType, limit)
  })

  ipcMain.handle('ocr:deleteExtractedText', async (_event, attachmentId: string) => {
    return ocrService.deleteExtractedText(attachmentId)
  })

  ipcMain.handle('ocr:getStats', async () => {
    return ocrService.getOCRStats()
  })

  // ===== Signature Service Handlers =====

  ipcMain.handle('signatures:create', async (_event, input: signatureService.CreateSignatureInput) => {
    return signatureService.createSignature(input)
  })

  ipcMain.handle('signatures:getAll', async (_event, userId: string, type?: signatureService.Signature['type']) => {
    return signatureService.getSignatures(userId, type)
  })

  ipcMain.handle('signatures:get', async (_event, signatureId: string) => {
    return signatureService.getSignature(signatureId)
  })

  ipcMain.handle('signatures:getDefault', async (
    _event,
    userId: string,
    type: signatureService.Signature['type']
  ) => {
    return signatureService.getDefaultSignature(userId, type)
  })

  ipcMain.handle('signatures:update', async (
    _event,
    signatureId: string,
    updates: Partial<Pick<signatureService.Signature, 'name' | 'image_data' | 'is_default'>>,
    userId: string
  ) => {
    return signatureService.updateSignature(signatureId, updates, userId)
  })

  ipcMain.handle('signatures:delete', async (_event, signatureId: string, userId: string) => {
    return signatureService.deleteSignature(signatureId, userId)
  })

  ipcMain.handle('signatures:place', async (_event, input: signatureService.PlaceSignatureInput) => {
    return signatureService.placeSignature(input)
  })

  ipcMain.handle('signatures:getPlacements', async (_event, documentType: string, documentId: string) => {
    return signatureService.getDocumentPlacements(documentType, documentId)
  })

  ipcMain.handle('signatures:removePlacement', async (_event, placementId: string, userId: string) => {
    return signatureService.removePlacement(placementId, userId)
  })

  ipcMain.handle('signatures:getForExport', async (_event, documentType: string, documentId: string) => {
    return signatureService.getSignaturesForExport(documentType, documentId)
  })

  // ===== View Handlers =====

  ipcMain.handle('views:create', async (_event, input: viewService.CreateViewInput) => {
    return viewService.createView(input)
  })

  ipcMain.handle('views:getById', async (_event, id: number) => {
    return viewService.getViewById(id)
  })

  ipcMain.handle('views:getViews', async (
    _event,
    entityType: string,
    userId: number,
    includeShared?: boolean
  ) => {
    return viewService.getViews(entityType, userId, includeShared)
  })

  ipcMain.handle('views:getDefault', async (_event, entityType: string, userId: number) => {
    return viewService.getDefaultView(entityType, userId)
  })

  ipcMain.handle('views:update', async (
    _event,
    id: number,
    input: viewService.UpdateViewInput,
    userId: number
  ) => {
    return viewService.updateView(id, input, userId)
  })

  ipcMain.handle('views:delete', async (_event, id: number, userId: number) => {
    return viewService.deleteView(id, userId)
  })

  ipcMain.handle('views:duplicate', async (
    _event,
    id: number,
    newName: string,
    userId: number
  ) => {
    return viewService.duplicateView(id, newName, userId)
  })

  ipcMain.handle('views:toggleShare', async (_event, id: number, userId: number) => {
    return viewService.toggleShareView(id, userId)
  })

  // ===== Custom Field Handlers =====

  ipcMain.handle('customFields:createDefinition', async (_event, input: customFieldService.CreateFieldInput) => {
    return customFieldService.createFieldDefinition(input)
  })

  ipcMain.handle('customFields:getDefinitions', async (
    _event,
    entityType: customFieldService.CustomFieldEntityType
  ) => {
    return customFieldService.getFieldDefinitions(entityType)
  })

  ipcMain.handle('customFields:getDefinitionById', async (_event, id: string) => {
    return customFieldService.getFieldDefinitionById(id)
  })

  ipcMain.handle('customFields:getDefinitionByName', async (
    _event,
    entityType: customFieldService.CustomFieldEntityType,
    name: string
  ) => {
    return customFieldService.getFieldDefinitionByName(entityType, name)
  })

  ipcMain.handle('customFields:updateDefinition', async (
    _event,
    id: string,
    input: customFieldService.UpdateFieldInput,
    userId: string
  ) => {
    return customFieldService.updateFieldDefinition(id, input, userId)
  })

  ipcMain.handle('customFields:deleteDefinition', async (_event, id: string, userId: string) => {
    return customFieldService.deleteFieldDefinition(id, userId)
  })

  ipcMain.handle('customFields:reorderDefinitions', async (
    _event,
    entityType: customFieldService.CustomFieldEntityType,
    fieldIds: string[],
    userId: string
  ) => {
    return customFieldService.reorderFieldDefinitions(entityType, fieldIds, userId)
  })

  ipcMain.handle('customFields:setFieldValue', async (
    _event,
    fieldId: string,
    entityType: customFieldService.CustomFieldEntityType,
    entityId: string,
    value: unknown
  ) => {
    return customFieldService.setFieldValue(fieldId, entityType, entityId, value)
  })

  ipcMain.handle('customFields:setFieldValues', async (
    _event,
    entityType: customFieldService.CustomFieldEntityType,
    entityId: string,
    values: Record<string, unknown>
  ) => {
    return customFieldService.setFieldValues(entityType, entityId, values)
  })

  ipcMain.handle('customFields:getFieldValues', async (
    _event,
    entityType: customFieldService.CustomFieldEntityType,
    entityId: string
  ) => {
    return customFieldService.getFieldValues(entityType, entityId)
  })

  ipcMain.handle('customFields:getFieldValuesWithDefinitions', async (
    _event,
    entityType: customFieldService.CustomFieldEntityType,
    entityId: string
  ) => {
    return customFieldService.getFieldValuesWithDefinitions(entityType, entityId)
  })

  ipcMain.handle('customFields:deleteFieldValues', async (
    _event,
    entityType: customFieldService.CustomFieldEntityType,
    entityId: string
  ) => {
    return customFieldService.deleteFieldValuesForEntity(entityType, entityId)
  })

  ipcMain.handle('customFields:searchByField', async (
    _event,
    entityType: customFieldService.CustomFieldEntityType,
    fieldName: string,
    value: string,
    operator?: 'eq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte'
  ) => {
    return customFieldService.searchByCustomField(entityType, fieldName, value, operator)
  })

  // ===== Import Handlers =====

  ipcMain.handle('import:preview', async (_event, filePath: string) => {
    return importService.previewImportFile(filePath)
  })

  ipcMain.handle('import:getSuggestedMappings', async (
    _event,
    entityType: importService.ImportEntityType,
    headers: string[]
  ) => {
    return importService.getSuggestedMappings(entityType, headers)
  })

  ipcMain.handle('import:execute', async (_event, config: importService.ImportConfig) => {
    return importService.executeImport(config)
  })

  ipcMain.handle('import:getProgress', async () => {
    return importService.getImportProgress()
  })

  ipcMain.handle('import:cancel', async () => {
    importService.cancelImport()
    return { success: true }
  })

  ipcMain.handle('import:generateTemplate', async (
    _event,
    entityType: importService.ImportEntityType
  ) => {
    const buffer = importService.generateImportTemplate(entityType)
    return { success: true, data: buffer.toString('base64') }
  })

  ipcMain.handle('import:selectFile', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, error: 'No active window' }

    const result = await dialog.showOpenDialog(win, {
      title: 'Select Import File',
      filters: [
        { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'Selection canceled' }
    }

    return { success: true, filePath: result.filePaths[0] }
  })

  // ===== Mention Handlers =====

  ipcMain.handle('mentions:create', async (
    _event,
    input: mentionService.CreateMentionInput,
    userId: string
  ) => {
    return mentionService.createMention(input, userId)
  })

  ipcMain.handle('mentions:createBulk', async (
    _event,
    inputs: mentionService.CreateMentionInput[],
    userId: string
  ) => {
    return mentionService.createMentions(inputs, userId)
  })

  ipcMain.handle('mentions:getById', async (_event, id: string) => {
    return mentionService.getMentionById(id)
  })

  ipcMain.handle('mentions:getForUser', async (
    _event,
    userId: string,
    filters?: mentionService.MentionFilters
  ) => {
    return mentionService.getMentionsForUser(userId, filters)
  })

  ipcMain.handle('mentions:getSentByUser', async (
    _event,
    userId: string,
    filters?: mentionService.MentionFilters
  ) => {
    return mentionService.getMentionsSentByUser(userId, filters)
  })

  ipcMain.handle('mentions:getForEntity', async (
    _event,
    entityType: mentionService.EntityType,
    entityId: string
  ) => {
    return mentionService.getMentionsForEntity(entityType, entityId)
  })

  ipcMain.handle('mentions:getAll', async (_event, filters?: mentionService.MentionFilters) => {
    return mentionService.getAllMentions(filters)
  })

  ipcMain.handle('mentions:acknowledge', async (_event, id: string, userId: string) => {
    return mentionService.acknowledgeMention(id, userId)
  })

  ipcMain.handle('mentions:archive', async (_event, id: string, userId: string) => {
    return mentionService.archiveMention(id, userId)
  })

  ipcMain.handle('mentions:updateNote', async (
    _event,
    id: string,
    note: string,
    userId: string
  ) => {
    return mentionService.updateMentionNote(id, note, userId)
  })

  ipcMain.handle('mentions:delete', async (_event, id: string, userId: string) => {
    return mentionService.deleteMention(id, userId)
  })

  ipcMain.handle('mentions:getUnacknowledgedCount', async (_event, userId: string) => {
    // Return 0 during restore to avoid database access
    if (isRestoreInProgress()) return 0
    return mentionService.getUnacknowledgedCount(userId)
  })

  ipcMain.handle('mentions:getCounts', async (_event, userId: string) => {
    // Return empty counts during restore to avoid database access
    if (isRestoreInProgress()) return { pending: 0, acknowledged: 0, archived: 0, sent: 0 }
    return mentionService.getMentionCounts(userId)
  })

  ipcMain.handle('mentions:searchUsers', async (_event, query: string) => {
    return mentionService.searchUsersForMention(query)
  })

  ipcMain.handle('mentions:cleanup', async () => {
    return mentionService.cleanupOldArchivedMentions()
  })

  console.log('IPC handlers registered')
}
