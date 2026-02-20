/**
 * Progress Indicator Components
 *
 * Provides visual feedback for long-running operations like
 * file uploads, imports, exports, and backup/restore.
 */

import React from 'react'
import { useTranslation } from 'react-i18next'

interface ProgressBarProps {
  /** Progress value from 0 to 100 */
  value: number
  /** Maximum value (default 100) */
  max?: number
  /** Show percentage text */
  showPercentage?: boolean
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Color variant */
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'info'
  /** Whether progress is indeterminate */
  indeterminate?: boolean
  /** Additional class names */
  className?: string
  /** Label text */
  label?: string
  /** Show striped animation */
  striped?: boolean
  /** Animate stripes */
  animated?: boolean
}

/**
 * Linear progress bar component
 */
export function ProgressBar({
  value,
  max = 100,
  showPercentage = false,
  size = 'md',
  variant = 'primary',
  indeterminate = false,
  className = '',
  label,
  striped = false,
  animated = false
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  }

  const variantClasses = {
    primary: 'bg-primary-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    info: 'bg-blue-500'
  }

  return (
    <div className={className}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-1">
          {label && (
            <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
          )}
          {showPercentage && !indeterminate && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div
        className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${sizeClasses[size]}`}
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : percentage}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`
            h-full rounded-full transition-all duration-300 ease-out
            ${variantClasses[variant]}
            ${indeterminate ? 'animate-progress-indeterminate w-1/3' : ''}
            ${striped ? 'bg-stripes' : ''}
            ${animated && striped ? 'animate-stripes' : ''}
          `}
          style={indeterminate ? undefined : { width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

interface CircularProgressProps {
  /** Progress value from 0 to 100 */
  value: number
  /** Size in pixels */
  size?: number
  /** Stroke width */
  strokeWidth?: number
  /** Color variant */
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'info'
  /** Whether progress is indeterminate */
  indeterminate?: boolean
  /** Show percentage in center */
  showPercentage?: boolean
  /** Additional class names */
  className?: string
}

/**
 * Circular progress indicator
 */
export function CircularProgress({
  value,
  size = 40,
  strokeWidth = 4,
  variant = 'primary',
  indeterminate = false,
  showPercentage = false,
  className = ''
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const percentage = Math.min(100, Math.max(0, value))
  const offset = circumference - (percentage / 100) * circumference

  const variantClasses = {
    primary: 'text-primary-500',
    success: 'text-green-500',
    warning: 'text-yellow-500',
    error: 'text-red-500',
    info: 'text-blue-500'
  }

  return (
    <div className={`relative inline-flex ${className}`} style={{ width: size, height: size }}>
      <svg
        className={`transform -rotate-90 ${indeterminate ? 'animate-spin' : ''}`}
        width={size}
        height={size}
      >
        {/* Background circle */}
        <circle
          className="text-gray-200 dark:text-gray-700"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress circle */}
        <circle
          className={`transition-all duration-300 ease-out ${variantClasses[variant]}`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={indeterminate ? circumference * 0.75 : offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      {showPercentage && !indeterminate && (
        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700 dark:text-gray-300">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  )
}

interface FileUploadProgressProps {
  /** File name */
  fileName: string
  /** File size in bytes */
  fileSize?: number
  /** Progress value from 0 to 100 */
  progress: number
  /** Upload status */
  status: 'uploading' | 'processing' | 'complete' | 'error'
  /** Error message if status is error */
  error?: string
  /** Called when cancel is clicked */
  onCancel?: () => void
  /** Called when retry is clicked */
  onRetry?: () => void
  /** Additional class names */
  className?: string
}

/**
 * File upload progress component
 */
export function FileUploadProgress({
  fileName,
  fileSize,
  progress,
  status,
  error,
  onCancel,
  onRetry,
  className = ''
}: FileUploadProgressProps) {
  const { t } = useTranslation()

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const statusConfig = {
    uploading: {
      icon: (
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      ),
      text: t('progress.uploading', 'Uploading...'),
      color: 'text-primary-600 dark:text-primary-400'
    },
    processing: {
      icon: (
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      ),
      text: t('progress.processing', 'Processing...'),
      color: 'text-blue-600 dark:text-blue-400'
    },
    complete: {
      icon: (
        <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
      text: t('progress.complete', 'Complete'),
      color: 'text-green-600 dark:text-green-400'
    },
    error: {
      icon: (
        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
      text: error || t('progress.error', 'Failed'),
      color: 'text-red-600 dark:text-red-400'
    }
  }

  const config = statusConfig[status]

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">{config.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {fileName}
            </p>
            {fileSize && (
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                {formatFileSize(fileSize)}
              </span>
            )}
          </div>
          <p className={`text-sm mt-1 ${config.color}`}>{config.text}</p>
          {status === 'uploading' && (
            <ProgressBar
              value={progress}
              size="sm"
              className="mt-2"
              showPercentage
            />
          )}
        </div>
        <div className="flex-shrink-0 flex gap-2">
          {status === 'uploading' && onCancel && (
            <button
              onClick={onCancel}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title={t('common.cancel', 'Cancel')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {status === 'error' && onRetry && (
            <button
              onClick={onRetry}
              className="p-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
              title={t('common.retry', 'Retry')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface OperationProgressProps {
  /** Operation title */
  title: string
  /** Current step description */
  currentStep?: string
  /** Progress value from 0 to 100 */
  progress: number
  /** Number of items processed */
  processedCount?: number
  /** Total number of items */
  totalCount?: number
  /** Operation status */
  status: 'running' | 'paused' | 'complete' | 'error'
  /** Error message if status is error */
  error?: string
  /** Estimated time remaining in seconds */
  estimatedTime?: number
  /** Called when pause is clicked */
  onPause?: () => void
  /** Called when resume is clicked */
  onResume?: () => void
  /** Called when cancel is clicked */
  onCancel?: () => void
  /** Additional class names */
  className?: string
}

/**
 * Operation progress component for imports, exports, etc.
 */
export function OperationProgress({
  title,
  currentStep,
  progress,
  processedCount,
  totalCount,
  status,
  error,
  estimatedTime,
  onPause,
  onResume,
  onCancel,
  className = ''
}: OperationProgressProps) {
  const { t } = useTranslation()

  const formatTime = (seconds?: number) => {
    if (!seconds) return ''
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  }

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{title}</h3>
          {currentStep && status === 'running' && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{currentStep}</p>
          )}
          {status === 'error' && error && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
          )}
          {status === 'complete' && (
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
              {t('progress.operationComplete', 'Operation completed successfully')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {status === 'running' && onPause && (
            <button
              onClick={onPause}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              title={t('common.pause', 'Pause')}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            </button>
          )}
          {status === 'paused' && onResume && (
            <button
              onClick={onResume}
              className="p-2 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              title={t('common.resume', 'Resume')}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}
          {(status === 'running' || status === 'paused') && onCancel && (
            <button
              onClick={onCancel}
              className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              title={t('common.cancel', 'Cancel')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <ProgressBar
        value={progress}
        variant={status === 'error' ? 'error' : status === 'complete' ? 'success' : 'primary'}
        size="lg"
        striped={status === 'running'}
        animated={status === 'running'}
      />

      <div className="flex items-center justify-between mt-3 text-sm">
        <div className="text-gray-500 dark:text-gray-400">
          {processedCount !== undefined && totalCount !== undefined && (
            <span>
              {processedCount.toLocaleString()} / {totalCount.toLocaleString()} {t('common.items', 'items')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-gray-500 dark:text-gray-400">
          <span>{Math.round(progress)}%</span>
          {estimatedTime !== undefined && status === 'running' && (
            <span>~{formatTime(estimatedTime)} {t('progress.remaining', 'remaining')}</span>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Multi-step progress indicator
 */
interface Step {
  id: string
  label: string
  description?: string
}

interface StepProgressProps {
  /** Steps definition */
  steps: Step[]
  /** Current step index (0-based) */
  currentStep: number
  /** Current step status */
  status?: 'pending' | 'active' | 'complete' | 'error'
  /** Additional class names */
  className?: string
}

export function StepProgress({
  steps,
  currentStep,
  status = 'active',
  className = ''
}: StepProgressProps) {
  return (
    <div className={className}>
      <div className="flex items-center">
        {steps.map((step, index) => {
          const isComplete = index < currentStep
          const isCurrent = index === currentStep
          const isError = isCurrent && status === 'error'

          return (
            <React.Fragment key={step.id}>
              {/* Step indicator */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors
                    ${isComplete ? 'bg-green-500 border-green-500 text-white' : ''}
                    ${isCurrent && !isError ? 'bg-primary-500 border-primary-500 text-white' : ''}
                    ${isError ? 'bg-red-500 border-red-500 text-white' : ''}
                    ${!isComplete && !isCurrent ? 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400' : ''}
                  `}
                >
                  {isComplete ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isError ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : isCurrent ? (
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p className={`text-sm font-medium ${isCurrent ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
                    {step.label}
                  </p>
                  {step.description && isCurrent && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={`
                    flex-1 h-0.5 mx-4 mt-[-28px]
                    ${index < currentStep ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}
                  `}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

export default ProgressBar
