/**
 * i18n Configuration
 *
 * Supports:
 * - English (en) - Default
 * - Arabic (ar) - RTL support
 * - Russian (ru)
 */

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Import translations
import en from './locales/en.json'
import ar from './locales/ar.json'
import ru from './locales/ru.json'

// Supported languages
export const supportedLanguages = {
  en: { name: 'English', nativeName: 'English', dir: 'ltr' },
  ar: { name: 'Arabic', nativeName: 'العربية', dir: 'rtl' },
  ru: { name: 'Russian', nativeName: 'Русский', dir: 'ltr' }
} as const

export type SupportedLanguage = keyof typeof supportedLanguages

// Language resources
const resources = {
  en: { translation: en },
  ar: { translation: ar },
  ru: { translation: ru }
}

// Initialize i18n
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'translation',

    // Language detection options
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'language',
      caches: ['localStorage']
    },

    interpolation: {
      escapeValue: false // React already escapes values
    },

    // React options
    react: {
      useSuspense: false // Disabled to prevent white screen issues
    }
  })

/**
 * Get current language direction
 */
export function getLanguageDirection(): 'ltr' | 'rtl' {
  const lang = i18n.language as SupportedLanguage
  return supportedLanguages[lang]?.dir || 'ltr'
}

/**
 * Check if current language is RTL
 */
export function isRTL(): boolean {
  return getLanguageDirection() === 'rtl'
}

/**
 * Change language and update document direction
 */
export async function changeLanguage(lang: SupportedLanguage): Promise<void> {
  await i18n.changeLanguage(lang)

  // Update document direction
  const dir = supportedLanguages[lang].dir
  document.documentElement.dir = dir
  document.documentElement.lang = lang

  // Store in localStorage
  localStorage.setItem('language', lang)
}

/**
 * Get current language
 */
export function getCurrentLanguage(): SupportedLanguage {
  return (i18n.language || 'en') as SupportedLanguage
}

/**
 * Initialize document direction based on saved language
 */
export function initLanguageDirection(): void {
  const lang = getCurrentLanguage()
  const dir = supportedLanguages[lang]?.dir || 'ltr'
  document.documentElement.dir = dir
  document.documentElement.lang = lang
}

export default i18n
