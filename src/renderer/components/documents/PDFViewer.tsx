/**
 * PDF Viewer Component
 *
 * Displays PDF documents with zoom, pan, and page navigation controls.
 * Uses pdf.js for rendering.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import * as pdfjsLib from 'pdfjs-dist'

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

interface PDFViewerProps {
  /** PDF file path or URL */
  src: string
  /** Initial zoom level (1 = 100%) */
  initialZoom?: number
  /** Initial page number */
  initialPage?: number
  /** Show toolbar */
  showToolbar?: boolean
  /** Show page thumbnails sidebar */
  showThumbnails?: boolean
  /** Allow signature placement */
  enableSignatures?: boolean
  /** Callback when page changes */
  onPageChange?: (page: number, total: number) => void
  /** Callback when zoom changes */
  onZoomChange?: (zoom: number) => void
  /** Additional class names */
  className?: string
}

interface PageDimensions {
  width: number
  height: number
}

export function PDFViewer({
  src,
  initialZoom = 1,
  initialPage = 1,
  showToolbar = true,
  showThumbnails = false,
  enableSignatures = false,
  onPageChange,
  onZoomChange,
  className = ''
}: PDFViewerProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [totalPages, setTotalPages] = useState(0)
  const [zoom, setZoom] = useState(initialZoom)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pageDimensions, setPageDimensions] = useState<PageDimensions>({ width: 0, height: 0 })

  // Pan state
  const [isPanning, setIsPanning] = useState(false)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 })

  // Zoom presets
  const zoomPresets = [0.5, 0.75, 1, 1.25, 1.5, 2, 3]

  // Load PDF document
  useEffect(() => {
    let cancelled = false

    async function loadPDF() {
      setLoading(true)
      setError(null)

      try {
        const loadingTask = pdfjsLib.getDocument(src)
        const pdf = await loadingTask.promise

        if (cancelled) return

        setPdfDoc(pdf)
        setTotalPages(pdf.numPages)
        setCurrentPage(Math.min(initialPage, pdf.numPages))
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load PDF:', err)
        setError(err instanceof Error ? err.message : 'Failed to load PDF')
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadPDF()

    return () => {
      cancelled = true
    }
  }, [src, initialPage])

  // Render current page
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return

    try {
      const page = await pdfDoc.getPage(currentPage)
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')

      if (!context) return

      // Calculate scale based on zoom and device pixel ratio
      const pixelRatio = window.devicePixelRatio || 1
      const viewport = page.getViewport({ scale: zoom * pixelRatio })

      // Set canvas dimensions
      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = `${viewport.width / pixelRatio}px`
      canvas.style.height = `${viewport.height / pixelRatio}px`

      setPageDimensions({
        width: viewport.width / pixelRatio,
        height: viewport.height / pixelRatio
      })

      // Render page
      await page.render({
        canvasContext: context,
        viewport
      }).promise

      // Notify parent of page change
      if (onPageChange) {
        onPageChange(currentPage, totalPages)
      }
    } catch (err) {
      console.error('Failed to render page:', err)
    }
  }, [pdfDoc, currentPage, zoom, totalPages, onPageChange])

  useEffect(() => {
    renderPage()
  }, [renderPage])

  // Handle zoom change
  const handleZoomChange = (newZoom: number) => {
    const clampedZoom = Math.max(0.25, Math.min(5, newZoom))
    setZoom(clampedZoom)
    setPanOffset({ x: 0, y: 0 })
    if (onZoomChange) {
      onZoomChange(clampedZoom)
    }
  }

  // Handle page navigation
  const goToPage = (page: number) => {
    const newPage = Math.max(1, Math.min(totalPages, page))
    setCurrentPage(newPage)
    setPanOffset({ x: 0, y: 0 })
  }

  // Handle mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      handleZoomChange(zoom + delta)
    }
  }, [zoom])

  // Handle pan start
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && (zoom > 1 || e.altKey)) {
      setIsPanning(true)
      setLastPanPoint({ x: e.clientX, y: e.clientY })
    }
  }

  // Handle pan move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastPanPoint.x
      const dy = e.clientY - lastPanPoint.y
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }))
      setLastPanPoint({ x: e.clientX, y: e.clientY })
    }
  }

  // Handle pan end
  const handleMouseUp = () => {
    setIsPanning(false)
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return

      switch (e.key) {
        case 'ArrowLeft':
        case 'PageUp':
          goToPage(currentPage - 1)
          break
        case 'ArrowRight':
        case 'PageDown':
          goToPage(currentPage + 1)
          break
        case 'Home':
          goToPage(1)
          break
        case 'End':
          goToPage(totalPages)
          break
        case '+':
        case '=':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            handleZoomChange(zoom + 0.25)
          }
          break
        case '-':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            handleZoomChange(zoom - 0.25)
          }
          break
        case '0':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            handleZoomChange(1)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentPage, totalPages, zoom])

  // Fit to width
  const fitToWidth = () => {
    if (!containerRef.current || !pageDimensions.width) return
    const containerWidth = containerRef.current.clientWidth - 48 // Account for padding
    const newZoom = containerWidth / (pageDimensions.width / zoom)
    handleZoomChange(newZoom)
  }

  // Fit to page
  const fitToPage = () => {
    if (!containerRef.current || !pageDimensions.width || !pageDimensions.height) return
    const containerWidth = containerRef.current.clientWidth - 48
    const containerHeight = containerRef.current.clientHeight - 48
    const scaleX = containerWidth / (pageDimensions.width / zoom)
    const scaleY = containerHeight / (pageDimensions.height / zoom)
    handleZoomChange(Math.min(scaleX, scaleY))
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('pdf.loading', 'Loading PDF...')}
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      {showToolbar && (
        <div className="flex items-center justify-between gap-4 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          {/* Page navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
              title={t('pdf.firstPage', 'First page')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
              title={t('pdf.previousPage', 'Previous page')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex items-center gap-1 text-sm">
              <input
                type="number"
                min={1}
                max={totalPages}
                value={currentPage}
                onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                className="w-12 px-1.5 py-0.5 text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              />
              <span className="text-gray-500 dark:text-gray-400">
                / {totalPages}
              </span>
            </div>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
              title={t('pdf.nextPage', 'Next page')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
              title={t('pdf.lastPage', 'Last page')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleZoomChange(zoom - 0.25)}
              disabled={zoom <= 0.25}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
              title={t('pdf.zoomOut', 'Zoom out')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>

            <select
              value={zoom}
              onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
              className="px-2 py-0.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            >
              {zoomPresets.map(preset => (
                <option key={preset} value={preset}>
                  {Math.round(preset * 100)}%
                </option>
              ))}
            </select>

            <button
              onClick={() => handleZoomChange(zoom + 0.25)}
              disabled={zoom >= 5}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
              title={t('pdf.zoomIn', 'Zoom in')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>

            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

            <button
              onClick={fitToWidth}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              title={t('pdf.fitWidth', 'Fit to width')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>

            <button
              onClick={fitToPage}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              title={t('pdf.fitPage', 'Fit to page')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
              </svg>
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {enableSignatures && (
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                {t('pdf.addSignature', 'Add Signature')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* PDF canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isPanning ? 'grabbing' : zoom > 1 ? 'grab' : 'default' }}
      >
        <div
          className="flex items-center justify-center min-h-full p-6"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px)`
          }}
        >
          <canvas
            ref={canvasRef}
            className="shadow-lg bg-white"
          />
        </div>
      </div>
    </div>
  )
}

/**
 * PDF Preview Modal
 */
export function PDFPreviewModal({
  src,
  title,
  isOpen,
  onClose
}: {
  src: string
  title?: string
  isOpen: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl h-[90vh] bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            {title || t('pdf.preview', 'PDF Preview')}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 overflow-hidden">
          <PDFViewer src={src} showToolbar showThumbnails={false} />
        </div>
      </div>
    </div>
  )
}

export default PDFViewer
