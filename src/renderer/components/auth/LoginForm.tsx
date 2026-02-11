import React, { useState, useEffect, FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { LoginBackground } from './backgrounds'

interface LoginFormProps {
  onSuccess?: () => void
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Good Morning'
  if (hour >= 12 && hour < 17) return 'Good Afternoon'
  if (hour >= 17 && hour < 21) return 'Good Evening'
  return 'Good Night'
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { login } = useAuth()
  const { settings } = useSettings()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<{ exists: boolean; isActive: boolean } | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)

  const appTitle = settings.department_name?.trim() || 'Project Archive'
  const greeting = getGreeting()

  // Check if username exists with debounce
  useEffect(() => {
    if (!username.trim()) {
      setUsernameStatus(null)
      return
    }

    setCheckingUsername(true)
    const timer = setTimeout(async () => {
      try {
        const result = await window.electronAPI.auth.checkUsername(username.trim())
        setUsernameStatus(result)
      } catch {
        setUsernameStatus(null)
      } finally {
        setCheckingUsername(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [username])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password) {
      setError('Please enter username and password')
      return
    }

    setIsLoading(true)

    try {
      const result = await login(username.trim(), password)

      if (result.success) {
        onSuccess?.()
      } else {
        setError(result.error || 'Login failed')
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* 3D Animated Background */}
      <LoginBackground style={settings.login_background_style} speed={settings.login_animation_speed} />

      <div className="w-full max-w-md relative z-10">
        {/* Greeting above login card */}
        <div className="text-center mb-6 animate-fade-in-down">
          <h2 className="text-3xl font-light text-white drop-shadow-lg">
            {greeting}
          </h2>
        </div>

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 animate-fade-in-up">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 mb-4">
              <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{appTitle}</h1>
            <p className="text-gray-500 mt-2">Sign in to access the archive system</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium">{error}</span>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="label">
                Username
              </label>
              <div className="relative">
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input pr-10"
                  placeholder="Enter your username"
                  disabled={isLoading}
                  autoFocus
                  autoComplete="username"
                />
                {/* Username status indicator */}
                {username.trim() && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checkingUsername ? (
                      <svg className="w-5 h-5 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : usernameStatus?.exists && usernameStatus?.isActive ? (
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="User found">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : usernameStatus?.exists && !usernameStatus?.isActive ? (
                      <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="User deactivated">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    ) : usernameStatus?.exists === false ? (
                      <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="User not found">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Enter your password"
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-3 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-xs text-gray-400">
              Secure departmental archive system
            </p>
          </div>
        </div>

        {/* Developer Credit */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            Developed by <span className="font-medium text-blue-400">Mohamed Darwish</span>
          </p>
        </div>
      </div>
    </div>
  )
}
