import { app, BrowserWindow, ipcMain, Notification } from 'electron'
import * as path from 'path'
import { initializeLogger } from './services/logger.service'
import { initializeSchema, hasUsers } from './database/schema'
import { initializeAuditSchema, logAudit } from './database/audit'
import { runMigrations } from './database/migrations'
import { closeDatabase, getDatabase } from './database/connection'
import { registerIpcHandlers } from './ipc/handlers'

// Initialize logger before anything else
initializeLogger()

let mainWindow: BrowserWindow | null = null

function createWindow() {
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
      sandbox: false
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
  // Log system shutdown
  logAudit('SYSTEM_SHUTDOWN', null, null, 'system', null, null)

  // Close database connections
  closeDatabase()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
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
