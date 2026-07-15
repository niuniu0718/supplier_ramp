import { useEffect, useState } from 'react'
import { Boxes, Factory, ShieldAlert, ShieldCheck } from 'lucide-react'
import { BoardShell } from '../../components/layout/BoardShell'
import { KpiCard } from '../../components/ui/KpiCard'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { ErrorState, LoadingState } from '../../components/ui/States'
import { api } from '../../lib/api'
import type { ExpansionOverviewPayload } from '../../types'

const VIEWS = [
  { to: '/board/expansion/view/overview', label: '进度总览' },
  { to: '/board/expansion/view/timeline', label: '里程碑时间轴' },
  { to: '/board/expansion/view/evidence', label: '证据档案' },
]

export function ExpansionOverview() {
  const [data, setData] = useState<ExpansionOverviewPayload | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<ExpansionOverviewPayload>('/api/boards/expansion/views/overview')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败。'))
  }, [])

  if (error) return <ErrorState message={error} />
  if (!data) return <LoadingState label="加载扩产总览…" />

  return (
    <BoardShell
      boardId="expansion"
      boardLabel="扩产跟踪"
      title="供应商扩产进度总览"
      description="所有供应商扩产计划的红黄绿灯、阶段与进度"
      views={VIEWS}
      kpis={data.kpis.map((k, i) => <KpiCard key={i} kpi={k} icon={[Factory, ShieldCheck, ShieldAlert, ShieldAlert, ShieldAlert, Boxes][i] ?? Factory} />)}
    >
      <div className="cards-grid">
        {data.cards.map((c) => (
          <article key={c.id} className="plan-card">
            <header className="plan-card-head">
              <div>
                <h3>{c.name}</h3>
                <small>{c.supplierName} · {c.materialName}</small>
              </div>
              <StatusBadge status={c.status} short />
            </header>
            <div>
              <span className="muted">阶段</span>
              <strong style={{ marginLeft: 8 }}>{c.stage}</strong>
              <span style={{ marginLeft: 14 }} className="muted">滞后</span>
              <strong style={{ marginLeft: 4, color: c.lag > 10 ? 'var(--red)' : 'var(--text)' }}>{c.lag}%</strong>
            </div>
            <ProgressBar progress={c.progress} expected={c.expectedProgress} />
            {c.riskTypes.length > 0 && (
              <div>
                {c.riskTypes.map((r) => <span key={r} className="evidence-tag" style={{ marginRight: 6 }}>{r}</span>)}
              </div>
            )}
            <small className="muted">更新于 {new Date(c.updatedAt).toLocaleString('zh-CN')}</small>
          </article>
        ))}
      </div>
    </BoardShell>
  )
}