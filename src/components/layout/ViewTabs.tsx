import { NavLink, useLocation } from 'react-router-dom'

export interface ViewTabItem {
  to: string
  label: string
  hint?: string
}

interface ViewTabsProps {
  boardId: string
  views: ViewTabItem[]
}

export function ViewTabs({ views }: ViewTabsProps) {
  const { pathname } = useLocation()
  return (
    <nav className="view-tabs" aria-label="板块视图">
      {views.map((v) => (
        <NavLink
          key={v.to}
          to={v.to}
          end
          className={({ isActive }) => `view-tab ${isActive || pathname === v.to ? 'is-active' : ''}`}
        >
          <span>{v.label}</span>
          {v.hint && <small>{v.hint}</small>}
        </NavLink>
      ))}
    </nav>
  )
}