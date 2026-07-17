import { useEffect, useState } from 'react'
import { BoardShell } from '../../components/layout/BoardShell'
import { KpiCard } from '../../components/ui/KpiCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { ErrorState, LoadingState } from '../../components/ui/States'
import { api } from '../../lib/api'
import type { RisksByTypePayload } from '../../types'

const VIEWS = [
  { to: '/board/risks/view/overview', label: '风险总览' },
  { to: '/board/risks/view/by-type', label: '按类型分布' },
  { to: '/board/risks/view/escalation', label: '升级路径' },
  { to: '/board/risks/view/closure', label: '闭环统计' },
]

export function RisksByType() {
  const [data, setData] = useState<RisksByTypePayload | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<RisksByTypePayload>('/api/boards/risks/views/by-type')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败。'))
  }, [])

  if (error) return <ErrorState message={error} />
  if (!data) return <LoadingState label="加载按类型分布…" />

  return (
    <BoardShell
      boardId="risks"
      boardLabel="风险预警"
      title="风险按类型分布"
      description="9 类风险按类型聚合 · 物料级 5 类 + L2 节点级 4 类"
      views={VIEWS}
      kpis={data.kpis.map((k, i) => <KpiCard key={i} kpi={k} />)}
    >
      {data.rows.map((group) => (
        <article key={group.type} className="panel">
          <div className="panel-title">
            <div>
              <strong>{group.label}</strong>
              <small style={{ marginLeft: 8, color: 'var(--text-muted)' }}>共 {group.total} 项</small>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="status-badge status-red"><span className="dot" />红 {group.red}</span>
              <span className="status-badge status-orange"><span className="dot" />橙 {group.orange}</span>
              <span className="status-badge status-yellow"><span className="dot" />黄 {group.yellow}</span>
              <span className="status-badge status-green"><span className="dot" />绿 {group.green}</span>
            </div>
          </div>
          <table className="table">
            <thead><tr><th>风险</th><th>等级</th><th>状态</th><th>物料</th><th>说明</th><th>开放措施</th></tr></thead>
            <tbody>
              {group.risks.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.id}</strong></td>
                  <td><StatusBadge status={r.level} short /></td>
                  <td>{r.status === 'CLOSED' ? '已闭环' : r.status === 'IN_PROGRESS' ? '跟进中' : '待处理'}</td>
                  <td>{r.materialName}<small style={{ display: 'block', color: 'var(--text-muted)' }}>{r.supplierName}</small></td>
                  <td><small>{r.description}</small></td>
                  <td>{r.openActions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ))}
    </BoardShell>
  )
}