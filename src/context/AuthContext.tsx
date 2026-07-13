import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import type { User } from '../types'

interface AuthContextValue {
  user: User
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)
const DEFAULT_USER_ID = 'U_MANAGER'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<User[]>('/demo-users')
      .then((users) => {
        const fallback = users.find((item) => item.id === DEFAULT_USER_ID) ?? users[0]
        if (fallback) setUser(fallback)
      })
      .finally(() => setLoading(false))
  }, [])

  const value = useMemo(() => ({ user: user!, loading }), [user, loading])
  if (!user) return <div className="app-loading" />
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}