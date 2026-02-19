import { app, BrowserWindow, ipcMain, Notification, Menu } from 'electron'
import * as path from 'path'
import { initializeLogger } from './services/logger.service'
import { initializeSchema, hasUsers } from './database/schema'
import { initializeAuditSchema, logAudit } from './database/audit'
import { runMigrations } from './database/migrations'
import { closeDatabase, getDatabase } from './database/connection'
import { registerIpcHandlers } from './ipc/handlers'
import { clearTempFolder } from './services/secure-resources-crypto'
import { registerUpdaterHandlers } from './services/updater.service'
import { generateMissedInstances } from './services/scheduled-email.service'

// Initialize logger before anything else
initializeLogger()

let mainWindow: BrowserWindow | null = null

function createWindow() {
  // Remove the default menu bar
  Menu.setApplicationMenu(null)

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Project Data Archiving System',
    icon: path.join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      spellcheck: true
    },
    show: false,
    backgroundColor: '#f8fafc'
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    // Set window title from department name setting
    updateWindowTitleFromSettings()
    // Apply saved zoom factor
    applyZoomFactor()
  })

  // Re-apply zoom factor when window regains focus (fixes minimize/restore reset)
  mainWindow.on('focus', () => {
    applyZoomFactor()
    // Fix: Explicitly focus webContents when window regains focus
    // This fixes the issue where textboxes won't accept input after window loses focus
    if (mainWindow && !mainWindow.webContents.isFocused()) {
      mainWindow.webContents.focus()
    }
  })

  // Also handle blur/focus cycle to ensure proper focus restoration
  mainWindow.on('restore', () => {
    if (mainWindow) {
      mainWindow.webContents.focus()
    }
  })



  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    // DevTools can be opened manually with F12 if needed
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }


  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // === DEBUG: Track renderer crashes and reloads ===
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[MAIN] Renderer process gone!', details)
  })

  mainWindow.webContents.on('crashed', (event, killed) => {
    console.error('[MAIN] Renderer crashed! killed:', killed)
  })

  mainWindow.webContents.on('unresponsive', () => {
    console.error('[MAIN] Renderer became unresponsive!')
  })

  mainWindow.webContents.on('responsive', () => {
    console.log('[MAIN] Renderer became responsive again')
  })

  mainWindow.webContents.on('did-start-loading', () => {
    console.log('[MAIN] Renderer started loading at', new Date().toISOString())
  })

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[MAIN] Renderer finished loading at', new Date().toISOString())
  })

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[MAIN] Renderer failed to load:', errorCode, errorDescription)
  })

  mainWindow.webContents.on('dom-ready', () => {
    console.log('[MAIN] DOM ready at', new Date().toISOString())
  })

  // Track navigation events
  mainWindow.webContents.on('did-navigate', (event, url) => {
    console.log('[MAIN] Did navigate to:', url, 'at', new Date().toISOString())
  })

  mainWindow.webContents.on('did-navigate-in-page', (event, url) => {
    console.log('[MAIN] Did navigate in-page to:', url)
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    console.log('[MAIN] Will navigate to:', url)
  })

  // Track reload events
  mainWindow.webContents.on('devtools-reload-page', () => {
    console.log('[MAIN] DevTools triggered reload!')
  })

  // Spellcheck context menu - shows spelling suggestions on right-click
  mainWindow.webContents.on('context-menu', (event, params) => {
    const menuItems: Electron.MenuItemConstructorOptions[] = []

    // Add spelling suggestions if there's a misspelled word
    if (params.misspelledWord) {
      if (params.dictionarySuggestions.length > 0) {
        params.dictionarySuggestions.forEach((suggestion) => {
          menuItems.push({
            label: suggestion,
            click: () => mainWindow?.webContents.replaceMisspelling(suggestion)
          })
        })
        menuItems.push({ type: 'separator' })
      }

      menuItems.push({
        label: 'Add to Dictionary',
        click: () => mainWindow?.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
      })
      menuItems.push({ type: 'separator' })
    }

    // Standard edit operations
    if (params.isEditable) {
      menuItems.push(
        { label: 'Cut', role: 'cut', enabled: params.editFlags.canCut },
        { label: 'Copy', role: 'copy', enabled: params.editFlags.canCopy },
        { label: 'Paste', role: 'paste', enabled: params.editFlags.canPaste },
        { label: 'Select All', role: 'selectAll', enabled: params.editFlags.canSelectAll }
      )
    } else if (params.selectionText) {
      // If text is selected but not in editable field
      menuItems.push(
        { label: 'Copy', role: 'copy' }
      )
    }

    // Only show menu if there are items
    if (menuItems.length > 0) {
      const menu = Menu.buildFromTemplate(menuItems)
      menu.popup()
    }
  })
}


