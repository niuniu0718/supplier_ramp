import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Circle, Clock } from 'lucide-react'
import { BoardShell } from '../../components/layout/BoardShell'
import { KpiCard } from '../../components/ui/KpiCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { ErrorState, LoadingState } from '../../components/ui/States'
import { api } from '../../lib/api'
import type { ExpansionMilestoneItem, ExpansionTimelinePayload, ExpansionTimelineRow } from '../../types'

const VIEWS = [
  { to: '/board/expansion/view/overview', label: '进度总览' },
  { to: '/board/expansion/view/timeline', label: '里程碑时间轴' },
  { to: '/board/expansion/view/evidence', label: '证据档案' },
]

const STATUS_COLOR: Record<string, string> = {
  GREEN: 'var(--green)',
  YELLOW: 'var(--yellow)',
  ORANGE: 'var(--orange)',
  RED: 'var(--red)',
}

const ITEM_STATUS_META: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  '已投产': { label: '已投产', color: 'var(--green)', icon: CheckCircle2 },
  '已调试': { label: '已调试', color: 'var(--green)', icon: CheckCircle2 },
  '已到货': { label: '已到货', color: 'var(--green)', icon: CheckCircle2 },
  '部分到货': { label: '部分到货', color: 'var(--orange)', icon: Clock },
  '已签': { label: '已签合同', color: 'var(--primary)', icon: Circle },
}

