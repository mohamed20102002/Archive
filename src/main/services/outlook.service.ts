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
const CACHE_TTL = {
  mailboxes: 5 * 60 * 1000, // 5 minutes
  folders: 5 * 60 * 1000, // 5 minutes
  emails: 2 * 60 * 1000 // 2 minutes
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

export function getMailboxes(): OutlookMailbox[] {
  console.log('=== outlookService.getMailboxes called ===')

  if (!isConnected || !outlookApp) {
    throw new Error('Not connected to Outlook')
  }

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

export function getFolders(storeId: string): OutlookFolder[] {
  console.log('=== outlookService.getFolders called ===')
  console.log('storeId received:', storeId)

  if (!isConnected || !outlookApp) {
    throw new Error('Not connected to Outlook')
  }

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
// Outlook COM returns dates as local time via VT_DATE
function formatOutlookDate(date: any): string {
  if (!date) return ''
  try {
    // The date from Outlook COM is in local time
    // We need to create an ISO string that represents this local time
    const d = new Date(date)

    // Get local date components
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const seconds = String(d.getSeconds()).padStart(2, '0')

    // Return as ISO-like format but in local time (without Z suffix)
    // This will be parsed correctly by the frontend
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

export function getEmails(folderId: string, storeId: string, limit: number = 50): OutlookEmail[] {
  console.log('=== outlookService.getEmails called ===')
  console.log('folderId received:', folderId)
  console.log('storeId received:', storeId)
  console.log('limit:', limit)

  if (!isConnected || !outlookApp) {
    throw new Error('Not connected to Outlook')
  }

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
          bodyPreview: (item.Body || '').substring(0, 200),
          body: item.Body || '',
          htmlBody: item.HTMLBody || ''
        })
      } catch (error) {
        // Skip items that can't be read
        console.error('Error reading email item:', error)
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

export function getEmailDetails(entryId: string, storeId: string): OutlookEmail | null {
  console.log('=== outlookService.getEmailDetails called ===')
  console.log('entryId:', entryId)
  console.log('storeId:', storeId)

  if (!isConnected || !outlookApp) {
    throw new Error('Not connected to Outlook')
  }

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
    const namespace = outlookApp.GetNamespace('MAPI')
    const item = namespace.GetItemFromID(entryId, storeId)

    if (!item) {
      return { success: false, error: 'Email not found' }
    }

    // Save as MSG format (Outlook message format)
    item.SaveAs(filePath, 3) // 3 = olMSG format

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
