import { app, BrowserWindow, ipcMain, Notification } from 'electron'
import * as path from 'path'
import { initializeSchema, hasUsers } from './database/schema'
import { initializeAuditSchema, logAudit } from './database/audit'
import { runMigrations } from './database/migrations'
import { closeDatabase } from './database/connection'
import { registerIpcHandlers } from './ipc/handlers'

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

export { mainWindow }
