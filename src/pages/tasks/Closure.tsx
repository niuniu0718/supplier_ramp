import { useEffect, useState } from 'react'
import { BoardShell } from '../../components/layout/BoardShell'
import { KpiCard } from '../../components/ui/KpiCard'
import { ErrorState, LoadingState } from '../../components/ui/States'
import { api } from '../../lib/api'
import type { TasksClosurePayload } from '../../types'

const VIEWS = [
  { to: '/board/tasks/view/my-todo', label: '我的待办' },
  { to: '/board/tasks/view/overdue', label: '逾期仪表盘' },
  { to: '/board/tasks/view/escalation', label: '升级路径' },
  { to: '/board/tasks/view/closure', label: '闭环统计' },
]

const TYPE_LABELS: Record<string, string> = {
  SINGLE_SOURCE: '单点依赖',
  LOW_INVENTORY: '库存不足',
  PRICE: '价格异常',
  POLICY: '政策风险',
  QUALITY: '质量风险',
}

export function TasksClosure() {
  const [data, setData] = useState<TasksClosurePayload | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<TasksClosurePayload>('/api/boards/tasks/views/closure')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败。'))
  }, [])

  if (error) return <ErrorState message={error} />
  if (!data) return <LoadingState label="加载闭环统计…" />

  return (
    <BoardShell
      boardId="tasks"
      boardLabel="措施跟进"
      title="措施闭环统计"
      description="本周/本月闭环数、按优先级分布"
      views={VIEWS}
      kpis={data.kpis.map((k, i) => <KpiCard key={i} kpi={k} />)}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <article className="panel">
          <div className="panel-title"><strong>按优先级</strong></div>
          <table className="table">
            <thead><tr><th>优先级</th><th>闭环数</th></tr></thead>
            <tbody>
              {data.byPriority.map((b) => (
                <tr key={b.priority}><td><span className="evidence-tag">{b.priority}</span></td><td><strong>{b.count}</strong></td></tr>
              ))}
            </tbody>
          </table>
        </article>
        <article className="panel">
          <div className="panel-title"><strong>闭环明细</strong></div>
          <table className="table">
            <thead><tr><th>任务</th><th>风险类型</th><th>优先级</th><th>耗时</th></tr></thead>
            <tbody>
              {data.rows.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.id}</strong><small style={{ display: 'block' }}>{t.title}</small></td>
                  <td>{TYPE_LABELS[t.riskType] ?? t.riskType}</td>
                  <td><span className="evidence-tag">{t.priority}</span></td>
                  <td>{t.durationDays} 天</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </div>
    </BoardShell>
  )
}