import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

export interface User {
  id: string
  username: string
  display_name: string
  role: 'admin' | 'user'
  is_active: boolean
  created_at: string
  updated_at: string
  last_login_at: string | null
}

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  checkAuth: () => Promise<boolean>
  sessionTimeoutWarning: boolean
  sessionRemainingSeconds: number
  extendSession: () => void
  dismissTimeoutWarning: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_STORAGE_KEY = 'auth_token'
const USER_STORAGE_KEY = 'auth_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sessionTimeoutWarning, setSessionTimeoutWarning] = useState(false)
  const [sessionRemainingSeconds, setSessionRemainingSeconds] = useState(0)
  const [warningDismissed, setWarningDismissed] = useState(false)

  // Load stored auth on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY)
    const storedUser = localStorage.getItem(USER_STORAGE_KEY)

    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as User
        setToken(storedToken)
        setUser(parsedUser)

        // Verify token is still valid
        window.electronAPI.auth.verifyToken(storedToken).then((result) => {
          if (!result.valid) {
            // Token expired, clear auth
            localStorage.removeItem(TOKEN_STORAGE_KEY)
            localStorage.removeItem(USER_STORAGE_KEY)
            setToken(null)
            setUser(null)
          }
          setIsLoading(false)
        })
      } catch {
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        localStorage.removeItem(USER_STORAGE_KEY)
        setIsLoading(false)
      }
    } else {
      setIsLoading(false)
    }
  }, [])

  // Listen for session invalidation after backup restore
  useEffect(() => {
    const handleSessionInvalidated = () => {
      console.log('[Auth] Session invalidated after backup restore - forcing re-login')
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      localStorage.removeItem(USER_STORAGE_KEY)
      setToken(null)
      setUser(null)
    }

    window.electronAPI.backup.onSessionInvalidated(handleSessionInvalidated)

    return () => {
      window.electronAPI.backup.offSessionInvalidated()
    }
  }, [])

  // Session timeout tracking - check every 30 seconds
  useEffect(() => {
    if (!token) {
      setSessionTimeoutWarning(false)
      setSessionRemainingSeconds(0)
      return
    }

    const checkSession = async () => {
      try {
        const result = await window.electronAPI.auth.verifyToken(token)
        if (!result.valid) {
          // Session expired
          console.log('[Auth] Session expired:', result.error)
          localStorage.removeItem(TOKEN_STORAGE_KEY)
          localStorage.removeItem(USER_STORAGE_KEY)
          setToken(null)
          setUser(null)
          setSessionTimeoutWarning(false)
          return
        }

        // Update remaining time
        if (result.remainingSeconds !== undefined) {
          setSessionRemainingSeconds(result.remainingSeconds)
        }

        // Show warning if within 5 minutes and not dismissed
        if (result.timeoutWarning && !warningDismissed) {
          setSessionTimeoutWarning(true)
        }
      } catch (error) {
        console.error('[Auth] Error checking session:', error)
      }
    }

    // Check immediately
    checkSession()

    // Then check every 30 seconds
    const interval = setInterval(checkSession, 30000)

    return () => clearInterval(interval)
  }, [token, warningDismissed])

  // Track user activity and update session
  useEffect(() => {
    if (!token) return

    const updateActivity = async () => {
      try {
        await window.electronAPI.auth.updateSessionActivity?.(token)
        // Reset warning dismissed on activity
        setWarningDismissed(false)
      } catch (error) {
        // Ignore errors
      }
    }

    // Track various user activities
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    let lastUpdate = 0
    const throttleMs = 60000 // Only update once per minute

    const handleActivity = () => {
      const now = Date.now()
      if (now - lastUpdate > throttleMs) {
        lastUpdate = now
        updateActivity()
      }
    }

    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity)
      })
    }
  }, [token])

  const login = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await window.electronAPI.auth.login(username, password)

      if (result.success && result.user && result.token) {
        setUser(result.user)
        setToken(result.token)
        localStorage.setItem(TOKEN_STORAGE_KEY, result.token)
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(result.user))
        return { success: true }
      }

      return { success: false, error: result.error || 'Login failed' }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, error: 'An unexpected error occurred' }
    }
  }, [])

  const logout = useCallback(() => {
    if (token && user) {
      window.electronAPI.auth.logout(token, user.id)
    }

    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(USER_STORAGE_KEY)
    setToken(null)
    setUser(null)
  }, [token, user])

  const checkAuth = useCallback(async (): Promise<boolean> => {
    if (!token) {
      return false
    }

    const result = await window.electronAPI.auth.verifyToken(token)
    if (!result.valid) {
      logout()
      return false
    }

    return true
  }, [token, logout])

  const extendSession = useCallback(() => {
    if (!token) return

    window.electronAPI.auth.extendSession?.(token).then(result => {
      if (result?.success) {
        setSessionTimeoutWarning(false)
        setWarningDismissed(false)
        if (result.newExpiresIn) {
          setSessionRemainingSeconds(result.newExpiresIn)
        }
      }
    }).catch(error => {
      console.error('[Auth] Error extending session:', error)
    })
  }, [token])

  const dismissTimeoutWarning = useCallback(() => {
    setSessionTimeoutWarning(false)
    setWarningDismissed(true)
  }, [])

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    login,
    logout,
    checkAuth,
    sessionTimeoutWarning,
    sessionRemainingSeconds,
    extendSession,
    dismissTimeoutWarning
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
