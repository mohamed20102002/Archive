// Outlook COM Integration Service using winax
// This service connects to Microsoft Outlook via COM automation

let outlookApp: any = null
let isConnected = false

// Cache types and configuration
interface CacheEntry<T> {
  data: T
  timestamp: number
}

interface OutlookMailbox {
  id: string
  name: string
  emailAddress: string
}

interface OutlookFolder {
  id: string
  name: string
  path: string
  unreadCount: number
  totalCount: number
  hasSubfolders: boolean
  entryId: string
  storeId: string
}

interface OutlookEmail {
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
  htmlBody: string
}

// In-memory cache for Outlook data
const cache = {
  mailboxes: null as CacheEntry<OutlookMailbox[]> | null,
  folders: new Map<string, CacheEntry<OutlookFolder[]>>(),
  emails: new Map<string, CacheEntry<OutlookEmail[]>>()
}

// Cache TTL values (in milliseconds)
// Longer TTL prevents expensive Outlook COM calls on page refresh
const CACHE_TTL = {
  mailboxes: 30 * 60 * 1000, // 30 minutes - rarely changes
  folders: 30 * 60 * 1000, // 30 minutes - rarely changes
  emails: 5 * 60 * 1000 // 5 minutes - balance between freshness and performance
}

function isCacheValid<T>(entry: CacheEntry<T> | null | undefined, ttl: number): boolean {
  if (!entry) return false
  return Date.now() - entry.timestamp < ttl
}

export async function connect(): Promise<{ success: boolean; error?: string }> {
  if (isConnected && outlookApp) {
    return { success: true }
  }

  try {
    // Dynamic import of winax for Windows COM automation
    const winax = require('winax')

    // Create Outlook Application object
    outlookApp = new winax.Object('Outlook.Application')

    if (!outlookApp) {
      return { success: false, error: 'Failed to create Outlook application instance' }
    }

    // Get MAPI namespace to verify connection
    const namespace = outlookApp.GetNamespace('MAPI')
    if (!namespace) {
      return { success: false, error: 'Failed to access Outlook MAPI namespace' }
    }

    isConnected = true
    console.log('Connected to Outlook successfully')
    return { success: true }
  } catch (error: any) {
    console.error('Failed to connect to Outlook:', error)

    if (error.message?.includes('not found') || error.message?.includes('Cannot find')) {
      return {
        success: false,
        error: 'Microsoft Outlook is not installed or the winax package is not properly configured'
      }
    }

    return {
      success: false,
      error: `Failed to connect to Outlook: ${error.message || 'Unknown error'}`
    }
  }
}

export function disconnect(): void {
  // Clear cache on disconnect
  cache.mailboxes = null
  cache.folders.clear()
  cache.emails.clear()

  if (outlookApp) {
    try {
      outlookApp = null
    } catch (error) {
      console.error('Error disconnecting from Outlook:', error)
    }
  }
  isConnected = false
  console.log('Disconnected from Outlook')
}

export function getIsConnected(): boolean {
  return isConnected && outlookApp !== null
}

// Clear all cached data to force fresh fetch
export function clearCache(): void {
  cache.mailboxes = null
  cache.folders.clear()
  cache.emails.clear()
  console.log('Outlook cache cleared')
}

// Validate that the COM connection is still alive
function validateConnection(): boolean {
  if (!isConnected || !outlookApp) {
    return false
  }
  try {
    // Try to access a property to verify the COM object is still valid
    const namespace = outlookApp.GetNamespace('MAPI')
    return namespace !== null
  } catch {
    // COM object is no longer valid
    console.log('Outlook COM connection is stale, needs reconnection')
    isConnected = false
    outlookApp = null
    return false
  }
}

// Ensure connection is valid, reconnect if needed
async function ensureConnection(): Promise<void> {
  if (!validateConnection()) {
    const result = await connect()
    if (!result.success) {
      throw new Error(result.error || 'Failed to connect to Outlook')
    }
  }
}

