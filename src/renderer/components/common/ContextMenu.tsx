/**
 * Context Menu Component
 *
 * A customizable right-click context menu for list items and other interactive elements.
 * Supports keyboard navigation, nested menus, and icons.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

export interface ContextMenuItem {
  id: string
  label: string
  icon?: React.ReactNode
  shortcut?: string
  disabled?: boolean
  danger?: boolean
  separator?: boolean
  submenu?: ContextMenuItem[]
  onClick?: () => void
}

interface ContextMenuProps {
  items: ContextMenuItem[]
  children: React.ReactNode
  onOpen?: () => void
  onClose?: () => void
  disabled?: boolean
}

interface MenuPosition {
  x: number
  y: number
}

export function ContextMenu({
  items,
  children,
  onOpen,
  onClose,
  disabled = false
}: ContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState<MenuPosition>({ x: 0, y: 0 })
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (disabled) return

    e.preventDefault()
    e.stopPropagation()

    // Calculate position ensuring menu stays within viewport
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const menuWidth = 200 // Approximate menu width
    const menuHeight = items.length * 36 // Approximate menu height

    let x = e.clientX
    let y = e.clientY

    if (x + menuWidth > viewportWidth) {
      x = viewportWidth - menuWidth - 10
    }
    if (y + menuHeight > viewportHeight) {
      y = viewportHeight - menuHeight - 10
    }

    setPosition({ x, y })
    setIsOpen(true)
    setFocusedIndex(0)
    onOpen?.()
  }, [disabled, items.length, onOpen])

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setActiveSubmenu(null)
    setFocusedIndex(-1)
    onClose?.()
  }, [onClose])

  const handleItemClick = useCallback((item: ContextMenuItem) => {
    if (item.disabled || item.separator) return

    if (item.submenu) {
      setActiveSubmenu(activeSubmenu === item.id ? null : item.id)
      return
    }

    item.onClick?.()
    handleClose()
  }, [activeSubmenu, handleClose])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return

    const visibleItems = items.filter(item => !item.separator)

    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        handleClose()
        break
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex(prev =>
          prev < visibleItems.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex(prev =>
          prev > 0 ? prev - 1 : visibleItems.length - 1
        )
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (focusedIndex >= 0 && focusedIndex < visibleItems.length) {
          handleItemClick(visibleItems[focusedIndex])
        }
        break
      case 'ArrowRight':
        if (focusedIndex >= 0) {
          const item = visibleItems[focusedIndex]
          if (item?.submenu) {
            e.preventDefault()
            setActiveSubmenu(item.id)
          }
        }
        break
      case 'ArrowLeft':
        if (activeSubmenu) {
          e.preventDefault()
          setActiveSubmenu(null)
        }
        break
    }
  }, [isOpen, items, focusedIndex, activeSubmenu, handleClose, handleItemClick])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        handleClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleClose, handleKeyDown])

  // Focus menu when opened
  useEffect(() => {
    if (isOpen && menuRef.current) {
      menuRef.current.focus()
    }
  }, [isOpen])

  const renderMenuItem = (item: ContextMenuItem, index: number) => {
    if (item.separator) {
      return (
        <div
          key={item.id}
          className="my-1 border-t border-gray-200 dark:border-gray-700"
          role="separator"
        />
      )
    }

    const isFocused = focusedIndex === index
    const hasSubmenu = item.submenu && item.submenu.length > 0

    return (
      <div key={item.id} className="relative">
        <button
          type="button"
          role="menuitem"
          tabIndex={isFocused ? 0 : -1}
          disabled={item.disabled}
          onClick={() => handleItemClick(item)}
          onMouseEnter={() => {
            setFocusedIndex(index)
            if (hasSubmenu) {
              setActiveSubmenu(item.id)
            }
          }}
          className={`
            w-full flex items-center gap-3 px-3 py-2 text-sm text-left
            transition-colors duration-75
            ${isFocused
              ? 'bg-gray-100 dark:bg-gray-700'
              : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }
            ${item.disabled
              ? 'opacity-50 cursor-not-allowed'
              : 'cursor-pointer'
            }
            ${item.danger
              ? 'text-red-600 dark:text-red-400'
              : 'text-gray-700 dark:text-gray-200'
            }
          `}
          aria-disabled={item.disabled}
          aria-haspopup={hasSubmenu ? 'menu' : undefined}
          aria-expanded={hasSubmenu && activeSubmenu === item.id ? 'true' : undefined}
        >
          {item.icon && (
            <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>
          )}
          <span className="flex-1">{item.label}</span>
          {item.shortcut && (
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-4">
              {item.shortcut}
            </span>
          )}
          {hasSubmenu && (
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>

        {/* Submenu */}
        {hasSubmenu && activeSubmenu === item.id && (
          <div
            className="absolute left-full top-0 ml-1 min-w-[160px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50"
            role="menu"
          >
            {item.submenu!.map((subItem, subIndex) =>
              renderMenuItem(subItem, subIndex)
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div
        ref={triggerRef}
        onContextMenu={handleContextMenu}
        className="contents"
      >
        {children}
      </div>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          role="menu"
          tabIndex={-1}
          className="fixed z-50 min-w-[180px] max-w-[280px] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 outline-none animate-fade-in"
          style={{
            left: position.x,
            top: position.y
          }}
          aria-label="Context menu"
        >
          {items.map((item, index) => renderMenuItem(item, index))}
        </div>,
        document.body
      )}
    </>
  )
}

/**
 * Hook to create common context menu items
 */
export function useContextMenuItems() {
  const { t } = useTranslation()

  const createEditItems = (
    onEdit?: () => void,
    onDuplicate?: () => void,
    onDelete?: () => void
  ): ContextMenuItem[] => [
    {
      id: 'edit',
      label: t('common.edit', 'Edit'),
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      shortcut: 'E',
      onClick: onEdit
    },
    {
      id: 'duplicate',
      label: t('common.duplicate', 'Duplicate'),
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      shortcut: 'Ctrl+D',
      onClick: onDuplicate
    },
    { id: 'sep-1', label: '', separator: true },
    {
      id: 'delete',
      label: t('common.delete', 'Delete'),
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      shortcut: 'Del',
      danger: true,
      onClick: onDelete
    }
  ]

  const createViewItems = (
    onView?: () => void,
    onOpenInNewTab?: () => void,
    onCopyLink?: () => void
  ): ContextMenuItem[] => [
    {
      id: 'view',
      label: t('common.view', 'View'),
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      shortcut: 'Enter',
      onClick: onView
    },
    {
      id: 'openNew',
      label: t('common.openInNewTab', 'Open in New Tab'),
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      ),
      onClick: onOpenInNewTab
    },
    {
      id: 'copyLink',
      label: t('common.copyLink', 'Copy Link'),
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
      shortcut: 'Ctrl+L',
      onClick: onCopyLink
    }
  ]

  const createExportItems = (
    onExportPDF?: () => void,
    onExportExcel?: () => void,
    onPrint?: () => void
  ): ContextMenuItem[] => [
    {
      id: 'exportPDF',
      label: t('common.exportPDF', 'Export as PDF'),
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
      onClick: onExportPDF
    },
    {
      id: 'exportExcel',
      label: t('common.exportExcel', 'Export as Excel'),
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      onClick: onExportExcel
    },
    {
      id: 'print',
      label: t('common.print', 'Print'),
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
      ),
      shortcut: 'Ctrl+P',
      onClick: onPrint
    }
  ]

  return {
    createEditItems,
    createViewItems,
    createExportItems
  }
}

export default ContextMenu
