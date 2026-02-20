import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  supportedLanguages,
  SupportedLanguage,
  changeLanguage,
  getCurrentLanguage
} from '../../i18n'

interface LanguageSwitcherProps {
  variant?: 'dropdown' | 'buttons' | 'select'
  showNativeName?: boolean
  className?: string
}

export function LanguageSwitcher({
  variant = 'select',
  showNativeName = true,
  className = ''
}: LanguageSwitcherProps) {
  const { t } = useTranslation()
  const currentLang = getCurrentLanguage()

  const handleLanguageChange = async (lang: SupportedLanguage) => {
    await changeLanguage(lang)
  }

  if (variant === 'buttons') {
    return (
      <div className={`flex gap-2 ${className}`}>
        {Object.entries(supportedLanguages).map(([code, { name, nativeName }]) => (
          <button
            key={code}
            onClick={() => handleLanguageChange(code as SupportedLanguage)}
            className={`
              px-3 py-1.5 text-sm rounded-lg transition-colors
              ${currentLang === code
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }
            `}
          >
            {showNativeName ? nativeName : name}
          </button>
        ))}
      </div>
    )
  }

  if (variant === 'dropdown') {
    return (
      <div className={`relative inline-block ${className}`}>
        <select
          value={currentLang}
          onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
          className="
            appearance-none bg-gray-100 dark:bg-gray-700
            text-gray-700 dark:text-gray-300
            px-4 py-2 pr-8 rounded-lg
            border border-gray-200 dark:border-gray-600
            focus:outline-none focus:ring-2 focus:ring-primary-500
            cursor-pointer
          "
        >
          {Object.entries(supportedLanguages).map(([code, { name, nativeName }]) => (
            <option key={code} value={code}>
              {showNativeName ? `${nativeName} (${name})` : name}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    )
  }

  // Default: select variant with label
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {t('settings.language')}
      </label>
      <select
        value={currentLang}
        onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
        className="
          flex-1 bg-white dark:bg-gray-800
          text-gray-700 dark:text-gray-300
          px-3 py-2 rounded-lg
          border border-gray-300 dark:border-gray-600
          focus:outline-none focus:ring-2 focus:ring-primary-500
        "
      >
        {Object.entries(supportedLanguages).map(([code, { name, nativeName }]) => (
          <option key={code} value={code}>
            {showNativeName ? `${nativeName} (${name})` : name}
          </option>
        ))}
      </select>
    </div>
  )
}

/**
 * Compact language switcher with flag icons
 */
export function LanguageSwitcherCompact({ className = '' }: { className?: string }) {
  const currentLang = getCurrentLanguage()

  const flags: Record<SupportedLanguage, string> = {
    en: '🇺🇸',
    ar: '🇸🇦',
    ru: '🇷🇺'
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {Object.entries(supportedLanguages).map(([code, { nativeName }]) => (
        <button
          key={code}
          onClick={() => changeLanguage(code as SupportedLanguage)}
          title={nativeName}
          className={`
            w-8 h-8 text-lg rounded-lg transition-all
            ${currentLang === code
              ? 'bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-500'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }
          `}
        >
          {flags[code as SupportedLanguage]}
        </button>
      ))}
    </div>
  )
}

export default LanguageSwitcher
