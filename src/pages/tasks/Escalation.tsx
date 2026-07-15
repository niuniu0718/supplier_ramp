import { useEffect, useState } from 'react'
import { BoardShell } from '../../components/layout/BoardShell'
import { KpiCard } from '../../components/ui/KpiCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { ErrorState, LoadingState } from '../../components/ui/States'
import { api } from '../../lib/api'
import type { TasksEscalationPayload, TaskRow } from '../../types'

const VIEWS = [
  { to: '/board/tasks/view/my-todo', label: '我的待办' },
  { to: '/board/tasks/view/overdue', label: '逾期仪表盘' },
  { to: '/board/tasks/view/escalation', label: '升级路径' },
  { to: '/board/tasks/view/closure', label: '闭环统计' },
]

export function TasksEscalation() {
  const [data, setData] = useState<TasksEscalationPayload | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<TasksEscalationPayload>('/api/boards/tasks/views/escalation')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败。'))
  }, [])

  if (error) return <ErrorState message={error} />
  if (!data) return <LoadingState label="加载升级路径…" />

  const renderTable = (rows: TaskRow[], empty: string) => (
    <table className="table">
      <thead><tr><th>任务</th><th>等级</th><th>截止</th><th>剩余</th><th>责任人</th><th>进度</th></tr></thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{empty}</td></tr>
        ) : rows.map((t) => (
          <tr key={t.id}>
            <td><strong>{t.id}</strong><small style={{ display: 'block' }}>{t.title}</small></td>
            <td><StatusBadge status={t.riskLevel ?? 'GREEN'} short /></td>
            <td>{new Date(t.deadline).toLocaleDateString('zh-CN')}</td>
            <td>{t.daysToDeadline} 天</td>
            <td>{t.ownerName}</td>
            <td>{t.progress}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <BoardShell
      boardId="tasks"
      boardLabel="措施跟进"
      title="任务升级路径"
      description="3 天内提醒 → 逾期抄送 → 逾期 7 天升级到领导"
      views={VIEWS}
      kpis={data.kpis.map((k, i) => <KpiCard key={i} kpi={k} />)}
    >
      <div className="escalation-grid">
        <section className="escalation-section">
          <header><h3>🟡 3 天内到期</h3><small>{data.remind.length} 项</small></header>
          {renderTable(data.remind, '暂无')}
        </section>
        <section className="escalation-section">
          <header><h3>🟠 已逾期</h3><small>{data.overdue.length} 项</small></header>
          {renderTable(data.overdue, '暂无')}
        </section>
        <section className="escalation-section">
          <header><h3>🔴 逾期 ≥ 7 天（升级）</h3><small>{data.escalated.length} 项</small></header>
          {renderTable(data.escalated, '暂无')}
        </section>
      </div>
    </BoardShell>
  )
}