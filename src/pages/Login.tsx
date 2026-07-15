import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Lock, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export function Login() {
  const { username, login, error } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username_, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (username) {
    const target = (location.state as { from?: string } | null)?.from ?? '/board/expansion/view/overview'
    return <Navigate to={target} replace />
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await login(username_, password)
      navigate((location.state as { from?: string } | null)?.from ?? '/board/expansion/view/overview', { replace: true })
    } catch {
      // error displayed from context
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={onSubmit}>
        <header>
          <h1>化学料扩产管控</h1>
          <p>登录以访问你的数据</p>
        </header>
        <label>
          <User size={14} />
          <input
            type="text"
            value={username_}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="账号"
            autoComplete="username"
            required
          />
        </label>
        <label>
          <Lock size={14} />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码"
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="login-error">{error}</p>}
        <button type="submit" className="button button-primary" disabled={submitting}>
          {submitting ? '登录中…' : '登录'}
        </button>
        <p className="login-hint">默认账号 admin / admin123456（在 backend/.env 中修改）</p>
      </form>
    </div>
  )
}