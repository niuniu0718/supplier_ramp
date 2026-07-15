import { useEffect, useState } from 'react'
import { BoardShell } from '../../components/layout/BoardShell'
import { KpiCard } from '../../components/ui/KpiCard'
import { ErrorState, LoadingState } from '../../components/ui/States'
import { api } from '../../lib/api'
import type { RisksClosurePayload } from '../../types'

const VIEWS = [
  { to: '/board/risks/view/overview', label: '风险总览' },
  { to: '/board/risks/view/by-type', label: '按类型分布' },
  { to: '/board/risks/view/escalation', label: '升级路径' },
  { to: '/board/risks/view/closure', label: '闭环统计' },
]

const TYPE_LABELS: Record<string, string> = {
  SINGLE_SOURCE: '单点依赖',
  LOW_INVENTORY: '库存不足',
  PRICE: '价格异常',
  POLICY: '政策风险',
  QUALITY: '质量风险',
}

export function RisksClosure() {
  const [data, setData] = useState<RisksClosurePayload | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<RisksClosurePayload>('/api/boards/risks/views/closure')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败。'))
  }, [])

  if (error) return <ErrorState message={error} />
  if (!data) return <LoadingState label="加载闭环统计…" />

  return (
    <BoardShell
      boardId="risks"
      boardLabel="风险预警"
      title="风险闭环统计"
      description="历史风险闭环的时长与分布"
      views={VIEWS}
      kpis={data.kpis.map((k, i) => <KpiCard key={i} kpi={k} />)}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <article className="panel">
          <div className="panel-title"><strong>按类型闭环数</strong></div>
          <table className="table">
            <thead><tr><th>类型</th><th>闭环数</th></tr></thead>
            <tbody>
              {data.byType.map((b) => (
                <tr key={b.type}><td>{TYPE_LABELS[b.type] ?? b.type}</td><td><strong>{b.count}</strong></td></tr>
              ))}
            </tbody>
          </table>
        </article>
        <article className="panel">
          <div className="panel-title"><strong>闭环明细</strong></div>
          <table className="table">
            <thead><tr><th>风险</th><th>物料</th><th>耗时</th></tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.id}</strong><small style={{ display: 'block' }}>{TYPE_LABELS[r.type] ?? r.type}</small></td>
                  <td>{r.materialName}<small style={{ display: 'block', color: 'var(--text-muted)' }}>{r.supplierName}</small></td>
                  <td>{r.durationDays} 天</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </div>
    </BoardShell>
  )
}