export async function getMailboxes(): Promise<OutlookMailbox[]> {
  console.log('=== outlookService.getMailboxes called ===')

  await ensureConnection()

  // Check cache first
  if (isCacheValid(cache.mailboxes, CACHE_TTL.mailboxes)) {
    console.log('Returning cached mailboxes')
    return cache.mailboxes!.data
  }

  const mailboxes: OutlookMailbox[] = []

  try {
    const namespace = outlookApp.GetNamespace('MAPI')
    const stores = namespace.Stores

    console.log('Total stores found:', stores.Count)

    for (let i = 1; i <= stores.Count; i++) {
      const store = stores.Item(i)

      // Skip public folders and shared mailboxes that might not be accessible
      try {
        const rootFolder = store.GetRootFolder()
        if (rootFolder) {
          const mailbox = {
            id: store.StoreID,
            name: store.DisplayName || `Mailbox ${i}`,
            emailAddress: store.DisplayName || ''
          }
          console.log(`Mailbox ${i}:`, JSON.stringify(mailbox, null, 2))
          mailboxes.push(mailbox)
        }
      } catch {
        // Skip inaccessible stores
        console.log(`Store ${i} skipped (inaccessible)`)
      }
    }
  } catch (error: any) {
    console.error('Error getting mailboxes:', error)
    throw new Error(`Failed to get mailboxes: ${error.message}`)
  }

  // Update cache
  cache.mailboxes = { data: mailboxes, timestamp: Date.now() }

  console.log('Total mailboxes returned:', mailboxes.length)
  return mailboxes
}

export async function getFolders(storeId: string): Promise<OutlookFolder[]> {
  console.log('=== outlookService.getFolders called ===')
  console.log('storeId received:', storeId)

  await ensureConnection()

  // Check cache first
  const cachedFolders = cache.folders.get(storeId)
  if (isCacheValid(cachedFolders, CACHE_TTL.folders)) {
    console.log('Returning cached folders for store:', storeId)
    return cachedFolders!.data
  }

  const folders: OutlookFolder[] = []

  try {
    const namespace = outlookApp.GetNamespace('MAPI')
    const stores = namespace.Stores
    let targetStore = null

    console.log('Total stores:', stores.Count)

    // Find the store by ID
    for (let i = 1; i <= stores.Count; i++) {
      const store = stores.Item(i)
      console.log(`Store ${i}: DisplayName="${store.DisplayName}", StoreID="${store.StoreID}"`)
      if (store.StoreID === storeId) {
        targetStore = store
        console.log('Found matching store!')
        break
      }
    }

    if (!targetStore) {
      console.log('No matching store found for storeId:', storeId)
      throw new Error('Mailbox not found')
    }

    const rootFolder = targetStore.GetRootFolder()
    collectFolders(rootFolder, '', folders, storeId)
  } catch (error: any) {
    console.error('Error getting folders:', error)
    throw new Error(`Failed to get folders: ${error.message}`)
  }

  // Update cache
  cache.folders.set(storeId, { data: folders, timestamp: Date.now() })

  return folders
}

// Folders to include (case-insensitive matching)
const ALLOWED_FOLDER_NAMES = ['inbox', 'sent items', 'sent', 'drafts', 'draft']

function isAllowedFolder(folderName: string): boolean {
  const name = folderName.toLowerCase()
  return ALLOWED_FOLDER_NAMES.some(allowed => name.includes(allowed))
}

// Extract display name from Exchange address format
// Format: /o=ORG/ou=.../cn=Recipients/cn=GUID-DisplayName
function extractDisplayName(address: string, fallbackName?: string): string {
  if (!address) return fallbackName || 'Unknown'

  // If it's already a normal email or name, return as-is
  if (!address.startsWith('/o=') && !address.startsWith('/O=')) {
    return address
  }

  // Try to extract from cn= pattern
  const cnMatch = address.match(/cn=([^\/]+)$/i)
  if (cnMatch) {
    const cnPart = cnMatch[1]
    // The format is often GUID-DisplayName, so split by hyphen and take the name part
    const hyphenIndex = cnPart.indexOf('-')
    if (hyphenIndex > 0 && hyphenIndex < cnPart.length - 1) {
      // Return everything after the first hyphen (the display name)
      return cnPart.substring(hyphenIndex + 1).replace(/([a-z])([A-Z])/g, '$1 $2')
    }
    return cnPart
  }

  return fallbackName || address
}

