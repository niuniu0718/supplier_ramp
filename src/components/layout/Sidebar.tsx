import { BarChart3, BatteryCharging, CheckSquare2, Factory, LayoutDashboard, ShieldAlert, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: '供需看板', description: '全局供需健康度', icon: LayoutDashboard },
  { to: '/risks', label: '风险与措施', description: '识别风险并定措施', icon: ShieldAlert },
  { to: '/tasks', label: '措施跟进', description: '任务执行与闭环', icon: CheckSquare2 },
  { to: '/expansion', label: '扩产跟踪', description: '计划、里程碑与预警', icon: Factory },
]

export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  return (
    <>
      {mobileOpen && <div className="sidebar-scrim" onClick={onClose} />}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark"><BatteryCharging size={22} /></div>
          <div><strong>SUPPLY RAMP</strong><span>化学料供需管理系统</span></div>
          <button className="icon-button sidebar-close" onClick={onClose}><X size={19} /></button>
        </div>
        <div className="sidebar-section-label">核心工作台</div>
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={onClose} className={({ isActive }) => isActive ? 'active' : ''}>
                <Icon size={19} />
                <span><strong>{item.label}</strong><small>{item.description}</small></span>
              </NavLink>
            )
          })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-insight">
          <BarChart3 size={18} />
          <div><strong>本周数据已更新</strong><span>10 类物料 · 5 项扩产计划</span></div>
        </div>
        <div className="sidebar-footer">DEMO v1.0 · 2026</div>
      </aside>
    </>
  )
}