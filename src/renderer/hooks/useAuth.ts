import { useAuth as useAuthContext } from '../context/AuthContext'

// Re-export the hook for convenience
export { useAuthContext as useAuth }

// Additional auth-related hooks

export function useIsAdmin(): boolean {
  const { user } = useAuthContext()
  return user?.role === 'admin'
}

export function useCurrentUser() {
  const { user } = useAuthContext()
  return user
}

export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useAuthContext()

  return {
    isAuthenticated,
    isLoading,
    requiresLogin: !isLoading && !isAuthenticated
  }
}