// Convert Outlook date to ISO string
// Outlook COM returns dates via VT_DATE which winax converts to JS Date
// The conversion treats the date as UTC, but Outlook stores it as local time
// So we need to use UTC methods to get the original local time values
function formatOutlookDate(date: any): string {
  if (!date) return ''
  try {
    const d = new Date(date)

    // Use UTC methods because winax interprets VT_DATE as UTC
    // but Outlook actually stores local time values
    const year = d.getUTCFullYear()
    const month = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    const hours = String(d.getUTCHours()).padStart(2, '0')
    const minutes = String(d.getUTCMinutes()).padStart(2, '0')
    const seconds = String(d.getUTCSeconds()).padStart(2, '0')

    // Return as ISO-like format without Z suffix (local time representation)
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
  } catch {
    return ''
  }
}

function collectFolders(folder: any, parentPath: string, folders: OutlookFolder[], storeId: string): void {
  try {
    const path = parentPath ? `${parentPath}/${folder.Name}` : folder.Name
    const folderName = folder.Name

    // Only add allowed folders (Inbox, Sent, Drafts)
    if (isAllowedFolder(folderName)) {
      folders.push({
        id: folder.EntryID,
        name: folder.Name,
        path: path,
        unreadCount: folder.UnReadItemCount || 0,
        totalCount: folder.Items?.Count || 0,
        hasSubfolders: false, // Don't show subfolders
        entryId: folder.EntryID,
        storeId: storeId
      })
    }

    // Still check subfolders for allowed folders
    if (folder.Folders && folder.Folders.Count > 0) {
      for (let i = 1; i <= folder.Folders.Count; i++) {
        try {
          const subFolder = folder.Folders.Item(i)
          collectFolders(subFolder, path, folders, storeId)
        } catch {
          // Skip inaccessible folders
        }
      }
    }
  } catch (error) {
    // Skip folders that can't be accessed
  }
}

export async function getEmails(folderId: string, storeId: string, limit: number = 50): Promise<OutlookEmail[]> {
  console.log('=== outlookService.getEmails called ===')
  console.log('folderId received:', folderId)
  console.log('storeId received:', storeId)
  console.log('limit:', limit)

  await ensureConnection()

  // Check cache first (use composite key of folderId + storeId)
  const cacheKey = `${folderId}:${storeId}`
  const cachedEmails = cache.emails.get(cacheKey)
  if (isCacheValid(cachedEmails, CACHE_TTL.emails)) {
    console.log('Returning cached emails for folder:', folderId)
    // Return up to the requested limit from cache
    return cachedEmails!.data.slice(0, limit)
  }

  const emails: OutlookEmail[] = []

  try {
    const namespace = outlookApp.GetNamespace('MAPI')
    console.log('Calling GetFolderFromID with folderId and storeId...')
    const folder = namespace.GetFolderFromID(folderId, storeId)

    if (!folder) {
      console.log('GetFolderFromID returned null')
      throw new Error('Folder not found')
    }
    console.log('Folder found:', folder.Name)

    const items = folder.Items
    items.Sort('[ReceivedTime]', true) // Sort by received time, descending

    const count = Math.min(items.Count, limit)
    const BATCH_SIZE = 5 // Process emails in small batches to prevent UI freeze

    for (let i = 1; i <= count; i++) {
      try {
        const item = items.Item(i)

        // Check if it's a mail item (class 43)
        if (item.Class !== 43) continue

        const recipients: string[] = []
        const cc: string[] = []

        try {
          for (let r = 1; r <= item.Recipients.Count; r++) {
            const recipient = item.Recipients.Item(r)
            // Prefer Name over Address for display purposes
            const displayName = recipient.Name || extractDisplayName(recipient.Address, recipient.Name)
            if (recipient.Type === 1) { // To
              recipients.push(displayName)
            } else if (recipient.Type === 2) { // CC
              cc.push(displayName)
            }
          }
        } catch {
          // Recipients not accessible
        }

        const attachmentNames: string[] = []
        try {
          for (let a = 1; a <= item.Attachments.Count; a++) {
            attachmentNames.push(item.Attachments.Item(a).FileName || `Attachment ${a}`)
          }
        } catch {
          // Attachments not accessible
        }

        // Get sender display name
        const senderDisplay = item.SenderName || extractDisplayName(item.SenderEmailAddress, 'Unknown Sender')

        // Skip body preview in list view - it's too slow
        // Full body is loaded via getEmailDetails when user clicks
        emails.push({
          entryId: item.EntryID,
          storeId: storeId,
          subject: item.Subject || '(No Subject)',
          sender: senderDisplay,
          senderName: senderDisplay,
          recipients,
          cc,
          sentAt: item.SentOn ? formatOutlookDate(item.SentOn) : '',
          receivedAt: item.ReceivedTime ? formatOutlookDate(item.ReceivedTime) : '',
          hasAttachments: item.Attachments?.Count > 0,
          attachmentCount: item.Attachments?.Count || 0,
          attachmentNames,
          importance: item.Importance || 1,
          folderPath: folder.FolderPath || '',
          bodyPreview: '', // Skip preview - too slow to fetch for every email
          body: '', // Full body loaded on demand
          htmlBody: '' // Full HTML body loaded on demand
        })
      } catch (error) {
        // Skip items that can't be read
        console.error('Error reading email item:', error)
      }

      // Yield control every BATCH_SIZE emails to prevent UI freeze
      if (i % BATCH_SIZE === 0) {
        await new Promise(resolve => setImmediate(resolve))
      }
    }
  } catch (error: any) {
    console.error('Error getting emails:', error)
    throw new Error(`Failed to get emails: ${error.message}`)
  }

  // Update cache
  cache.emails.set(cacheKey, { data: emails, timestamp: Date.now() })

  return emails
}

