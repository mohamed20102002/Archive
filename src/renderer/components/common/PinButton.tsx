import React from 'react'

interface PinButtonProps {
  isPinned: boolean
  onToggle: () => void
  size?: 'sm' | 'md'
  className?: string
}

export function PinButton({ isPinned, onToggle, size = 'sm', className = '' }: PinButtonProps) {
  const sizeClasses = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
  const buttonClasses = size === 'sm' ? 'p-1' : 'p-1.5'

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggle()
  }

  return (
    <button
      onClick={handleClick}
      className={`${buttonClasses} rounded transition-colors ${
        isPinned
          ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50'
          : 'text-gray-400 hover:text-amber-500 hover:bg-gray-100'
      } ${className}`}
      title={isPinned ? 'Unpin' : 'Pin to top'}
    >
      <svg
        className={sizeClasses}
        fill={isPinned ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
        />
      </svg>
    </button>
  )
}
