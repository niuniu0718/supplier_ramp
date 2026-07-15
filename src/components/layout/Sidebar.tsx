import { NavLink } from 'react-router-dom'
import { AlertTriangle, CheckSquare, Factory } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const NAV = [
  { to: '/board/expansion/view/overview', label: '扩产跟踪', icon: Factory, color: '#2563eb' },
  { to: '/board/risks/view/overview', label: '风险预警', icon: AlertTriangle, color: '#ef7d32' },
  { to: '/board/tasks/view/my-todo', label: '措施跟进', icon: CheckSquare, color: '#18a875' },
]

export function Sidebar() {
  const { username } = useAuth()

  return (
    <aside className="app-sidebar">
      <div className="app-brand">
        <span className="brand-dot" />
        <div>
          <strong>化学料扩产管控</strong>
          <small>v2 · 本地版</small>
        </div>
      </div>
      <nav className="app-nav">
        <span className="nav-eyebrow">采购驾驶舱</span>
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`} end>
            <item.icon size={18} color={item.color} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-foot">
        <small>当前账号</small>
        <strong>{username ?? '未登录'}</strong>
      </div>
    </aside>
  )
}