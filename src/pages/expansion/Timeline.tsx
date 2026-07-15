import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, type LucideIcon } from 'lucide-react'
import { BoardShell } from '../../components/layout/BoardShell'
import { KpiCard } from '../../components/ui/KpiCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { ErrorState, LoadingState } from '../../components/ui/States'
import { api } from '../../lib/api'
import { MILESTONE_TEMPLATE, milestoneStatusMeta } from '../../lib/milestone'
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

const MS_DAY = 86_400_000
const MS_MONTH = 30 * MS_DAY

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

export function ExpansionTimeline() {
  const [data, setData] = useState<ExpansionTimelinePayload | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<ExpansionTimelinePayload>('/api/boards/expansion/views/timeline')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败。'))
  }, [])

  const now = Date.now()
  const axis = useMemo(() => {
    if (!data) return { labels: [] as { pct: number; label: string; offset: 'up' | 'down' }[], totalSpan: 0 }
    const starts = data.rows.map((r) => new Date(r.startDate).getTime())
    const ends = data.rows.map((r) => new Date(r.endDate).getTime())
    const minStart = Math.min(...starts)
    const maxEnd = Math.max(...ends)
    const total = maxEnd - minStart
    if (total <= 0) return { labels: [], totalSpan: total }
    const monthCount = Math.ceil(total / MS_MONTH)
    const step = monthCount > 18 ? 3 : monthCount > 12 ? 2 : 1
    const start = new Date(minStart)
    start.setDate(1)
    const labels: { pct: number; label: string; offset: 'up' | 'down' }[] = []
    const cur = new Date(start)
    let i = 0
    while (cur.getTime() < maxEnd) {
      if (i % step === 0) {
        const pct = ((cur.getTime() - minStart) / total) * 100
        const yy = String(cur.getFullYear()).slice(2)
        const mm = cur.getMonth() + 1
        labels.push({
          pct,
          label: `${yy}-${String(mm).padStart(2, '0')}`,
          offset: i % (step * 2) === 0 ? 'up' : 'down',
        })
      }
      cur.setMonth(cur.getMonth() + 1)
      i++
    }
    return { labels, totalSpan: total }
  }, [data])

  if (error) return <ErrorState message={error} />
  if (!data) return <LoadingState label="加载时间轴…" />

  const starts = data.rows.map((r) => new Date(r.startDate).getTime())
  const ends = data.rows.map((r) => new Date(r.endDate).getTime())
  const minStart = Math.min(...starts)
  const maxEnd = Math.max(...ends)
  const total = maxEnd - minStart

  const overdueItems = data.rows.reduce((sum, r) => sum + r.overdueCount, 0)
  const totalItems = data.rows.reduce((sum, r) => sum + r.items.length, 0)
  const completedMilestones = data.rows.reduce(
    (sum, r) => sum + r.items.filter((it) => milestoneStatusMeta(it.status).tone === 'done').length,
    0,
  )
  const allItems = data.rows.flatMap((r) => r.items)

  return (
    <BoardShell
      boardId="expansion"
      boardLabel="扩产跟踪"
      title="里程碑时间轴"
      description="8 个标准阀点 · 5 个扩产计划横向对比 · 供应商/采购双侧明细"
      views={VIEWS}
      kpis={[
        ...data.kpis.map((k, i) => <KpiCard key={i} kpi={k} />),
        <KpiCard
          key="completed"
          kpi={{
            label: '已完成阀点',
            value: completedMilestones,
            unit: `/${allItems.length}`,
            tone: 'green',
            hint: `5 家供应商累计完成进度`,
          }}
        />,
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
      <article className="panel timeline-gantt">
        <header className="panel-title">
          <strong>扩产甘特图</strong>
          <small className="muted">每行 8 个标准阀点</small>
        </header>
        <div className="gantt-axis">
          {axis.labels.map((m, idx) => (
            <span
              key={`${m.label}-${idx}`}
              className={`gantt-axis-label gantt-axis-${m.offset}`}
              style={{ left: `${m.pct}%` }}
            >
              {m.label}
            </span>
          ))}
        </div>
        <div className="gantt-rows">
          {data.rows.map((row) => {
            const seg = segmentFor(row, minStart, total)
            const expMarker =
              ((now - new Date(row.startDate).getTime()) /
                (new Date(row.endDate).getTime() - new Date(row.startDate).getTime())) *
              100
            const completedCount = row.items.filter(
              (it) => milestoneStatusMeta(it.status).tone === 'done',
            ).length
            return (
              <div key={row.id} className="gantt-row">
                <div className="gantt-row-label">
                  <strong>{row.name}</strong>
                  <small>{row.supplierName} · {row.materialName}</small>
                  <div className="gantt-row-meta">
                    <span className="stage">{row.stage}</span>
                    <StatusBadge status={row.status} short />
                    <span className="evidence-tag" style={{ background: '#e6f8f1', color: 'var(--green)' }}>
                      {completedCount}/8 已完成
                    </span>
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
                  {MILESTONE_TEMPLATE.map((m, idx) => {
                    const item = row.items.find((it) => it.milestoneKey === m.key)
                    const pct = 4 + (idx / 7) * 92
                    const meta = item ? milestoneStatusMeta(item.status) : null
                    const overdue = item?.overdue
                    return (
                      <span
                        key={m.key}
                        className={`milestone-dot ${meta?.tone ?? 'pending'} ${overdue ? 'is-overdue' : ''}`}
                        style={{ left: `${pct}%` }}
                        title={
                          item
                            ? `${idx + 1}. ${m.name} · ${meta?.label ?? item.status}${overdue ? ` · 逾期 ${item.delayDays} 天` : ''}`
                            : `${idx + 1}. ${m.name} · 未开始`
                        }
                      >
                        {idx + 1}
                      </span>
                    )
                  })}
                  <span className="gantt-expected" style={{ left: `${Math.min(100, Math.max(0, expMarker))}%` }} />
                </div>
                <div className="gantt-progress">
                  <strong>{row.progress}%</strong>
                  <small className="muted">/ 预期 {row.expectedProgress}%</small>
                </div>
              </div>
            )
          })}
        </div>
      </article>

      <section className="timeline-all-milestones">
        <header className="timeline-all-head">
          <strong>全部阀点明细（共 {allItems.length} 项 · 每计划 8 个标准阶段）</strong>
          <small className="muted">每张卡片包含：阀点序号 · 名称 · 状态 · 计划/实际日期 · 供应商侧 · 采购侧</small>
        </header>
        {data.rows.map((row) => (
          <div key={row.id} className="timeline-plan-group">
            <header className="timeline-plan-group-head">
              <div>
                <strong>{row.name}</strong>
                <small className="muted">{row.supplierName} · {row.materialName}</small>
              </div>
              <StatusBadge status={row.status} short />
            </header>
            <div className="milestone-grid">
              {MILESTONE_TEMPLATE.map((tmpl, idx) => {
                const item = row.items.find((it) => it.milestoneKey === tmpl.key)
                return (
                  <MilestoneCard
                    key={tmpl.key}
                    order={idx + 1}
                    templateName={tmpl.name}
                    TemplateIcon={tmpl.icon}
                    item={item}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </section>
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

interface MilestoneCardProps {
  order: number
  templateName: string
  TemplateIcon: LucideIcon
  item?: ExpansionMilestoneItem
}

function MilestoneCard({ order, templateName, TemplateIcon, item }: MilestoneCardProps) {
  const meta = item ? milestoneStatusMeta(item.status) : milestoneStatusMeta('待开始')
  const Icon = item ? TemplateIcon : TemplateIcon
  return (
    <div className={`milestone-card ${item?.overdue ? 'is-overdue' : ''} tone-${meta.tone}`}>
      <header className="milestone-card-head">
        <span className="milestone-step-badge">{order}</span>
        <div className="milestone-card-title">
          <Icon size={14} color={meta.color} />
          <strong>{templateName}</strong>
        </div>
      </header>
      <div className="milestone-card-meta">
        <span
          className="milestone-pill"
          style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.ring}40` }}
        >
          {item?.status ?? '待开始'}
        </span>
        {item?.overdue && (
          <span className="overdue-badge">
            <AlertTriangle size={11} /> 逾期 {item.delayDays} 天
          </span>
        )}
      </div>
      <div className="milestone-card-dates">
        <div>
          <small className="muted">计划</small>
          <span>{item ? fmtDate(item.expectedArrival) : '—'}</span>
        </div>
        <div>
          <small className="muted">实际</small>
          <span className={item?.actualArrival ? '' : 'muted'}>
            {item?.actualArrival ? fmtDate(item.actualArrival) : '—'}
          </span>
        </div>
      </div>
      <div className="milestone-card-sides">
        <div className="milestone-side milestone-side-supplier">
          <div className="milestone-side-label">供应商侧</div>
          <p>{item?.supplierAction || '尚未约定'}</p>
        </div>
        <div className="milestone-side milestone-side-procurement">
          <div className="milestone-side-label">采购侧</div>
          <p>{item?.procurementAction || '尚未约定'}</p>
        </div>
      </div>
    </div>
  )
}