export async function getEmailDetails(entryId: string, storeId: string): Promise<OutlookEmail | null> {
  console.log('=== outlookService.getEmailDetails called ===')
  console.log('entryId:', entryId)
  console.log('storeId:', storeId)

  await ensureConnection()

  try {
    const namespace = outlookApp.GetNamespace('MAPI')
    console.log('Calling GetItemFromID...')
    const item = namespace.GetItemFromID(entryId, storeId)

    console.log('Item retrieved:', item ? 'yes' : 'no')
    if (item) {
      console.log('Item.Class:', item.Class)
      console.log('Item.Subject:', item.Subject)
    }

    if (!item || item.Class !== 43) {
      console.log('Returning null - item not found or not a mail item')
      return null
    }

    const recipients: string[] = []
    const cc: string[] = []

    try {
      for (let r = 1; r <= item.Recipients.Count; r++) {
        const recipient = item.Recipients.Item(r)
        const displayName = recipient.Name || extractDisplayName(recipient.Address, recipient.Name)
        if (recipient.Type === 1) {
          recipients.push(displayName)
        } else if (recipient.Type === 2) {
          cc.push(displayName)
        }
      }
    } catch {
      // Recipients not accessible
    }

    const attachmentNames: string[] = []
    try {
      for (let a = 1; a <= item.Attachments.Count; a++) {
        attachmentNames.push(item.Attachments.Item(a).FileName || `Attachment ${a}`)
      }
    } catch {
      // Attachments not accessible
    }

    const senderDisplay = item.SenderName || extractDisplayName(item.SenderEmailAddress, 'Unknown Sender')

    return {
      entryId: item.EntryID,
      storeId: storeId,
      subject: item.Subject || '(No Subject)',
      sender: senderDisplay,
      senderName: senderDisplay,
      recipients,
      cc,
      sentAt: item.SentOn ? formatOutlookDate(item.SentOn) : '',
      receivedAt: item.ReceivedTime ? formatOutlookDate(item.ReceivedTime) : '',
      hasAttachments: item.Attachments?.Count > 0,
      attachmentCount: item.Attachments?.Count || 0,
      attachmentNames,
      importance: item.Importance || 1,
      folderPath: item.Parent?.FolderPath || '',
      bodyPreview: (item.Body || '').substring(0, 200),
      body: item.Body || '',
      htmlBody: item.HTMLBody || ''
    }
  } catch (error: any) {
    console.error('Error getting email details:', error)
    throw new Error(`Failed to get email details: ${error.message}`)
  }
}

