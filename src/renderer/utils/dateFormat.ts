import { format, parseISO } from 'date-fns'

// Map setting format to date-fns format
const FORMAT_MAP: Record<string, string> = {
  'DD/MM/YYYY': 'dd/MM/yyyy',
  'MM/DD/YYYY': 'MM/dd/yyyy',
  'YYYY-MM-DD': 'yyyy-MM-dd'
}

// Extended formats for display with time
const FORMAT_WITH_TIME_MAP: Record<string, string> = {
  'DD/MM/YYYY': 'dd/MM/yyyy h:mm a',
  'MM/DD/YYYY': 'MM/dd/yyyy h:mm a',
  'YYYY-MM-DD': 'yyyy-MM-dd h:mm a'
}

// Short formats for compact displays
const SHORT_FORMAT_MAP: Record<string, string> = {
  'DD/MM/YYYY': 'dd/MM',
  'MM/DD/YYYY': 'MM/dd',
  'YYYY-MM-DD': 'MM-dd'
}

// Formats with day name
const FORMAT_WITH_DAY_MAP: Record<string, string> = {
  'DD/MM/YYYY': 'EEE, dd/MM/yyyy',
  'MM/DD/YYYY': 'EEE, MM/dd/yyyy',
  'YYYY-MM-DD': 'EEE, yyyy-MM-dd'
}

// Full formats with day name, month name and time
const FULL_FORMAT_MAP: Record<string, string> = {
  'DD/MM/YYYY': 'EEEE, d MMMM yyyy h:mm a',
  'MM/DD/YYYY': 'EEEE, MMMM d, yyyy h:mm a',
  'YYYY-MM-DD': 'EEEE, yyyy MMMM d h:mm a'
}

export type DateFormatStyle = 'default' | 'withTime' | 'short' | 'withDay' | 'full'

/**
 * Get the date-fns format string based on user's date format setting
 */
export function getDateFnsFormat(settingFormat: string, style: DateFormatStyle = 'default'): string {
  switch (style) {
    case 'withTime':
      return FORMAT_WITH_TIME_MAP[settingFormat] || 'dd/MM/yyyy h:mm a'
    case 'short':
      return SHORT_FORMAT_MAP[settingFormat] || 'dd/MM'
    case 'withDay':
      return FORMAT_WITH_DAY_MAP[settingFormat] || 'EEE, dd/MM/yyyy'
    case 'full':
      return FULL_FORMAT_MAP[settingFormat] || 'EEEE, d MMMM yyyy h:mm a'
    default:
      return FORMAT_MAP[settingFormat] || 'dd/MM/yyyy'
  }
}

/**
 * Format a date string or Date object using the user's preferred format
 */
export function formatDateWithSetting(
  date: string | Date | null | undefined,
  settingFormat: string,
  style: DateFormatStyle = 'default'
): string {
  if (!date) return ''

  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date
    const formatStr = getDateFnsFormat(settingFormat, style)
    return format(dateObj, formatStr)
  } catch {
    return typeof date === 'string' ? date : ''
  }
}
