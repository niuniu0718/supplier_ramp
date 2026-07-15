import type { LucideIcon } from 'lucide-react'
import type { Kpi } from '../../types'

interface KpiCardProps { kpi: Kpi; icon?: LucideIcon }
export function KpiCard({ kpi, icon: Icon }: KpiCardProps) {
  return (
    <article className={`kpi-card kpi-${kpi.tone ?? 'blue'}`}>
      {Icon && <span className="kpi-icon"><Icon size={20} /></span>}
      <div>
        <span className="kpi-label">{kpi.label}</span>
        <strong className="kpi-value">
          {kpi.value}
          {kpi.unit && <small>{kpi.unit}</small>}
        </strong>
        {kpi.hint && <small className="kpi-hint">{kpi.hint}</small>}
      </div>
    </article>
  )
}