async function initializeApp() {
  console.log('Initializing application...')

  // Initialize base schemas first (creates tables if they don't exist)
  initializeSchema()
  initializeAuditSchema()

  // Run migrations (adds new columns/tables on top of base schema)
  const migrationResult = runMigrations()
  console.log('Migrations applied:', migrationResult.applied)
  console.log('Current schema version:', migrationResult.currentVersion)

  // Register IPC handlers
  registerIpcHandlers()
  registerUpdaterHandlers()

  // Clear any leftover decrypted temp files from previous sessions
  console.log('[MAIN] Clearing secure resources temp folder...')
  clearTempFolder()

  // Recover missed scheduled email instances (for days when app was closed)
  console.log('[MAIN] Checking for missed scheduled emails...')
  try {
    const missed = generateMissedInstances()
    if (missed.generated > 0) {
      console.log(`[MAIN] Generated ${missed.generated} missed scheduled email instances`)
      if (missed.missedDates.length > 0) {
        console.log(`[MAIN] Overdue dates: ${missed.missedDates.join(', ')}`)
      }
    }
  } catch (error) {
    console.error('[MAIN] Error generating missed scheduled email instances:', error)
  }

  // Log system startup
  logAudit('SYSTEM_STARTUP', null, null, 'system', null, {
    version: app.getVersion(),
    platform: process.platform
  })
}

app.whenReady().then(async () => {
  await initializeApp()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // Clear decrypted temp files before closing
  console.log('[MAIN] Clearing secure resources temp folder on shutdown...')
  clearTempFolder()

  // Log system shutdown
  logAudit('SYSTEM_SHUTDOWN', null, null, 'system', null, null)

  // Close database connections
  closeDatabase()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  // Clear decrypted temp files
  clearTempFolder()
  closeDatabase()
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error)
  logAudit('SYSTEM_SHUTDOWN', null, null, 'system', null, {
    reason: 'uncaught_exception',
    error: error.message
  })
})

// IPC handler to check if this is first run
ipcMain.handle('app:isFirstRun', () => {
  return !hasUsers()
})

// IPC handler for system notifications
ipcMain.handle('app:showNotification', (_event, title: string, body: string) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show()
  }
})

// IPC handler for getting app info
ipcMain.handle('app:getInfo', () => {
  return {
    version: app.getVersion(),
    platform: process.platform,
    isPackaged: app.isPackaged
  }
})

// IPC handler for setting window title
ipcMain.handle('app:setWindowTitle', (_event, title: string) => {
  if (mainWindow) {
    mainWindow.setTitle(title || 'Database')
  }
})

// Function to load and set window title from settings
function updateWindowTitleFromSettings() {
  try {
    const db = getDatabase()
    const result = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('department_name') as { value: string } | undefined
    const departmentName = result?.value?.trim()
    if (mainWindow) {
      mainWindow.setTitle(departmentName || 'Database')
    }
  } catch (error) {
    console.error('Error loading department name for window title:', error)
    if (mainWindow) {
      mainWindow.setTitle('Database')
    }
  }
}

// Default zoom factor (85%)
const DEFAULT_ZOOM = 0.85

// Function to apply zoom factor from settings
function applyZoomFactor() {
  if (!mainWindow) return

  try {
    const db = getDatabase()
    const result = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('zoom_factor') as { value: string } | undefined
    const zoomFactor = result?.value ? parseFloat(result.value) : DEFAULT_ZOOM
    mainWindow.webContents.setZoomFactor(zoomFactor)
  } catch (error) {
    console.error('Error applying zoom factor:', error)
    mainWindow.webContents.setZoomFactor(DEFAULT_ZOOM)
  }
}

// IPC handler for getting zoom factor
ipcMain.handle('app:getZoomFactor', () => {
  try {
    const db = getDatabase()
    const result = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('zoom_factor') as { value: string } | undefined
    return result?.value ? parseFloat(result.value) : DEFAULT_ZOOM
  } catch {
    return DEFAULT_ZOOM
  }
})

// IPC handler for setting zoom factor
ipcMain.handle('app:setZoomFactor', (_event, factor: number) => {
  if (!mainWindow) return { success: false, error: 'No window' }

  // Clamp between 50% and 150%
  const clampedFactor = Math.max(0.5, Math.min(1.5, factor))

  try {
    mainWindow.webContents.setZoomFactor(clampedFactor)

    const db = getDatabase()
    db.prepare(`
      INSERT INTO app_settings (key, value) VALUES ('zoom_factor', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(clampedFactor.toString())

    return { success: true, zoomFactor: clampedFactor }
  } catch (error: any) {
    console.error('Error setting zoom factor:', error)
    return { success: false, error: error.message }
  }
})

export { mainWindow, updateWindowTitleFromSettings }
