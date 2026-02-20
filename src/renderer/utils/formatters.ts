/**
 * Locale-aware formatters for dates, numbers, and currencies
 *
 * Supports:
 * - English (en) - Gregorian calendar
 * - Arabic (ar) - Gregorian + Hijri calendar option
 * - Russian (ru) - Gregorian calendar
 */

import { format, formatDistance, formatRelative, parseISO, isValid } from 'date-fns'
import { enUS, ar, ru } from 'date-fns/locale'
import { getCurrentLanguage, SupportedLanguage } from '../i18n'

// Locale mapping for date-fns
const dateLocales: Record<SupportedLanguage, Locale> = {
  en: enUS,
  ar: ar,
  ru: ru
}

/**
 * Get the current date-fns locale
 */
export function getDateLocale(): Locale {
  const lang = getCurrentLanguage()
  return dateLocales[lang] || enUS
}

/**
 * Format a date according to the current locale
 */
export function formatDate(
  date: Date | string | null | undefined,
  formatStr: string = 'PPP'
): string {
  if (!date) return ''

  const dateObj = typeof date === 'string' ? parseISO(date) : date

  if (!isValid(dateObj)) return ''

  return format(dateObj, formatStr, { locale: getDateLocale() })
}

/**
 * Format a date as short format (e.g., "Jan 1, 2024" or "1 يناير 2024")
 */
export function formatDateShort(date: Date | string | null | undefined): string {
  return formatDate(date, 'PP')
}

/**
 * Format a date as long format
 */
export function formatDateLong(date: Date | string | null | undefined): string {
  return formatDate(date, 'PPPP')
}

/**
 * Format time only
 */
export function formatTime(date: Date | string | null | undefined): string {
  return formatDate(date, 'p')
}

/**
 * Format date and time
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  return formatDate(date, 'Pp')
}

/**
 * Format date as ISO date (YYYY-MM-DD)
 */
export function formatISODate(date: Date | string | null | undefined): string {
  if (!date) return ''
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(dateObj)) return ''
  return format(dateObj, 'yyyy-MM-dd')
}

/**
 * Format relative time (e.g., "3 days ago", "in 2 hours")
 */
export function formatRelativeTime(
  date: Date | string | null | undefined,
  baseDate: Date = new Date()
): string {
  if (!date) return ''

  const dateObj = typeof date === 'string' ? parseISO(date) : date

  if (!isValid(dateObj)) return ''

  return formatDistance(dateObj, baseDate, {
    locale: getDateLocale(),
    addSuffix: true
  })
}

/**
 * Format relative date with context (e.g., "yesterday at 3:00 PM")
 */
export function formatRelativeDate(
  date: Date | string | null | undefined,
  baseDate: Date = new Date()
): string {
  if (!date) return ''

  const dateObj = typeof date === 'string' ? parseISO(date) : date

  if (!isValid(dateObj)) return ''

  return formatRelative(dateObj, baseDate, {
    locale: getDateLocale()
  })
}

/**
 * Format a number according to the current locale
 */
export function formatNumber(
  value: number | null | undefined,
  options: Intl.NumberFormatOptions = {}
): string {
  if (value === null || value === undefined) return ''

  const lang = getCurrentLanguage()
  const localeStr = lang === 'ar' ? 'ar-SA' : lang === 'ru' ? 'ru-RU' : 'en-US'

  return new Intl.NumberFormat(localeStr, options).format(value)
}

/**
 * Format as integer with thousands separator
 */
export function formatInteger(value: number | null | undefined): string {
  return formatNumber(value, { maximumFractionDigits: 0 })
}

/**
 * Format as decimal with specified precision
 */
export function formatDecimal(
  value: number | null | undefined,
  decimalPlaces: number = 2
): string {
  return formatNumber(value, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces
  })
}

/**
 * Format as percentage
 */
export function formatPercent(
  value: number | null | undefined,
  decimalPlaces: number = 1
): string {
  return formatNumber(value, {
    style: 'percent',
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces
  })
}

/**
 * Format as currency
 */
export function formatCurrency(
  value: number | null | undefined,
  currency: string = 'USD'
): string {
  return formatNumber(value, {
    style: 'currency',
    currency
  })
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return ''
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  const value = bytes / Math.pow(k, i)
  return `${formatDecimal(value, i > 0 ? 2 : 0)} ${sizes[i]}`
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(milliseconds: number | null | undefined): string {
  if (milliseconds === null || milliseconds === undefined) return ''

  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  const lang = getCurrentLanguage()

  if (days > 0) {
    const h = hours % 24
    const m = minutes % 60
    if (lang === 'ar') {
      return `${days} يوم ${h} ساعة ${m} دقيقة`
    } else if (lang === 'ru') {
      return `${days} дн ${h} ч ${m} мин`
    }
    return `${days}d ${h}h ${m}m`
  }

  if (hours > 0) {
    const m = minutes % 60
    if (lang === 'ar') {
      return `${hours} ساعة ${m} دقيقة`
    } else if (lang === 'ru') {
      return `${hours} ч ${m} мин`
    }
    return `${hours}h ${m}m`
  }

  if (minutes > 0) {
    const s = seconds % 60
    if (lang === 'ar') {
      return `${minutes} دقيقة ${s} ثانية`
    } else if (lang === 'ru') {
      return `${minutes} мин ${s} сек`
    }
    return `${minutes}m ${s}s`
  }

  if (lang === 'ar') {
    return `${seconds} ثانية`
  } else if (lang === 'ru') {
    return `${seconds} сек`
  }
  return `${seconds}s`
}

/**
 * Convert Gregorian date to Hijri (Islamic) calendar
 * Simple approximation - for display purposes
 */
export function toHijriDate(date: Date | string | null | undefined): string {
  if (!date) return ''

  const dateObj = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(dateObj)) return ''

  try {
    return dateObj.toLocaleDateString('ar-SA-u-ca-islamic', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch {
    // Fallback for browsers without Islamic calendar support
    return formatDate(date, 'PPP')
  }
}

/**
 * Format date with both Gregorian and Hijri calendars (for Arabic)
 */
export function formatDateWithHijri(date: Date | string | null | undefined): string {
  if (!date) return ''

  const gregorian = formatDate(date, 'PPP')
  const lang = getCurrentLanguage()

  if (lang === 'ar') {
    const hijri = toHijriDate(date)
    return `${gregorian} (${hijri})`
  }

  return gregorian
}

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 */
export function getOrdinal(n: number): string {
  const lang = getCurrentLanguage()

  if (lang === 'ar') {
    // Arabic doesn't typically use ordinals in the same way
    return n.toString()
  }

  if (lang === 'ru') {
    // Russian uses different suffixes
    return `${n}-й`
  }

  // English ordinals
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/**
 * Pluralize a word based on count
 */
export function pluralize(
  count: number,
  singular: string,
  plural: string,
  zero?: string
): string {
  if (count === 0 && zero) return zero
  if (count === 1) return singular
  return plural
}

/**
 * Format a list with proper locale separators
 */
export function formatList(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]

  const lang = getCurrentLanguage()
  const localeStr = lang === 'ar' ? 'ar-SA' : lang === 'ru' ? 'ru-RU' : 'en-US'

  try {
    const formatter = new Intl.ListFormat(localeStr, { style: 'long', type: 'conjunction' })
    return formatter.format(items)
  } catch {
    // Fallback
    const lastItem = items.pop()
    const conjunction = lang === 'ar' ? 'و' : lang === 'ru' ? 'и' : 'and'
    return `${items.join(', ')} ${conjunction} ${lastItem}`
  }
}
