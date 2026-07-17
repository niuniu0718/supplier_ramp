import { useEffect, useState } from 'react'
import { BoardShell } from '../../components/layout/BoardShell'
import { KpiCard } from '../../components/ui/KpiCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { ErrorState, LoadingState } from '../../components/ui/States'
import { api } from '../../lib/api'
import { typeBadgeMeta } from '../../lib/risk'
import type { RisksEscalationPayload } from '../../types'

const VIEWS = [
  { to: '/board/risks/view/overview', label: '风险总览' },
  { to: '/board/risks/view/by-type', label: '按类型分布' },
  { to: '/board/risks/view/escalation', label: '升级路径' },
  { to: '/board/risks/view/closure', label: '闭环统计' },
]

export function RisksEscalation() {
  const [data, setData] = useState<RisksEscalationPayload | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<RisksEscalationPayload>('/api/boards/risks/views/escalation')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败。'))
  }, [])

  if (error) return <ErrorState message={error} />
  if (!data) return <LoadingState label="加载升级路径…" />

  const renderList = (list: RisksEscalationPayload['pending'], title: string, tone: string) => (
    <section className="escalation-section">
      <header>
        <h3>{title}</h3>
        <StatusBadge status={tone} short />
      </header>
      {list.length === 0 ? <p className="muted">无</p> : list.map((r) => {
        const typeMeta = typeBadgeMeta(r.type)
        return (
          <article key={r.id} className="plan-card" style={{ padding: 10 }}>
            <div className="plan-card-head">
              <div>
                <strong>{r.id}</strong>
                <small style={{ display: 'block' }}>{r.materialName} · {r.supplierName}</small>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span className={`milestone-pill tone-${typeMeta.tone}`}>{typeMeta.label}</span>
                <StatusBadge status={r.level} short />
              </div>
            </div>
            <small>{r.description}</small>
            <div className="evidence-meta">
              {r.actions.map((a) => (
                <span key={a.id} className="evidence-tag">{a.type} · {a.taskProgress ?? 0}%</span>
              ))}
            </div>
          </article>
        )
      })}
    </section>
  )

  return (
    <BoardShell
      boardId="risks"
      boardLabel="风险预警"
      title="风险升级路径"
      description="红色待升级 / 橙黄跟进中 / 已闭环 的全路径时间分布 · 9 类风险含 L2 节点级 4 类"
      views={VIEWS}
      kpis={data.kpis.map((k, i) => <KpiCard key={i} kpi={k} />)}
    >
      <div className="escalation-grid">
        {renderList(data.pending, '🔴 待升级', 'RED')}
        {renderList(data.active, '🟠🟡 已介入', 'ORANGE')}
        {renderList(data.closed, '✅ 已闭环', 'GREEN')}
      </div>
    </BoardShell>
  )
}