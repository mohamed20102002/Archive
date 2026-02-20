import React, { useState, useEffect, useRef } from 'react'

interface TwoFactorDialogProps {
  isOpen: boolean
  maskedEmail: string
  onVerify: (code: string) => Promise<{ success: boolean; error?: string; remainingAttempts?: number }>
  onResend: () => Promise<{ success: boolean; error?: string }>
  onCancel: () => void
  expirySeconds: number
}

export function TwoFactorDialog({
  isOpen,
  maskedEmail,
  onVerify,
  onResend,
  onCancel,
  expirySeconds
}: TwoFactorDialogProps) {
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [remainingTime, setRemainingTime] = useState(expirySeconds)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setCode(['', '', '', '', '', ''])
      setError(null)
      setRemainingTime(expirySeconds)
      // Focus first input
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    }
  }, [isOpen, expirySeconds])

  // Countdown timer
  useEffect(() => {
    if (!isOpen || remainingTime <= 0) return

    const interval = setInterval(() => {
      setRemainingTime(prev => Math.max(0, prev - 1))
    }, 1000)

    return () => clearInterval(interval)
  }, [isOpen, remainingTime])

  const handleInputChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1)

    const newCode = [...code]
    newCode[index] = digit
    setCode(newCode)
    setError(null)

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-verify when all digits entered
    if (digit && index === 5) {
      const fullCode = newCode.join('')
      if (fullCode.length === 6) {
        handleVerify(fullCode)
      }
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)

    if (pastedData.length === 6) {
      const newCode = pastedData.split('')
      setCode(newCode)
      handleVerify(pastedData)
    }
  }

  const handleVerify = async (fullCode: string) => {
    setIsVerifying(true)
    setError(null)

    try {
      const result = await onVerify(fullCode)
      if (!result.success) {
        setError(result.error || 'Verification failed')
        setCode(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      }
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    setIsResending(true)
    setError(null)

    try {
      const result = await onResend()
      if (result.success) {
        setRemainingTime(300) // Reset to 5 minutes
        setCode(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      } else {
        setError(result.error || 'Failed to resend code')
      }
    } finally {
      setIsResending(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-primary-600 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-700 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Two-Factor Authentication</h2>
              <p className="text-sm text-primary-100">Enter the code sent to your email</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
            We sent a verification code to <span className="font-medium">{maskedEmail}</span>
          </p>

          {/* Code inputs */}
          <div className="flex justify-center gap-2 mb-4" onPaste={handlePaste}>
            {code.map((digit, index) => (
              <input
                key={index}
                ref={el => inputRefs.current[index] = el}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleInputChange(index, e.target.value)}
                onKeyDown={e => handleKeyDown(index, e)}
                className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:bg-gray-700 dark:text-white transition-colors"
                disabled={isVerifying}
              />
            ))}
          </div>

          {/* Timer */}
          <div className="text-center mb-4">
            {remainingTime > 0 ? (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Code expires in <span className="font-medium text-gray-700 dark:text-gray-300">{formatTime(remainingTime)}</span>
              </span>
            ) : (
              <span className="text-sm text-red-500">Code has expired</span>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Verify button */}
          <button
            onClick={() => handleVerify(code.join(''))}
            disabled={code.join('').length !== 6 || isVerifying || remainingTime === 0}
            className="w-full px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isVerifying ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Verifying...
              </>
            ) : (
              'Verify Code'
            )}
          </button>

          {/* Resend and cancel */}
          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={handleResend}
              disabled={isResending}
              className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 disabled:text-gray-400"
            >
              {isResending ? 'Sending...' : 'Resend code'}
            </button>
            <button
              onClick={onCancel}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TwoFactorDialog
