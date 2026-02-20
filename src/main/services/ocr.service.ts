/**
 * OCR Service
 *
 * Provides Optical Character Recognition using Tesseract.js.
 * Extracts text from images and PDFs for indexing and search.
 */

import { createWorker, Worker, OEM, PSM } from 'tesseract.js'
import * as path from 'path'
import * as fs from 'fs'
import { getDatabase } from '../database/connection'
import { logAudit } from '../database/audit'

export interface OCRResult {
  text: string
  confidence: number
  words: OCRWord[]
  paragraphs: string[]
  language: string
  processingTime: number
}

export interface OCRWord {
  text: string
  confidence: number
  bbox: {
    x0: number
    y0: number
    x1: number
    y1: number
  }
}

export interface OCRProgress {
  status: string
  progress: number
}

export type OCRLanguage = 'eng' | 'ara' | 'rus' | 'eng+ara' | 'eng+rus' | 'ara+rus' | 'eng+ara+rus'

// Singleton worker instance
let workerInstance: Worker | null = null
let currentLanguage: OCRLanguage = 'eng'

/**
 * Initialize or get the Tesseract worker
 */
async function getWorker(language: OCRLanguage = 'eng'): Promise<Worker> {
  if (workerInstance && currentLanguage === language) {
    return workerInstance
  }

  // Terminate existing worker if language changed
  if (workerInstance) {
    await workerInstance.terminate()
    workerInstance = null
  }

  workerInstance = await createWorker(language, OEM.LSTM_ONLY, {
    logger: (m) => {
      // Log progress for debugging
      if (m.status === 'recognizing text') {
        console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`)
      }
    }
  })

  currentLanguage = language

  return workerInstance
}

/**
 * Perform OCR on an image file
 */
export async function recognizeImage(
  imagePath: string,
  language: OCRLanguage = 'eng',
  onProgress?: (progress: OCRProgress) => void
): Promise<OCRResult> {
  const startTime = Date.now()

  if (!fs.existsSync(imagePath)) {
    throw new Error(`File not found: ${imagePath}`)
  }

  const worker = await getWorker(language)

  // Set page segmentation mode for better accuracy
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO
  })

  const { data } = await worker.recognize(imagePath)

  const words: OCRWord[] = data.words.map(word => ({
    text: word.text,
    confidence: word.confidence,
    bbox: word.bbox
  }))

  // Split text into paragraphs
  const paragraphs = data.text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0)

  const result: OCRResult = {
    text: data.text,
    confidence: data.confidence,
    words,
    paragraphs,
    language,
    processingTime: Date.now() - startTime
  }

  return result
}

/**
 * Perform OCR on multiple images (e.g., PDF pages)
 */
export async function recognizeImages(
  imagePaths: string[],
  language: OCRLanguage = 'eng',
  onProgress?: (current: number, total: number) => void
): Promise<OCRResult[]> {
  const results: OCRResult[] = []

  for (let i = 0; i < imagePaths.length; i++) {
    const result = await recognizeImage(imagePaths[i], language)
    results.push(result)

    if (onProgress) {
      onProgress(i + 1, imagePaths.length)
    }
  }

  return results
}

/**
 * Extract and index text from an attachment
 */
export async function extractAndIndexText(
  attachmentId: string,
  attachmentType: 'record_attachment' | 'letter_attachment',
  filePath: string,
  language: OCRLanguage = 'eng',
  userId: string | null
): Promise<{ success: boolean; text?: string; error?: string }> {
  const db = getDatabase()

  try {
    // Check if file is an image
    const ext = path.extname(filePath).toLowerCase()
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.tif', '.webp']

    if (!imageExtensions.includes(ext)) {
      return { success: false, error: 'File is not a supported image format' }
    }

    const result = await recognizeImage(filePath, language)

    // Store extracted text in database
    db.prepare(`
      INSERT OR REPLACE INTO ocr_extracted_text (
        attachment_id, attachment_type, extracted_text, confidence, language, extracted_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(attachmentId, attachmentType, result.text, result.confidence, language)

    logAudit({
      action: 'OCR_EXTRACT',
      entityType: attachmentType,
      entityId: attachmentId,
      userId,
      details: {
        confidence: result.confidence,
        language,
        textLength: result.text.length,
        processingTime: result.processingTime
      }
    })

    return { success: true, text: result.text }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OCR extraction failed'
    return { success: false, error: message }
  }
}

/**
 * Get extracted text for an attachment
 */
export function getExtractedText(
  attachmentId: string
): { text: string; confidence: number; language: string; extractedAt: string } | null {
  const db = getDatabase()

  const row = db.prepare(`
    SELECT extracted_text, confidence, language, extracted_at
    FROM ocr_extracted_text
    WHERE attachment_id = ?
  `).get(attachmentId) as {
    extracted_text: string
    confidence: number
    language: string
    extracted_at: string
  } | undefined

  if (!row) return null

  return {
    text: row.extracted_text,
    confidence: row.confidence,
    language: row.language,
    extractedAt: row.extracted_at
  }
}

/**
 * Search through OCR extracted text
 */
export function searchExtractedText(
  query: string,
  attachmentType?: 'record_attachment' | 'letter_attachment',
  limit: number = 50
): Array<{
  attachmentId: string
  attachmentType: string
  matchedText: string
  confidence: number
}> {
  const db = getDatabase()

  let sql = `
    SELECT attachment_id, attachment_type, extracted_text, confidence
    FROM ocr_extracted_text
    WHERE extracted_text LIKE ?
  `
  const params: unknown[] = [`%${query}%`]

  if (attachmentType) {
    sql += ' AND attachment_type = ?'
    params.push(attachmentType)
  }

  sql += ' ORDER BY confidence DESC LIMIT ?'
  params.push(limit)

  const rows = db.prepare(sql).all(...params) as Array<{
    attachment_id: string
    attachment_type: string
    extracted_text: string
    confidence: number
  }>

  return rows.map(row => {
    // Extract a snippet around the match
    const lowerText = row.extracted_text.toLowerCase()
    const lowerQuery = query.toLowerCase()
    const matchIndex = lowerText.indexOf(lowerQuery)
    const snippetStart = Math.max(0, matchIndex - 50)
    const snippetEnd = Math.min(row.extracted_text.length, matchIndex + query.length + 50)
    const matchedText = row.extracted_text.substring(snippetStart, snippetEnd)

    return {
      attachmentId: row.attachment_id,
      attachmentType: row.attachment_type,
      matchedText: (snippetStart > 0 ? '...' : '') + matchedText + (snippetEnd < row.extracted_text.length ? '...' : ''),
      confidence: row.confidence
    }
  })
}

/**
 * Delete extracted text for an attachment
 */
export function deleteExtractedText(attachmentId: string): boolean {
  const db = getDatabase()

  const result = db.prepare(`
    DELETE FROM ocr_extracted_text WHERE attachment_id = ?
  `).run(attachmentId)

  return result.changes > 0
}

/**
 * Get OCR statistics
 */
export function getOCRStats(): {
  totalExtracted: number
  byType: Record<string, number>
  averageConfidence: number
  totalTextLength: number
} {
  const db = getDatabase()

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      AVG(confidence) as avgConfidence,
      SUM(LENGTH(extracted_text)) as totalLength
    FROM ocr_extracted_text
  `).get() as { total: number; avgConfidence: number | null; totalLength: number | null }

  const byType = db.prepare(`
    SELECT attachment_type, COUNT(*) as count
    FROM ocr_extracted_text
    GROUP BY attachment_type
  `).all() as Array<{ attachment_type: string; count: number }>

  return {
    totalExtracted: stats.total,
    byType: Object.fromEntries(byType.map(r => [r.attachment_type, r.count])),
    averageConfidence: stats.avgConfidence || 0,
    totalTextLength: stats.totalLength || 0
  }
}

/**
 * Terminate the worker when done
 */
export async function terminateWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.terminate()
    workerInstance = null
  }
}

export default {
  recognizeImage,
  recognizeImages,
  extractAndIndexText,
  getExtractedText,
  searchExtractedText,
  deleteExtractedText,
  getOCRStats,
  terminateWorker
}
