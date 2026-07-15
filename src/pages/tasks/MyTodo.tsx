import { useEffect, useState } from 'react'
import { CheckSquare } from 'lucide-react'
import { BoardShell } from '../../components/layout/BoardShell'
import { KpiCard } from '../../components/ui/KpiCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { ErrorState, LoadingState } from '../../components/ui/States'
import { api } from '../../lib/api'
import type { TasksMyTodoPayload } from '../../types'

const VIEWS = [
  { to: '/board/tasks/view/my-todo', label: '我的待办' },
  { to: '/board/tasks/view/overdue', label: '逾期仪表盘' },
  { to: '/board/tasks/view/escalation', label: '升级路径' },
  { to: '/board/tasks/view/closure', label: '闭环统计' },
]

export function TasksMyTodo() {
  const [data, setData] = useState<TasksMyTodoPayload | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<TasksMyTodoPayload>('/api/boards/tasks/views/my-todo')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败。'))
  }, [])

  if (error) return <ErrorState message={error} />
  if (!data) return <LoadingState label="加载我的待办…" />

  return (
    <BoardShell
      boardId="tasks"
      boardLabel="措施跟进"
      title="我的待办"
      description="我作为责任人的所有进行中任务"
      views={VIEWS}
      kpis={data.kpis.map((k, i) => <KpiCard key={i} kpi={k} icon={CheckSquare} />)}
    >
      <article className="panel">
        <table className="table">
          <thead><tr><th>任务</th><th>关联风险</th><th>等级</th><th>截止</th><th>剩余/逾期</th><th>进度</th><th>证据</th></tr></thead>
          <tbody>
            {data.rows.map((t) => {
              const overdue = (t.daysToDeadline ?? 0) < 0
              const remind = (t.daysToDeadline ?? 0) >= 0 && (t.daysToDeadline ?? 0) <= 3
              return (
                <tr key={t.id}>
                  <td><strong>{t.id}</strong><small style={{ display: 'block' }}>{t.title}</small></td>
                  <td>{t.riskType ?? '—'}<small style={{ display: 'block', color: 'var(--text-muted)' }}>{t.materialName ?? ''}</small></td>
                  <td><StatusBadge status={t.riskLevel ?? 'GREEN'} short /></td>
                  <td>{new Date(t.deadline).toLocaleDateString('zh-CN')}</td>
                  <td>
                    {overdue && <span style={{ color: 'var(--red)' }}>逾期 {-t.daysToDeadline!} 天</span>}
                    {remind && <span style={{ color: 'var(--yellow)' }}>剩 {t.daysToDeadline} 天</span>}
                    {!overdue && !remind && <span className="muted">{t.daysToDeadline} 天</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 80, height: 6, background: 'var(--surface-muted)', borderRadius: 999 }}>
                        <div style={{ width: `${t.progress}%`, height: '100%', background: 'var(--primary)', borderRadius: 999 }} />
                      </div>
                      <strong>{t.progress}%</strong>
                    </div>
                  </td>
                  <td>{t.attachmentCount ?? 0}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </article>
    </BoardShell>
  )
}