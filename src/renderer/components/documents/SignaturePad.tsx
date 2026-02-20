/**
 * Signature Pad Component
 *
 * Allows users to draw signatures, upload images, or add stamps.
 * Manages signature storage and selection.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

interface Signature {
  id: string
  user_id: string
  name: string
  type: 'signature' | 'stamp' | 'initials'
  image_data: string
  width: number
  height: number
  is_default: boolean
  created_at: string
  updated_at: string
}

interface SignaturePadProps {
  /** Current user ID */
  userId: string
  /** Called when signature is created */
  onSave?: (signature: Signature) => void
  /** Called when signature is selected */
  onSelect?: (signature: Signature) => void
  /** Show saved signatures */
  showSaved?: boolean
  /** Default signature type */
  defaultType?: 'signature' | 'stamp' | 'initials'
  /** Additional class names */
  className?: string
}

export function SignaturePad({
  userId,
  onSave,
  onSelect,
  showSaved = true,
  defaultType = 'signature',
  className = ''
}: SignaturePadProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [signatureType, setSignatureType] = useState<'signature' | 'stamp' | 'initials'>(defaultType)
  const [signatureName, setSignatureName] = useState('')
  const [setAsDefault, setSetAsDefault] = useState(false)
  const [penColor, setPenColor] = useState('#000000')
  const [penWidth, setPenWidth] = useState(2)
  const [savedSignatures, setSavedSignatures] = useState<Signature[]>([])
  const [activeTab, setActiveTab] = useState<'draw' | 'saved'>('draw')
  const [saving, setSaving] = useState(false)

  // Load saved signatures
  useEffect(() => {
    if (showSaved) {
      loadSignatures()
    }
  }, [userId, showSaved])

  const loadSignatures = async () => {
    try {
      const sigs = await window.electronAPI.signatures.getAll(userId)
      setSavedSignatures(sigs)
    } catch (err) {
      console.error('Failed to load signatures:', err)
    }
  }

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const container = containerRef.current
    if (container) {
      canvas.width = container.clientWidth
      canvas.height = 200
    }

    // Set drawing styles
    ctx.strokeStyle = penColor
    ctx.lineWidth = penWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // White background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [penColor, penWidth])

  // Drawing handlers
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return

    setIsDrawing(true)
    setHasDrawn(true)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const point = getEventPoint(e, canvas)
    ctx.beginPath()
    ctx.moveTo(point.x, point.y)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const point = getEventPoint(e, canvas)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const getEventPoint = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()

    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      }
    }

    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  // Clear canvas
  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  // Save signature
  const saveSignature = async () => {
    const canvas = canvasRef.current
    if (!canvas || !hasDrawn || !signatureName.trim()) return

    setSaving(true)
    try {
      const imageData = canvas.toDataURL('image/png')

      const signature = await window.electronAPI.signatures.create({
        user_id: userId,
        name: signatureName.trim(),
        type: signatureType,
        image_data: imageData,
        width: canvas.width,
        height: canvas.height,
        is_default: setAsDefault
      })

      if (onSave) {
        onSave(signature)
      }

      // Refresh list
      loadSignatures()

      // Reset form
      clearCanvas()
      setSignatureName('')
      setSetAsDefault(false)
    } catch (err) {
      console.error('Failed to save signature:', err)
    } finally {
      setSaving(false)
    }
  }

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const imageData = event.target?.result as string

      // Draw on canvas for preview
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const img = new Image()
          img.onload = () => {
            // Clear and draw
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            // Scale to fit
            const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
            const x = (canvas.width - img.width * scale) / 2
            const y = (canvas.height - img.height * scale) / 2

            ctx.drawImage(img, x, y, img.width * scale, img.height * scale)
            setHasDrawn(true)
          }
          img.src = imageData
        }
      }
    }
    reader.readAsDataURL(file)
  }

  // Delete signature
  const deleteSignature = async (id: string) => {
    try {
      await window.electronAPI.signatures.delete(id, userId)
      loadSignatures()
    } catch (err) {
      console.error('Failed to delete signature:', err)
    }
  }

  // Set as default
  const setDefault = async (signature: Signature) => {
    try {
      await window.electronAPI.signatures.update(signature.id, { is_default: true }, userId)
      loadSignatures()
    } catch (err) {
      console.error('Failed to set default:', err)
    }
  }

  return (
    <div className={className}>
      {/* Tabs */}
      {showSaved && (
        <div className="flex gap-1 mb-4">
          <button
            onClick={() => setActiveTab('draw')}
            className={`
              px-4 py-2 text-sm font-medium rounded-lg
              ${activeTab === 'draw'
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }
            `}
          >
            {t('signature.draw', 'Draw New')}
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`
              px-4 py-2 text-sm font-medium rounded-lg
              ${activeTab === 'saved'
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }
            `}
          >
            {t('signature.saved', 'Saved')} ({savedSignatures.length})
          </button>
        </div>
      )}

      {activeTab === 'draw' ? (
        <>
          {/* Type selector */}
          <div className="flex gap-2 mb-4">
            {(['signature', 'initials', 'stamp'] as const).map(type => (
              <button
                key={type}
                onClick={() => setSignatureType(type)}
                className={`
                  px-3 py-1.5 text-sm rounded-lg border
                  ${signatureType === type
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                  }
                `}
              >
                {type === 'signature' && t('signature.typeSignature', 'Signature')}
                {type === 'initials' && t('signature.typeInitials', 'Initials')}
                {type === 'stamp' && t('signature.typeStamp', 'Stamp')}
              </button>
            ))}
          </div>

          {/* Drawing canvas */}
          <div
            ref={containerRef}
            className="relative border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden"
          >
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="cursor-crosshair touch-none"
            />

            {!hasDrawn && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-gray-400 dark:text-gray-500">
                  {t('signature.drawHere', 'Draw your signature here')}
                </p>
              </div>
            )}
          </div>

          {/* Drawing tools */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 dark:text-gray-400">
                  {t('signature.color', 'Color')}:
                </label>
                <input
                  type="color"
                  value={penColor}
                  onChange={(e) => setPenColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 dark:text-gray-400">
                  {t('signature.thickness', 'Thickness')}:
                </label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={penWidth}
                  onChange={(e) => setPenWidth(parseInt(e.target.value))}
                  className="w-20"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 cursor-pointer">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {t('signature.uploadImage', 'Upload Image')}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>

              <button
                onClick={clearCanvas}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800"
              >
                {t('common.clear', 'Clear')}
              </button>
            </div>
          </div>

          {/* Save form */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('signature.name', 'Signature Name')}
                </label>
                <input
                  type="text"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  placeholder={t('signature.namePlaceholder', 'e.g., My Official Signature')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                />
              </div>

              <label className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={setAsDefault}
                  onChange={(e) => setSetAsDefault(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t('signature.setDefault', 'Set as default')}
                </span>
              </label>

              <button
                onClick={saveSignature}
                disabled={!hasDrawn || !signatureName.trim() || saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Saved signatures list */
        <div className="space-y-3">
          {savedSignatures.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('signature.noSaved', 'No saved signatures yet')}
              </p>
            </div>
          ) : (
            savedSignatures.map(sig => (
              <div
                key={sig.id}
                className={`
                  flex items-center gap-4 p-3 rounded-lg border cursor-pointer
                  ${sig.is_default
                    ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }
                `}
                onClick={() => onSelect?.(sig)}
              >
                {/* Preview */}
                <div className="w-24 h-16 bg-white border border-gray-200 rounded flex items-center justify-center overflow-hidden">
                  <img
                    src={sig.image_data}
                    alt={sig.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {sig.name}
                    </span>
                    {sig.is_default && (
                      <span className="px-1.5 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded">
                        {t('signature.default', 'Default')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {sig.type === 'signature' && t('signature.typeSignature', 'Signature')}
                    {sig.type === 'initials' && t('signature.typeInitials', 'Initials')}
                    {sig.type === 'stamp' && t('signature.typeStamp', 'Stamp')}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {!sig.is_default && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setDefault(sig)
                      }}
                      className="p-1.5 text-gray-400 hover:text-primary-600"
                      title={t('signature.setDefault', 'Set as default')}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteSignature(sig.id)
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-600"
                    title={t('common.delete', 'Delete')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Signature selector modal
 */
export function SignatureSelectorModal({
  userId,
  isOpen,
  onClose,
  onSelect
}: {
  userId: string
  isOpen: boolean
  onClose: () => void
  onSelect: (signature: Signature) => void
}) {
  const { t } = useTranslation()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('signature.selectTitle', 'Select or Create Signature')}
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

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <SignaturePad
            userId={userId}
            onSave={onSelect}
            onSelect={onSelect}
            showSaved
          />
        </div>
      </div>
    </div>
  )
}

export default SignaturePad
