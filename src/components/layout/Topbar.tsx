import { Bell, Factory, LogOut, UserCircle2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import type { NotificationItem } from '../../types'

export function Topbar() {
  const { username, logout } = useAuth()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [openNotif, setOpenNotif] = useState(false)
  const navigate = useNavigate()
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    api.get<{ notifications: NotificationItem[] }>('/api/notifications')
      .then((data) => { if (active) setNotifications(data.notifications) })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setOpenNotif(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [])

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const markAllRead = async () => {
    await api.post('/api/notifications/read-all', {})
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
  }

  const onLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="app-topbar">
      <div className="topbar-meta">
        <Factory size={16} color="#94a3b8" />
        <span>采购 → 风险 → 措施 → 闭环 · 证据可追溯</span>
      </div>
      <div className="topbar-actions">
        <div className="dropdown" ref={notifRef}>
          <button className="topbar-icon" onClick={() => setOpenNotif((v) => !v)} aria-label="通知">
            <Bell size={18} />
            {unreadCount > 0 && <span className="badge-dot">{unreadCount}</span>}
          </button>
          {openNotif && (
            <div className="dropdown-panel notif-panel">
              <header><strong>站内通知</strong><button onClick={markAllRead}>全部已读</button></header>
              <ul>
                {notifications.length === 0 && <li className="muted">暂无通知</li>}
                {notifications.slice(0, 8).map((n) => (
                  <li key={n.id} className={n.isRead ? 'read' : 'unread'}>
                    <span className={`level-tag level-${n.level.toLowerCase()}`}>{n.level}</span>
                    <div>
                      <strong>{n.title}</strong>
                      <small>{n.message}</small>
                    </div>
                    <button onClick={() => navigate(n.link)}>查看</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="user-logout-row">
          <div className="topbar-user">
            <span className="avatar" style={{ background: '#2563eb' }}>
              <UserCircle2 size={18} color="#fff" />
            </span>
            <div className="user-meta">
              <strong>{username}</strong>
              <small>本地登录</small>
            </div>
          </div>
          <button className="topbar-icon" onClick={onLogout} aria-label="退出登录" title="退出登录">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  )
}