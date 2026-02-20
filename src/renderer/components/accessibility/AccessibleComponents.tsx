/**
 * Accessible Components
 *
 * ARIA-enhanced versions of common UI components.
 * Ensures proper screen reader support and keyboard navigation.
 */

import React, { forwardRef, useId } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Accessible Icon Button
 * Icon-only buttons with proper ARIA labels
 */
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible label for the button */
  label: string
  /** Icon element */
  icon: React.ReactNode
  /** Show tooltip on hover */
  showTooltip?: boolean
  /** Button variant */
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
  /** Button size */
  size?: 'sm' | 'md' | 'lg'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, icon, showTooltip = true, variant = 'default', size = 'md', className = '', ...props }, ref) => {
    const sizeClasses = {
      sm: 'p-1',
      md: 'p-1.5',
      lg: 'p-2'
    }

    const variantClasses = {
      default: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700',
      primary: 'text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30',
      danger: 'text-red-500 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30',
      ghost: 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
    }

    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={showTooltip ? label : undefined}
        className={`
          inline-flex items-center justify-center rounded-lg
          transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500
          disabled:opacity-50 disabled:cursor-not-allowed
          ${sizeClasses[size]}
          ${variantClasses[variant]}
          ${className}
        `}
        {...props}
      >
        {icon}
      </button>
    )
  }
)

IconButton.displayName = 'IconButton'

/**
 * Accessible Form Field
 * Input with proper labeling and error handling
 */
interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Field label */
  label: string
  /** Optional helper text */
  helperText?: string
  /** Error message */
  error?: string
  /** Hide the label visually (still accessible to screen readers) */
  hideLabel?: boolean
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, helperText, error, hideLabel = false, className = '', id, ...props }, ref) => {
    const generatedId = useId()
    const inputId = id || generatedId
    const helperId = `${inputId}-helper`
    const errorId = `${inputId}-error`

    const describedBy = [
      helperText ? helperId : null,
      error ? errorId : null
    ].filter(Boolean).join(' ') || undefined

    return (
      <div className="space-y-1">
        <label
          htmlFor={inputId}
          className={hideLabel ? 'sr-only' : 'block text-sm font-medium text-gray-700 dark:text-gray-300'}
        >
          {label}
          {props.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
        </label>

        <input
          ref={ref}
          id={inputId}
          aria-describedby={describedBy}
          aria-invalid={error ? 'true' : undefined}
          className={`
            w-full px-3 py-2 border rounded-lg
            bg-white dark:bg-gray-800
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error
              ? 'border-red-500 dark:border-red-400 focus:ring-red-500'
              : 'border-gray-300 dark:border-gray-600'
            }
            ${className}
          `}
          {...props}
        />

        {helperText && !error && (
          <p id={helperId} className="text-sm text-gray-500 dark:text-gray-400">
            {helperText}
          </p>
        )}

        {error && (
          <p id={errorId} className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }
)

FormField.displayName = 'FormField'

/**
 * Accessible Select
 */
interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: Array<{ value: string; label: string; disabled?: boolean }>
  helperText?: string
  error?: string
  hideLabel?: boolean
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, options, helperText, error, hideLabel = false, className = '', id, ...props }, ref) => {
    const generatedId = useId()
    const selectId = id || generatedId
    const helperId = `${selectId}-helper`
    const errorId = `${selectId}-error`

    const describedBy = [
      helperText ? helperId : null,
      error ? errorId : null
    ].filter(Boolean).join(' ') || undefined

    return (
      <div className="space-y-1">
        <label
          htmlFor={selectId}
          className={hideLabel ? 'sr-only' : 'block text-sm font-medium text-gray-700 dark:text-gray-300'}
        >
          {label}
          {props.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
        </label>

        <select
          ref={ref}
          id={selectId}
          aria-describedby={describedBy}
          aria-invalid={error ? 'true' : undefined}
          className={`
            w-full px-3 py-2 border rounded-lg
            bg-white dark:bg-gray-800
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error
              ? 'border-red-500 dark:border-red-400 focus:ring-red-500'
              : 'border-gray-300 dark:border-gray-600'
            }
            ${className}
          `}
          {...props}
        >
          {options.map(option => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>

        {helperText && !error && (
          <p id={helperId} className="text-sm text-gray-500 dark:text-gray-400">
            {helperText}
          </p>
        )}

        {error && (
          <p id={errorId} className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }
)

SelectField.displayName = 'SelectField'

/**
 * Accessible Textarea
 */
interface TextareaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  helperText?: string
  error?: string
  hideLabel?: boolean
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  ({ label, helperText, error, hideLabel = false, className = '', id, ...props }, ref) => {
    const generatedId = useId()
    const textareaId = id || generatedId
    const helperId = `${textareaId}-helper`
    const errorId = `${textareaId}-error`

    const describedBy = [
      helperText ? helperId : null,
      error ? errorId : null
    ].filter(Boolean).join(' ') || undefined

    return (
      <div className="space-y-1">
        <label
          htmlFor={textareaId}
          className={hideLabel ? 'sr-only' : 'block text-sm font-medium text-gray-700 dark:text-gray-300'}
        >
          {label}
          {props.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
        </label>

        <textarea
          ref={ref}
          id={textareaId}
          aria-describedby={describedBy}
          aria-invalid={error ? 'true' : undefined}
          className={`
            w-full px-3 py-2 border rounded-lg
            bg-white dark:bg-gray-800
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
            disabled:opacity-50 disabled:cursor-not-allowed resize-y
            ${error
              ? 'border-red-500 dark:border-red-400 focus:ring-red-500'
              : 'border-gray-300 dark:border-gray-600'
            }
            ${className}
          `}
          {...props}
        />

        {helperText && !error && (
          <p id={helperId} className="text-sm text-gray-500 dark:text-gray-400">
            {helperText}
          </p>
        )}

        {error && (
          <p id={errorId} className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }
)

TextareaField.displayName = 'TextareaField'

/**
 * Accessible Checkbox
 */
interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  description?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, className = '', id, ...props }, ref) => {
    const generatedId = useId()
    const checkboxId = id || generatedId
    const descriptionId = `${checkboxId}-description`

    return (
      <div className="flex items-start gap-3">
        <input
          ref={ref}
          type="checkbox"
          id={checkboxId}
          aria-describedby={description ? descriptionId : undefined}
          className={`
            mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-600
            text-primary-600 focus:ring-primary-500
            disabled:opacity-50 disabled:cursor-not-allowed
            ${className}
          `}
          {...props}
        />
        <div>
          <label
            htmlFor={checkboxId}
            className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
          >
            {label}
          </label>
          {description && (
            <p id={descriptionId} className="text-sm text-gray-500 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
      </div>
    )
  }
)

Checkbox.displayName = 'Checkbox'

/**
 * Live Region for announcements
 */
interface LiveRegionProps {
  /** Content to announce */
  message: string
  /** Politeness level */
  politeness?: 'polite' | 'assertive'
  /** Atomic announcement */
  atomic?: boolean
}

export function LiveRegion({ message, politeness = 'polite', atomic = true }: LiveRegionProps) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic={atomic}
      className="sr-only"
    >
      {message}
    </div>
  )
}

/**
 * Visually Hidden (Screen Reader Only)
 */
export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>
}

/**
 * Loading Indicator with screen reader support
 */
export function AccessibleLoader({
  loading,
  label,
  children
}: {
  loading: boolean
  label?: string
  children?: React.ReactNode
}) {
  const { t } = useTranslation()
  const loadingLabel = label || t('common.loading', 'Loading...')

  return (
    <>
      {loading && (
        <div
          role="status"
          aria-busy="true"
          aria-label={loadingLabel}
          className="flex items-center justify-center"
        >
          <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <span className="sr-only">{loadingLabel}</span>
        </div>
      )}
      <div aria-hidden={loading}>{children}</div>
    </>
  )
}

/**
 * Alert component with proper role
 */
interface AlertProps {
  type: 'info' | 'success' | 'warning' | 'error'
  title?: string
  children: React.ReactNode
  dismissible?: boolean
  onDismiss?: () => void
  className?: string
}

export function Alert({
  type,
  title,
  children,
  dismissible = false,
  onDismiss,
  className = ''
}: AlertProps) {
  const { t } = useTranslation()

  const styles = {
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
  }

  return (
    <div
      role="alert"
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className={`p-4 rounded-lg border ${styles[type]} ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1">
          {title && <p className="font-medium mb-1">{title}</p>}
          <div className="text-sm">{children}</div>
        </div>
        {dismissible && onDismiss && (
          <IconButton
            label={t('common.dismiss', 'Dismiss')}
            onClick={onDismiss}
            variant="ghost"
            size="sm"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            }
          />
        )}
      </div>
    </div>
  )
}

export default {
  IconButton,
  FormField,
  SelectField,
  TextareaField,
  Checkbox,
  LiveRegion,
  VisuallyHidden,
  AccessibleLoader,
  Alert
}