function itemMeta(status: string) {
  return ITEM_STATUS_META[status] ?? { label: status, color: 'var(--text-muted)', icon: Circle }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

export function ExpansionTimeline() {
  const [data, setData] = useState<ExpansionTimelinePayload | null>(null)
  const [error, setError] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)

  useEffect(() => {
    api.get<ExpansionTimelinePayload>('/api/boards/expansion/views/timeline')
      .then((d) => {
        setData(d)
        const firstOverdue = d.rows.find((r) => r.overdueCount > 0) ?? d.rows[0]
        if (firstOverdue) setSelectedPlanId(firstOverdue.id)
      })
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败。'))
  }, [])

  const now = Date.now()
  const months = useMemo(() => {
    if (!data) return []
    const starts = data.rows.map((r) => new Date(r.startDate).getTime())
    const ends = data.rows.map((r) => new Date(r.endDate).getTime())
    const minStart = Math.min(...starts)
    const maxEnd = Math.max(...ends)
    const total = maxEnd - minStart
    if (total <= 0) return []
    const list: { label: string; pct: number }[] = []
    const start = new Date(minStart)
    start.setDate(1)
    const end = new Date(maxEnd)
    end.setMonth(end.getMonth() + 1)
    end.setDate(1)
    const cur = new Date(start)
    while (cur < end) {
      const pct = ((cur.getTime() - minStart) / total) * 100
      list.push({
        label: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`,
        pct,
      })
      cur.setMonth(cur.getMonth() + 1)
    }
    return list
  }, [data])

  if (error) return <ErrorState message={error} />
  if (!data) return <LoadingState label="加载时间轴…" />

  const starts = data.rows.map((r) => new Date(r.startDate).getTime())
  const ends = data.rows.map((r) => new Date(r.endDate).getTime())
  const minStart = Math.min(...starts)
  const maxEnd = Math.max(...ends)
  const total = maxEnd - minStart

  const selected = data.rows.find((r) => r.id === selectedPlanId) ?? data.rows[0]
  const overdueItems = data.rows.reduce((sum, r) => sum + r.overdueCount, 0)
  const totalItems = data.rows.reduce((sum, r) => sum + r.items.length, 0)

  return (
    <BoardShell
      boardId="expansion"
      boardLabel="扩产跟踪"
      title="里程碑时间轴"
      description="Gantt + 关键阀点；点击任意计划查看阀点明细，逾期阀点变红并显示滞后天数"
      views={VIEWS}
      kpis={[
        ...data.kpis.map((k, i) => <KpiCard key={i} kpi={k} />),
        <KpiCard
          key="overdue"
          kpi={{
            label: '逾期阀点',
            value: overdueItems,
            unit: `/${totalItems}`,
            tone: overdueItems > 0 ? 'red' : 'green',
            hint: overdueItems > 0 ? '需介入' : '全部按时',
          }}
        />,
      ]}
    >
      <div className="timeline-split">
        <article className="panel timeline-gantt">
          <header className="panel-title">
            <strong>扩产甘特图</strong>
            <small className="muted">点击计划查看阀点</small>
          </header>
          <div className="gantt-axis">
            {months.map((m) => (
              <span key={m.label} style={{ left: `${m.pct}%` }}>{m.label}</span>
            ))}
          </div>
          <div className="gantt-rows">
            {data.rows.map((row) => {
              const seg = segmentFor(row, minStart, total)
              const expMarker = ((now - new Date(row.startDate).getTime()) /
                (new Date(row.endDate).getTime() - new Date(row.startDate).getTime())) * 100
              const isSelected = row.id === selected?.id
              return (
                <button
                  key={row.id}
                  type="button"
                  className={`gantt-row ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => setSelectedPlanId(row.id)}
                >
                  <div className="gantt-row-label">
                    <strong>{row.name}</strong>
                    <small>{row.supplierName} · {row.materialName}</small>
                    <div className="gantt-row-meta">
                      <span className="stage">{row.stage}</span>
                      <StatusBadge status={row.status} short />
                      {row.overdueCount > 0 && (
                        <span className="overdue-badge">
                          <AlertTriangle size={11} /> {row.overdueCount} 项逾期
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="gantt-track">
                    <div
                      className="gantt-bar"
                      style={{
                        left: `${seg.left}%`,
                        width: `${seg.width}%`,
                        background: STATUS_COLOR[row.status] ?? 'var(--primary)',
                      }}
                    />
                    {row.items.map((it) => {
                      const pct = ((new Date(it.expectedArrival).getTime() - minStart) / total) * 100
                      if (pct < 0 || pct > 100) return null
                      return (
                        <span
                          key={it.id}
                          className={`milestone ${it.overdue ? 'is-overdue' : ''}`}
                          style={{ left: `${pct}%` }}
                          title={`${it.name} · 预计 ${fmtDate(it.expectedArrival)}${it.overdue ? ` · 逾期 ${it.delayDays} 天` : ''}`}
                        />
                      )
                    })}
                    <span className="gantt-expected" style={{ left: `${Math.min(100, Math.max(0, expMarker))}%` }} />
                  </div>
                  <div className="gantt-progress">
                    <strong>{row.progress}%</strong>
                    <small className="muted">/ 预期 {row.expectedProgress}%</small>
                  </div>
                </button>
              )
            })}
          </div>
        </article>

        <aside className="panel timeline-milestones">
          {selected ? (
            <>
              <header className="panel-title">
                <div>
                  <strong>{selected.name}</strong>
                  <small className="muted">{selected.supplierName} · {selected.materialName}</small>
                </div>
                <StatusBadge status={selected.status} short />
              </header>
              <MilestoneList plan={selected} />
            </>
          ) : (
            <LoadingState label="选择计划…" />
          )}
        </aside>
      </div>
    </BoardShell>
  )
}

function segmentFor(row: ExpansionTimelineRow, minStart: number, total: number) {
  const start = new Date(row.startDate).getTime()
  const end = new Date(row.endDate).getTime()
  if (total <= 0) return { left: 0, width: 100 }
  return {
    left: ((start - minStart) / total) * 100,
    width: ((end - start) / total) * 100,
  }
}

function MilestoneList({ plan }: { plan: ExpansionTimelineRow }) {
  if (plan.items.length === 0) {
    return <p className="muted" style={{ padding: 16 }}>暂无阀点</p>
  }
  return (
    <div className="milestone-list">
      <div className="milestone-head">
        <span>阀点</span>
        <span>预计 / 实际</span>
        <span>状态</span>
      </div>
      {plan.items.map((it) => (
        <MilestoneRow key={it.id} item={it} />
      ))}
    </div>
  )
}

function MilestoneRow({ item }: { item: ExpansionMilestoneItem }) {
  const meta = itemMeta(item.status)
  const Icon = meta.icon
  return (
    <div className={`milestone-row ${item.overdue ? 'is-overdue' : ''}`}>
      <div className="milestone-cell-main">
        <span className="milestone-name">
          <Icon size={14} color={meta.color} />
          {item.name}
        </span>
        <small className="muted">
          {item.type} · {item.vendor}
          {item.orderNo ? ` · ${item.orderNo}` : ''}
        </small>
      </div>
      <div className="milestone-cell-date">
        <span>预计 {fmtDate(item.expectedArrival)}</span>
        <small className={item.overdue ? 'text-red' : 'muted'}>
          {item.actualArrival
            ? `实际 ${fmtDate(item.actualArrival)}`
            : item.overdue
              ? `实际 —`
              : '实际 —'}
        </small>
      </div>
      <div className="milestone-cell-status">
        <span
          className="milestone-pill"
          style={{ background: `${meta.color}1a`, color: meta.color, border: `1px solid ${meta.color}40` }}
        >
          {meta.label}
        </span>
        {item.overdue && (
          <span className="overdue-badge">
            <AlertTriangle size={11} /> 逾期 {item.delayDays} 天
          </span>
        )}
      </div>
    </div>
  )
}