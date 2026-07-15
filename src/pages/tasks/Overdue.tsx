import { useEffect, useState } from 'react'
import { BoardShell } from '../../components/layout/BoardShell'
import { KpiCard } from '../../components/ui/KpiCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { ErrorState, LoadingState } from '../../components/ui/States'
import { api } from '../../lib/api'
import type { TasksOverduePayload } from '../../types'

const VIEWS = [
  { to: '/board/tasks/view/my-todo', label: '我的待办' },
  { to: '/board/tasks/view/overdue', label: '逾期仪表盘' },
  { to: '/board/tasks/view/escalation', label: '升级路径' },
  { to: '/board/tasks/view/closure', label: '闭环统计' },
]

export function TasksOverdue() {
  const [data, setData] = useState<TasksOverduePayload | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<TasksOverduePayload>('/api/boards/tasks/views/overdue')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败。'))
  }, [])

  if (error) return <ErrorState message={error} />
  if (!data) return <LoadingState label="加载逾期仪表盘…" />

  return (
    <BoardShell
      boardId="tasks"
      boardLabel="措施跟进"
      title="逾期仪表盘"
      description="所有逾期的任务，按风险等级和逾期天数排序"
      views={VIEWS}
      kpis={data.kpis.map((k, i) => <KpiCard key={i} kpi={k} />)}
    >
      <article className="panel">
        <table className="table">
          <thead><tr><th>任务</th><th>风险等级</th><th>责任人</th><th>物料</th><th>逾期天数</th><th>进度</th><th>证据</th></tr></thead>
          <tbody>
            {data.rows.map((t) => (
              <tr key={t.id}>
                <td><strong>{t.id}</strong><small style={{ display: 'block' }}>{t.title}</small></td>
                <td><StatusBadge status={t.riskLevel ?? 'GREEN'} short /></td>
                <td>{t.ownerName}</td>
                <td>{t.materialName}<small style={{ display: 'block', color: 'var(--text-muted)' }}>{t.supplierName}</small></td>
                <td><strong style={{ color: 'var(--red)' }}>{t.daysOverdue}</strong></td>
                <td>{t.progress}%</td>
                <td>{t.attachmentCount ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </BoardShell>
  )
}