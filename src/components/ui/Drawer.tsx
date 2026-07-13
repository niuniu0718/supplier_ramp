import { X } from 'lucide-react'
import type { ReactNode } from 'react'

export function Drawer({ open, onClose, title, subtitle, children, width = '620px' }: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  width?: string
}) {
  if (!open) return null
  return (
    <div className="overlay" onMouseDown={onClose}>
      <aside className="drawer" style={{ width }} onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-header">
          <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭"><X size={20} /></button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  )
}
