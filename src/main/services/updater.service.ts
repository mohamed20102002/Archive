import { app, ipcMain, dialog } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as yauzl from 'yauzl'

// Use original-fs to bypass Electron's asar handling when extracting update files
// eslint-disable-next-line @typescript-eslint/no-var-requires
const originalFs = require('original-fs') as typeof fs

// Manual portable updater - user imports ZIP file downloaded from GitHub

export function registerUpdaterHandlers(): void {
  // Get current app version
  ipcMain.handle('updater:getVersion', () => {
    return app.getVersion()
  })

  // Import update from ZIP file
  ipcMain.handle('updater:importZip', async () => {
    try {
      // Open file dialog to select ZIP
      const result = await dialog.showOpenDialog({
        title: 'Select Update ZIP File',
        filters: [{ name: 'ZIP Files', extensions: ['zip'] }],
        properties: ['openFile']
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'No file selected' }
      }

      const zipPath = result.filePaths[0]
      const appDir = path.dirname(app.getPath('exe'))
      const updateDir = path.join(appDir, '_update')
      const batchPath = path.join(appDir, '_update.bat')

      // Clean up any previous update folder
      if (fs.existsSync(updateDir)) {
        fs.rmSync(updateDir, { recursive: true, force: true })
      }
      fs.mkdirSync(updateDir, { recursive: true })

      // Extract ZIP to update folder
      await extractZip(zipPath, updateDir)

      // Find the actual app folder inside the extracted content
      // The ZIP might have nested folders like "release/win-unpacked/"
      const sourceDir = findAppFolder(updateDir)

      if (!sourceDir) {
        fs.rmSync(updateDir, { recursive: true, force: true })
        return { success: false, error: 'Invalid update ZIP - no executable found' }
      }

      // Create batch script to:
      // 1. Wait for app to close
      // 2. Copy new files (excluding data and emails folders)
      // 3. Restart the app
      const exeName = path.basename(app.getPath('exe'))

      // Use robocopy instead of xcopy - more reliable, built-in exclude support
      const batchContent = `@echo off
chcp 65001 >nul

REM Wait for app to close
ping 127.0.0.1 -n 5 >nul

REM Copy files using robocopy (excludes data, emails, _update folders)
robocopy "${sourceDir}" "${appDir}" /E /IS /IT /XD data emails _update /XF _update.bat _update.bat.exclude >nul

REM Start the updated app
start "" "${path.join(appDir, exeName)}"

REM Wait a moment then cleanup
ping 127.0.0.1 -n 2 >nul
rd /s /q "${updateDir}" 2>nul
del /f /q "${appDir}\\_update.vbs" 2>nul
del /f /q "%~f0" 2>nul
`

      // Write the batch file (robocopy handles exclusions internally)
      fs.writeFileSync(batchPath, batchContent)

      return {
        success: true,
        message: 'Update ready. Click "Apply Update" to restart and update.',
        sourceDir
      }

    } catch (error: any) {
      console.error('Update import failed:', error)
      return { success: false, error: error.message || 'Failed to import update' }
    }
  })

  // Apply the update (run batch and quit)
  ipcMain.handle('updater:applyUpdate', () => {
    const appDir = path.dirname(app.getPath('exe'))
    const batchPath = path.join(appDir, '_update.bat')

    if (!fs.existsSync(batchPath)) {
      return { success: false, error: 'No update prepared. Import a ZIP first.' }
    }

    // Create a VBS script to run batch completely hidden (most reliable method)
    const vbsPath = path.join(appDir, '_update.vbs')
    const vbsContent = `Set WshShell = CreateObject("WScript.Shell")
WshShell.Run chr(34) & "${batchPath.replace(/\\/g, '\\\\')}" & chr(34), 0
Set WshShell = Nothing`
    fs.writeFileSync(vbsPath, vbsContent)

    // Run the VBS script and quit
    const { spawn } = require('child_process')
    spawn('wscript.exe', [vbsPath], {
      detached: true,
      stdio: 'ignore',
      cwd: appDir,
      windowsHide: true
    }).unref()

    // Quit the app
    setTimeout(() => {
      app.quit()
    }, 500)

    return { success: true }
  })

  // Cancel/cleanup pending update
  ipcMain.handle('updater:cancelUpdate', () => {
    const appDir = path.dirname(app.getPath('exe'))
    const updateDir = path.join(appDir, '_update')
    const batchPath = path.join(appDir, '_update.bat')
    const vbsPath = path.join(appDir, '_update.vbs')

    try {
      if (fs.existsSync(updateDir)) {
        fs.rmSync(updateDir, { recursive: true, force: true })
      }
      if (fs.existsSync(batchPath)) {
        fs.unlinkSync(batchPath)
      }
      if (fs.existsSync(vbsPath)) {
        fs.unlinkSync(vbsPath)
      }
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Check if update is pending
  ipcMain.handle('updater:checkPending', () => {
    const appDir = path.dirname(app.getPath('exe'))
    const batchPath = path.join(appDir, '_update.bat')
    return { pending: fs.existsSync(batchPath) }
  })
}

// Extract ZIP file using yauzl
// Uses original-fs to bypass Electron's asar handling (otherwise app.asar files fail to extract)
function extractZip(zipPath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err || new Error('Failed to open ZIP'))
        return
      }

      zipfile.readEntry()

      zipfile.on('entry', (entry) => {
        const fullPath = path.join(destDir, entry.fileName)

        if (/\/$/.test(entry.fileName)) {
          // Directory - use original-fs to avoid asar issues
          originalFs.mkdirSync(fullPath, { recursive: true })
          zipfile.readEntry()
        } else {
          // File - use original-fs to avoid asar issues
          originalFs.mkdirSync(path.dirname(fullPath), { recursive: true })
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err || !readStream) {
              reject(err || new Error('Failed to read ZIP entry'))
              return
            }

            // Use original-fs.createWriteStream to write asar files correctly
            const writeStream = originalFs.createWriteStream(fullPath)
            readStream.pipe(writeStream)

            writeStream.on('close', () => {
              zipfile.readEntry()
            })

            writeStream.on('error', reject)
          })
        }
      })

      zipfile.on('end', resolve)
      zipfile.on('error', reject)
    })
  })
}

// Recursively find the folder containing the app executable
// Uses original-fs to avoid asar handling issues
function findAppFolder(dir: string): string | null {
  const exeName = path.basename(app.getPath('exe'))

  // Check if exe exists in current directory
  if (originalFs.existsSync(path.join(dir, exeName))) {
    return dir
  }

  // Check subdirectories
  try {
    const entries = originalFs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subDir = path.join(dir, entry.name)
        const result = findAppFolder(subDir)
        if (result) {
          return result
        }
      }
    }
  } catch (err) {
    console.error('Error searching for app folder:', err)
  }

  return null
}

// No auto-initialization needed for manual updater
export function initializeUpdater(): void {
  // Nothing to do - manual updates only
}
