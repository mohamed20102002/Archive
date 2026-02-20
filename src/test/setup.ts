/**
 * Vitest global setup file
 * This file runs before each test file
 */

import '@testing-library/jest-dom'
import { vi, beforeAll, afterAll, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Mock Electron APIs
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      const paths: Record<string, string> = {
        userData: '/mock/userData',
        appData: '/mock/appData',
        documents: '/mock/documents',
        temp: '/mock/temp'
      }
      return paths[name] || '/mock/' + name
    }),
    getVersion: vi.fn(() => '1.0.0-test'),
    isPackaged: false,
    quit: vi.fn(),
    whenReady: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    getName: vi.fn(() => 'Project Data Archiving System')
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn()
  },
  ipcRenderer: {
    invoke: vi.fn(),
    send: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn()
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadFile: vi.fn(),
    loadURL: vi.fn(),
    webContents: {
      send: vi.fn(),
      openDevTools: vi.fn()
    },
    on: vi.fn(),
    close: vi.fn(),
    show: vi.fn()
  })),
  dialog: {
    showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] })),
    showSaveDialog: vi.fn(() => Promise.resolve({ canceled: true })),
    showMessageBox: vi.fn(() => Promise.resolve({ response: 0 }))
  },
  shell: {
    openPath: vi.fn(),
    showItemInFolder: vi.fn(),
    openExternal: vi.fn()
  },
  contextBridge: {
    exposeInMainWorld: vi.fn()
  },
  Notification: vi.fn()
}))

// Mock window.electronAPI for renderer tests
const mockElectronAPI = {
  app: {
    isFirstRun: vi.fn(() => Promise.resolve(false)),
    showNotification: vi.fn(() => Promise.resolve()),
    getInfo: vi.fn(() => Promise.resolve({ version: '1.0.0', platform: 'win32', isPackaged: false })),
    setWindowTitle: vi.fn(() => Promise.resolve()),
    getZoomFactor: vi.fn(() => Promise.resolve(1)),
    setZoomFactor: vi.fn(() => Promise.resolve({ success: true }))
  },
  auth: {
    login: vi.fn(),
    logout: vi.fn(),
    verifyToken: vi.fn(() => Promise.resolve({ valid: true })),
    hasAdminUser: vi.fn(() => Promise.resolve(true))
  },
  topics: {
    create: vi.fn(),
    getAll: vi.fn(() => Promise.resolve([])),
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  records: {
    create: vi.fn(),
    getByTopic: vi.fn(() => Promise.resolve([])),
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  letters: {
    create: vi.fn(),
    getAll: vi.fn(() => Promise.resolve([])),
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  issues: {
    create: vi.fn(),
    getOpen: vi.fn(() => Promise.resolve([])),
    getById: vi.fn(),
    update: vi.fn(),
    close: vi.fn()
  },
  moms: {
    create: vi.fn(),
    getAll: vi.fn(() => Promise.resolve([])),
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  settings: {
    get: vi.fn(),
    getAll: vi.fn(() => Promise.resolve({})),
    update: vi.fn()
  },
  audit: {
    getLog: vi.fn(() => Promise.resolve([])),
    verifyIntegrity: vi.fn(() => Promise.resolve({ valid: true }))
  },
  backup: {
    create: vi.fn(),
    restore: vi.fn(),
    getStatus: vi.fn(() => Promise.resolve({ lastBackup: null }))
  },
  health: {
    runChecks: vi.fn(() => Promise.resolve({
      overall: 'healthy',
      checks: [],
      summary: { healthy: 7, warning: 0, critical: 0 },
      timestamp: new Date().toISOString()
    })),
    getMetrics: vi.fn(),
    getLastStatus: vi.fn()
  },
  integrity: {
    check: vi.fn(() => Promise.resolve({
      valid: true,
      checks: [],
      totalChecks: 8,
      passedChecks: 8,
      failedChecks: 0,
      timestamp: new Date().toISOString()
    }))
  }
}

// Assign to window
Object.defineProperty(global, 'window', {
  value: {
    ...global.window,
    electronAPI: mockElectronAPI,
    matchMedia: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    })),
    scrollTo: vi.fn(),
    location: {
      ...global.window?.location,
      reload: vi.fn()
    }
  },
  writable: true
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
}
Object.defineProperty(global, 'localStorage', { value: localStorageMock })

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
}
Object.defineProperty(global, 'sessionStorage', { value: sessionStorageMock })

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: []
}))

// Cleanup after each test
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Global beforeAll - setup test database if needed
beforeAll(async () => {
  // Can be used to initialize test database
})

// Global afterAll - cleanup
afterAll(async () => {
  // Can be used to close database connections
})

// Export mock for use in tests
export { mockElectronAPI }
