import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

/**
 * Get the base path for the application data
 * In development, uses project root
 * In production, uses the directory containing the executable
 */
export function getBasePath(): string {
  return app.isPackaged
    ? path.dirname(app.getPath('exe'))
    : process.cwd()
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

/**
 * Safely join path segments, preventing path traversal attacks
 */
export function safePath(basePath: string, ...segments: string[]): string {
  const joined = path.join(basePath, ...segments)
  const resolved = path.resolve(joined)
  const resolvedBase = path.resolve(basePath)

  // Ensure the resolved path is within the base path
  if (!resolved.startsWith(resolvedBase)) {
    throw new Error('Path traversal attempt detected')
  }

  return resolved
}

/**
 * Check if a file exists
 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath)
  } catch {
    return false
  }
}

/**
 * Read a file safely
 */
export function readFile(filePath: string, encoding: BufferEncoding = 'utf-8'): string | null {
  try {
    return fs.readFileSync(filePath, encoding)
  } catch {
    return null
  }
}

/**
 * Write a file safely
 */
export function writeFile(filePath: string, content: string | Buffer): boolean {
  try {
    const dir = path.dirname(filePath)
    ensureDirectory(dir)
    fs.writeFileSync(filePath, content)
    return true
  } catch (error) {
    console.error('Error writing file:', error)
    return false
  }
}

/**
 * Delete a file safely
 */
export function deleteFile(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    return true
  } catch (error) {
    console.error('Error deleting file:', error)
    return false
  }
}

/**
 * Delete a directory and its contents
 */
export function deleteDirectory(dirPath: string): boolean {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true })
    }
    return true
  } catch (error) {
    console.error('Error deleting directory:', error)
    return false
  }
}

/**
 * Copy a file
 */
export function copyFile(source: string, destination: string): boolean {
  try {
    const dir = path.dirname(destination)
    ensureDirectory(dir)
    fs.copyFileSync(source, destination)
    return true
  } catch (error) {
    console.error('Error copying file:', error)
    return false
  }
}

/**
 * Get file stats
 */
export function getFileStats(filePath: string): fs.Stats | null {
  try {
    return fs.statSync(filePath)
  } catch {
    return null
  }
}

/**
 * Get file size in bytes
 */
export function getFileSize(filePath: string): number {
  const stats = getFileStats(filePath)
  return stats?.size || 0
}

/**
 * List files in a directory
 */
export function listFiles(dirPath: string): string[] {
  try {
    if (!fs.existsSync(dirPath)) {
      return []
    }
    return fs.readdirSync(dirPath)
  } catch {
    return []
  }
}

/**
 * List files recursively
 */
export function listFilesRecursive(dirPath: string): string[] {
  const files: string[] = []

  function walk(currentPath: string): void {
    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name)

        if (entry.isDirectory()) {
          walk(fullPath)
        } else {
          files.push(fullPath)
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  walk(dirPath)
  return files
}

/**
 * Get the mime type based on file extension
 */
export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()

  const mimeTypes: Record<string, string> = {
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.7z': 'application/x-7z-compressed',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.msg': 'application/vnd.ms-outlook',
    '.eml': 'message/rfc822'
  }

  return mimeTypes[ext] || 'application/octet-stream'
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`
}

/**
 * Create a date-based folder structure
 */
export function createDateFolder(basePath: string, date: Date = new Date()): string {
  const year = date.getFullYear().toString()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')

  const folderPath = path.join(basePath, year, month, day)
  ensureDirectory(folderPath)

  return folderPath
}

/**
 * Sanitize a filename to remove invalid characters
 */
export function sanitizeFilename(filename: string): string {
  // Remove or replace invalid characters
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 255) // Max filename length on most systems
}
