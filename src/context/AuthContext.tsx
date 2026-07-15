import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../lib/api'

interface AuthState {
  username: string | null
  loading: boolean
  error: string
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ username: null, loading: true, error: '' })

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    try {
      const data = await api.get<{ username: string }>('/api/auth/me')
      setState({ username: data.username, loading: false, error: '' })
    } catch (err) {
      if (err instanceof Error && (err as { status?: number }).status === 401) {
        setState({ username: null, loading: false, error: '' })
      } else {
        setState({
          username: null,
          loading: false,
          error: err instanceof Error ? err.message : '认证失败。',
        })
      }
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    try {
      const data = await api.post<{ username: string }>('/api/auth/login', { username, password })
      setState({ username: data.username, loading: false, error: '' })
    } catch (err) {
      const message = err instanceof Error ? err.message : '登录失败。'
      setState({ username: null, loading: false, error: message })
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout', {})
    } catch {
      // ignore — local state clears regardless
    }
    setState({ username: null, loading: false, error: '' })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo(() => ({ ...state, login, logout, refresh }), [state, login, logout, refresh])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}