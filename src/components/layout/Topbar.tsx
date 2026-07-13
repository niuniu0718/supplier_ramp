import { useEffect, useRef, useState } from 'react'
import { Bell, Check, Menu, Search, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import type { Notification } from '../../types'
import { StatusBadge } from '../ui/StatusBadge'

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [noticeOpen, setNoticeOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    api.get<{ unreadCount: number; items: Notification[] }>('/notifications', user.id).then((data) => {
      setNotifications(data.items)
      setUnreadCount(data.unreadCount)
    }).catch(() => undefined)
  }, [user, location.pathname])

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setNoticeOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  if (!user) return null

  const openNotification = async (item: Notification) => {
    if (!item.isRead) {
      await api.patch(`/notifications/${item.id}/read`, {}, user.id)
      setNotifications((current) => current.map((notice) => notice.id === item.id ? { ...notice, isRead: true } : notice))
      setUnreadCount((count) => Math.max(0, count - 1))
    }
    setNoticeOpen(false)
    navigate(item.link)
  }

  const readAll = async () => {
    await apiRequestReadAll(user.id)
    setNotifications((current) => current.map((notice) => ({ ...notice, isRead: true })))
    setUnreadCount(0)
  }

  return (
    <header className="topbar" ref={wrapperRef}>
      <button className="icon-button mobile-menu-button" onClick={onOpenMenu} aria-label="打开导航"><Menu size={20} /></button>
      <div className="global-search">
        <Search size={18} />
        <input aria-label="全局搜索" placeholder="搜索物料、风险、任务或扩产计划" />
        <kbd>⌘ K</kbd>
      </div>
      <div className="topbar-actions">
        <div className="popover-wrap">
          <button className="icon-button notification-button" onClick={() => setNoticeOpen(!noticeOpen)} aria-label="通知">
            <Bell size={19} />
            {unreadCount > 0 && <span className="notification-count">{unreadCount}</span>}
          </button>
          {noticeOpen && (
            <div className="popover notification-popover">
              <div className="popover-header"><div><strong>预警与通知</strong><span>{unreadCount} 条未读</span></div>{unreadCount > 0 && <button onClick={readAll}><Check size={15} />全部已读</button>}</div>
              <div className="notification-list">
                {notifications.length === 0 && <div className="notification-empty">暂无通知</div>}
                {notifications.map((item) => (
                  <button key={item.id} className={`notification-item ${item.isRead ? '' : 'unread'}`} onClick={() => openNotification(item)}>
                    <StatusBadge status={item.level} showDot={false} />
                    <span><strong>{item.title}</strong><small>{item.message}</small></span>
                    {!item.isRead && <i />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <span className="topbar-divider" />
        <div className="popover-wrap current-user">
          <span className="avatar" style={{ background: user.avatarColor }}>{user.name.slice(-1)}</span>
          <div className="user-menu-copy"><strong>{user.name}</strong><small>{user.title}</small></div>
        </div>
      </div>
    </header>
  )
}

async function apiRequestReadAll(userId: string) {
  const response = await fetch('/api/notifications/read-all', { method: 'POST', headers: { 'X-User-Id': userId } })
  if (!response.ok) throw new Error('标记通知失败')
}