export function saveEmailToFile(entryId: string, storeId: string, filePath: string): { success: boolean; error?: string } {
  if (!isConnected || !outlookApp) {
    return { success: false, error: 'Not connected to Outlook' }
  }

  try {
    const fs = require('fs')
    const path = require('path')
    const namespace = outlookApp.GetNamespace('MAPI')
    const item = namespace.GetItemFromID(entryId, storeId)

    if (!item) {
      return { success: false, error: 'Email not found' }
    }

    // Save as MSG Unicode format to preserve Arabic and other Unicode characters
    // olMSGUnicode = 9 (Unicode .msg), olMSG = 3 (ANSI - causes ?????? for non-ASCII)
    // Note: olMHTML = 10 (different format, don't use)
    item.SaveAs(filePath, 9)

    // Also save HTML body separately with UTF-8 encoding to preserve Arabic/Unicode text
    // This provides a readable backup when the MSG file shows ?????? for non-ASCII characters
    try {
      const htmlBody = item.HTMLBody || ''
      const plainBody = item.Body || ''

      if (htmlBody || plainBody) {
        const dir = path.dirname(filePath)
        const htmlPath = path.join(dir, 'email-content.html')

        // Create a complete HTML document with proper UTF-8 encoding
        const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${(item.Subject || 'Email').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; direction: auto; }
    .header { background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
    .header p { margin: 5px 0; }
    .label { font-weight: bold; color: #555; }
    .body-content { line-height: 1.6; }
  </style>
</head>
<body>
  <div class="header">
    <p><span class="label">Subject:</span> ${(item.Subject || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
    <p><span class="label">From:</span> ${(item.SenderName || item.SenderEmailAddress || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
    <p><span class="label">Date:</span> ${item.ReceivedTime ? new Date(item.ReceivedTime).toLocaleString() : ''}</p>
  </div>
  <div class="body-content">
    ${htmlBody || plainBody.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}
  </div>
</body>
</html>`

        fs.writeFileSync(htmlPath, htmlContent, 'utf8')
      }
    } catch (htmlError) {
      // Non-critical - just log and continue
      console.warn('Could not save HTML backup:', htmlError)
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error saving email:', error)
    return { success: false, error: `Failed to save email: ${error.message}` }
  }
}

export function saveAttachment(entryId: string, storeId: string, attachmentIndex: number, filePath: string): { success: boolean; error?: string } {
  if (!isConnected || !outlookApp) {
    return { success: false, error: 'Not connected to Outlook' }
  }

  try {
    const namespace = outlookApp.GetNamespace('MAPI')
    const item = namespace.GetItemFromID(entryId, storeId)

    if (!item) {
      return { success: false, error: 'Email not found' }
    }

    if (!item.Attachments || item.Attachments.Count < attachmentIndex) {
      return { success: false, error: 'Attachment not found' }
    }

    const attachment = item.Attachments.Item(attachmentIndex)
    attachment.SaveAsFile(filePath)

    return { success: true }
  } catch (error: any) {
    console.error('Error saving attachment:', error)
    return { success: false, error: `Failed to save attachment: ${error.message}` }
  }
}

// Arabic day names
const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

// Format date for Arabic email (DD/MM/YYYY)
function formatArabicDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

// Get Arabic day name from date
function getArabicDayName(dateStr: string): string {
  const date = new Date(dateStr)
  return ARABIC_DAYS[date.getDay()]
}

// Replace placeholders in template
function replacePlaceholders(template: string, date: string): string {
  const dayName = getArabicDayName(date)
  const formattedDate = formatArabicDate(date)
  const [year, month, day] = date.split('-')

  return template
    .replace(/{day_name}/g, dayName)
    .replace(/{date}/g, formattedDate)
    .replace(/{date_en}/g, `${year}-${month}-${day}`)
}

export interface ComposeEmailOptions {
  to: string
  cc?: string
  subject: string
  body: string
  bodyFormat?: 'plain' | 'html'
  attachmentPath?: string
}

export async function composeEmailWithAttachment(options: ComposeEmailOptions): Promise<{ success: boolean; error?: string }> {
  console.log('=== outlookService.composeEmailWithAttachment called ===')
  console.log('options:', JSON.stringify({ ...options, body: options.body.substring(0, 100) + '...' }, null, 2))

  try {
    await ensureConnection()

    // Create new mail item (0 = olMailItem)
    const mailItem = outlookApp.CreateItem(0)

    // Set recipients
    if (options.to) {
      mailItem.To = options.to
    }
    if (options.cc) {
      mailItem.CC = options.cc
    }

    // Set subject
    mailItem.Subject = options.subject

    // Set body - use HTML if it contains HTML tags, otherwise plain text
    if (options.bodyFormat === 'html' || options.body.includes('<') && options.body.includes('>')) {
      mailItem.HTMLBody = options.body
    } else {
      mailItem.Body = options.body
    }

    // Add attachment if provided
    if (options.attachmentPath) {
      const fs = require('fs')
      if (fs.existsSync(options.attachmentPath)) {
        mailItem.Attachments.Add(options.attachmentPath)
        console.log('Attachment added:', options.attachmentPath)
      } else {
        console.warn('Attachment file not found:', options.attachmentPath)
        return { success: false, error: `Attachment file not found: ${options.attachmentPath}` }
      }
    }

    // Display the email for user review (don't send automatically)
    mailItem.Display()

    console.log('Email composed and displayed successfully')
    return { success: true }
  } catch (error: any) {
    console.error('Error composing email:', error)
    return { success: false, error: `Failed to compose email: ${error.message}` }
  }
}

// Compose attendance report email with customizable template
export async function composeAttendanceReportEmail(
  date: string,
  attachmentPath: string,
  toEmails: string,
  ccEmails?: string,
  subjectTemplate?: string,
  bodyTemplate?: string
): Promise<{ success: boolean; error?: string }> {
  // Default templates if not provided
  const defaultSubject = 'الموقف اليومي لإدارة الأمان النووي عن يوم {day_name} الموافق {date}'
  const defaultBody = `السادة الزملاء بإدارة الشئون الإدارية
تحية طيبة وبعد ،،،
مرفق لسيادتكم الموقف اليومي لإدارة الأمان النووي عن يوم {day_name} الموافق {date}.
وتفضلوا بقبول وافر الاحترام والتقدير ،،،`

  const subject = replacePlaceholders(subjectTemplate || defaultSubject, date)
  const body = replacePlaceholders(bodyTemplate || defaultBody, date)

  // Check if body is HTML (contains HTML tags)
  const isHtml = body.includes('<') && body.includes('>')

  return composeEmailWithAttachment({
    to: toEmails,
    cc: ccEmails,
    subject,
    body,
    bodyFormat: isHtml ? 'html' : 'plain',
    attachmentPath
  })
}

/**
 * Send an email directly via Outlook (without displaying)
 * Used for automated emails like 2FA codes
 */
export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  options?: {
    cc?: string
    bodyFormat?: 'plain' | 'html'
  }
): Promise<{ success: boolean; error?: string }> {
  console.log('=== outlookService.sendEmail called ===')
  console.log('to:', to)
  console.log('subject:', subject)

  try {
    await ensureConnection()

    // Create new mail item (0 = olMailItem)
    const mailItem = outlookApp.CreateItem(0)

    // Set recipients
    mailItem.To = to
    if (options?.cc) {
      mailItem.CC = options.cc
    }

    // Set subject
    mailItem.Subject = subject

    // Set body
    if (options?.bodyFormat === 'html') {
      mailItem.HTMLBody = body
    } else {
      mailItem.Body = body
    }

    // Send the email directly
    mailItem.Send()

    console.log('Email sent successfully')
    return { success: true }
  } catch (error: any) {
    console.error('Error sending email:', error)
    return { success: false, error: `Failed to send email: ${error.message}` }
  }
}
