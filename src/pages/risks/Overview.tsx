import { useEffect, useState } from 'react'
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { BoardShell } from '../../components/layout/BoardShell'
import { KpiCard } from '../../components/ui/KpiCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { ErrorState, LoadingState } from '../../components/ui/States'
import { api } from '../../lib/api'
import { typeBadgeMeta } from '../../lib/risk'
import type { RisksOverviewPayload } from '../../types'

const VIEWS = [
  { to: '/board/risks/view/overview', label: '风险总览' },
  { to: '/board/risks/view/by-type', label: '按类型分布' },
  { to: '/board/risks/view/escalation', label: '升级路径' },
  { to: '/board/risks/view/closure', label: '闭环统计' },
]

export function RisksOverview() {
  const [data, setData] = useState<RisksOverviewPayload | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<RisksOverviewPayload>('/api/boards/risks/views/overview')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败。'))
  }, [])

  if (error) return <ErrorState message={error} />
  if (!data) return <LoadingState label="加载风险总览…" />

  return (
    <BoardShell
      boardId="risks"
      boardLabel="风险预警"
      title="风险总览"
      description="所有物料风险的红黄绿灯、状态、关联措施 · L2 节点级风险会自动反查源头节点"
      views={VIEWS}
      kpis={data.kpis.map((k, i) => <KpiCard key={i} kpi={k} icon={[AlertTriangle, ShieldAlert, ShieldAlert, ShieldAlert, ShieldAlert, ShieldAlert][i] ?? AlertTriangle} />)}
    >
      <article className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>风险 ID</th>
              <th>物料 / 供应商</th>
              <th>类型</th>
              <th>等级</th>
              <th>状态</th>
              <th>关联节点</th>
              <th>描述</th>
              <th>措施</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => {
              const typeMeta = typeBadgeMeta(r.type)
              return (
                <tr key={r.id}>
                  <td><strong>{r.id}</strong></td>
                  <td>
                    <strong>{r.materialName}</strong>
                    <small style={{ display: 'block', color: 'var(--text-muted)' }}>{r.supplierName}</small>
                  </td>
                  <td>
                    <span className={`milestone-pill tone-${typeMeta.tone}`}>{typeMeta.label}</span>
                  </td>
                  <td><StatusBadge status={r.level} short /></td>
                  <td>{r.status === 'CLOSED' ? <span className="muted">已闭环</span> : r.status === 'IN_PROGRESS' ? '跟进中' : '待处理'}</td>
                  <td>
                    {r.source ? (
                      <a
                        className="risk-source-link"
                        href={`/board/expansion/view/timeline#plan-group-${r.source.planId}`}
                        title="点击跳转到 timeline 对应节点"
                      >
                        <span className="risk-source-kind">{r.source.kind}</span>
                        <strong>{r.source.label}</strong>
                        <small className="muted">{r.source.planName}</small>
                      </a>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td><small>{r.description}</small></td>
                  <td><strong>{r.openActionCount}</strong><small className="muted"> / {r.actionCount}</small></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </article>
    </BoardShell>
  )
}
