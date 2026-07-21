import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, Pencil, Plus, Trash2, Upload, type LucideIcon } from 'lucide-react'
import { BoardShell } from '../../components/layout/BoardShell'
import { KpiCard } from '../../components/ui/KpiCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { ErrorState, LoadingState } from '../../components/ui/States'
import { PlanEditModal } from '../../components/expansion/PlanEditModal'
import { PlanCreateModal } from '../../components/expansion/PlanCreateModal'
import { MilestoneEditModal } from '../../components/expansion/MilestoneEditModal'
import { EvidenceChipList } from '../../components/expansion/EvidenceChipList'
import { Modal } from '../../components/ui/Modal'
import { EvidencePreviewModal } from '../../components/expansion/EvidencePreviewModal'
import { ApprovalEditModal } from '../../components/expansion/ApprovalEditModal'
import { CommissioningEditModal } from '../../components/expansion/CommissioningEditModal'
import { RampEditModal } from '../../components/expansion/RampEditModal'
import { EvidenceUploadModal } from '../../components/expansion/EvidenceUploadModal'
import { UpgradeRiskModal } from '../../components/expansion/UpgradeRiskModal'
import { api } from '../../lib/api'
import { APPROVAL_CYCLE_BY_KEY, approvalStatusMeta } from '../../lib/approval'
import { MILESTONE_TEMPLATE, milestoneStatusMeta } from '../../lib/milestone'
import { COMMISSIONING_TYPES, commissioningStatusMeta } from '../../lib/commissioning'
import { RAMP_PHASES, rampStatusMeta } from '../../lib/ramp'
import { LEVEL_LABEL, LEVEL_TONE, typeBadgeMeta } from '../../lib/risk'
import type {
  ApprovalRow,
  CommissioningRow,
  EvidenceAttachment,
  ExpansionMilestoneItem,
  ExpansionTimelinePayload,
  ExpansionTimelineRow,
  PendingRiskSignal,
  RampRow,
  RiskSourceKind,
  UpgradedRiskRef,
} from '../../types'

const VIEWS = [
  { to: '/board/expansion/view/overview', label: '进度总览' },
  { to: '/board/expansion/view/timeline', label: '里程碑时间轴' },
  { to: '/board/expansion/view/evidence', label: '证据档案' },
]

const MS_DAY = 86_400_000
const MS_MONTH = 30 * MS_DAY

const PILL_META: Record<string, { label: string; color: string; bg: string }> = {
  done: { label: '已完成', color: 'var(--green)', bg: '#e6f8f1' },
  progress: { label: '进行中', color: 'var(--orange)', bg: '#fff0e3' },
  pending: { label: '待开始', color: 'var(--text-muted)', bg: '#eef2f7' },
  overdue: { label: '已逾期', color: 'var(--red)', bg: '#ffe4e0' },
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  const yy = String(d.getFullYear()).slice(2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}/${mm}/${dd}`
}

function fmtDateOpt(iso: string | null) {
  return iso ? fmtDate(iso) : '—'
}

function fmtYM(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  const yy = String(d.getFullYear()).slice(2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}/${mm}/${dd}`
}

function fmtYMD(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  const yy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

// "最近一次升级时间"：优先 updatedAt（每次保存更新都会刷新），没有则回退 discoveredAt
function upgradeDate(ref: UpgradedRiskRef | null | undefined): string {
  if (!ref) return ''
  return fmtYMD(ref.updatedAt || ref.discoveredAt)
}

type SectionKey = 'milestones' | 'approvals' | 'commissionings' | 'ramps'

const COLLAPSE_STORAGE_KEY = 'supplier_ramp.timeline.collapsedSections'

function loadCollapsedSections(): Record<string, Set<SectionKey>> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(COLLAPSE_STORAGE_KEY)
    if (!raw) return {}
    const obj = JSON.parse(raw)
    const result: Record<string, Set<SectionKey>> = {}
    for (const [k, v] of Object.entries(obj as Record<string, string[]>)) {
      result[k] = new Set((v ?? []).filter((s) => ['milestones', 'approvals', 'commissionings', 'ramps'].includes(s)) as SectionKey[])
    }
    return result
  } catch {
    return {}
  }
}
function saveCollapsedSections(map: Record<string, Set<SectionKey>>) {
  if (typeof window === 'undefined') return
  try {
    const out: Record<string, string[]> = {}
    for (const [k, v] of Object.entries(map)) out[k] = Array.from(v)
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(out))
  } catch { /* noop */ }
}

// 悬浮说明框：包裹任意子元素，悬停时在下方展开一个轻量说明卡。
// 文本支持多行（\n 转为换行），用于阀点的关键交付物说明。
function HoverNote({ text, children }: { text: string; children: React.ReactElement }) {
  const [open, setOpen] = useState(false)
  if (!text) return children
  return (
    <span
      className={`hover-note ${open ? 'is-open' : ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span className="hover-note-bubble" role="tooltip">
          <span className="hover-note-title">关键交付物</span>
          <span className="hover-note-body">{text}</span>
        </span>
      )}
    </span>
  )
}

// L2 完成态摘要：折叠时在标题旁简短提示该 plan 的整体进度
// 仅返回非零项，按"已逾期 → 进行中 → 已完成"反向优先级排序以便一眼看到风险
type SummaryChip = { label: string; tone: 'green' | 'orange' | 'red' | 'gray' }

function summarizeMilestones(row: ExpansionTimelineRow): { total: number; chips: SummaryChip[] } {
  const items = row.items
  let done = 0, overdue = 0, progress = 0, pending = 0
  for (const it of items) {
    if (it.actualArrival || it.status === '已完成') done++
    else if (it.overdue || it.status === '已逾期') overdue++
    else if (it.status === '进行中') progress++
    else pending++
  }
  const chips: SummaryChip[] = []
  // 逾期优先前置，红框粗体作为首要警示
  if (overdue) chips.push({ label: `⚠ 已逾期 ${overdue} 项`, tone: 'red' })
  if (done && done === items.length) chips.push({ label: `已全部完成`, tone: 'green' })
  else if (done) chips.push({ label: `${done}/${items.length} 已完成`, tone: 'green' })
  if (progress) chips.push({ label: `${progress} 进行中`, tone: 'orange' })
  if (pending) chips.push({ label: `${pending} 未开始`, tone: 'gray' })
  return { total: items.length, chips }
}

function summarizeApprovals(row: ExpansionTimelineRow): { total: number; chips: SummaryChip[] } {
  const list = row.approvals
  let done = 0, overdue = 0, progress = 0, pending = 0
  for (const a of list) {
    if (a.status === '已完成') done++
    else if (a.status === '已逾期') overdue++
    else if (a.status === '进行中') progress++
    else pending++
  }
  const chips: SummaryChip[] = []
  if (overdue) chips.push({ label: `⚠ 已逾期 ${overdue} 项`, tone: 'red' })
  if (done && done === list.length) chips.push({ label: `已全部批复`, tone: 'green' })
  else if (done) chips.push({ label: `${done}/${list.length} 已批复`, tone: 'green' })
  if (progress) chips.push({ label: `${progress} 进行中`, tone: 'orange' })
  if (pending) chips.push({ label: `${pending} 未开始`, tone: 'gray' })
  return { total: list.length, chips }
}

function summarizeCommissionings(row: ExpansionTimelineRow): { total: number; chips: SummaryChip[] } {
  const list = row.commissionings
  let pass = 0, fail = 0, progress = 0, pending = 0
  for (const c of list) {
    if (c.passStatus === 'PASS') pass++
    else if (c.passStatus === 'FAIL') fail++
    else if (c.passStatus === 'IN_PROGRESS') progress++
    else pending++
  }
  const chips: SummaryChip[] = []
  if (fail) chips.push({ label: `⚠ ${fail} 项未通过`, tone: 'red' })
  if (pass && pass === list.length) chips.push({ label: `已全部通过`, tone: 'green' })
  else if (pass) chips.push({ label: `${pass}/${list.length} 已通过`, tone: 'green' })
  if (progress) chips.push({ label: `${progress} 验证中`, tone: 'orange' })
  if (pending) chips.push({ label: `${pending} 待评估`, tone: 'gray' })
  return { total: list.length, chips }
}

function summarizeRamps(row: ExpansionTimelineRow): { total: number; chips: SummaryChip[] } {
  const list = row.ramps
  let pass = 0, fail = 0, progress = 0, pending = 0
  for (const r of list) {
    if (r.status === 'PASS') pass++
    else if (r.status === 'FAIL') fail++
    else if (r.status === 'IN_PROGRESS') progress++
    else pending++
  }
  const chips: SummaryChip[] = []
  if (fail) chips.push({ label: `⚠ ${fail} 项未达标`, tone: 'red' })
  if (pass && pass === list.length) chips.push({ label: `已全部达标`, tone: 'green' })
  else if (pass) chips.push({ label: `${pass}/${list.length} 已确认`, tone: 'green' })
  if (progress) chips.push({ label: `${progress} 进行中`, tone: 'orange' })
  if (pending) chips.push({ label: `${pending} 待确认`, tone: 'gray' })
  return { total: list.length, chips }
}

function SectionSummary({ summary }: { summary: { chips: SummaryChip[] } }) {
  if (summary.chips.length === 0) return null
  return (
    <span className="section-summary">
      {summary.chips.map((c, i) => (
        <span key={i} className={`section-summary-chip tone-${c.tone}`}>{c.label}</span>
      ))}
    </span>
  )
}

type EvidenceTarget =
  | { kind: 'plan'; planId: string; planName: string }
  | { kind: 'item'; planId: string; planName: string; targetId: number; targetLabel: string }
  | { kind: 'approval'; planId: string; planName: string; targetId: number; targetLabel: string }
  | { kind: 'commissioning'; planId: string; planName: string; targetId: number; targetLabel: string }
  | { kind: 'ramp'; planId: string; planName: string; targetId: number; targetLabel: string }

type UpgradeTarget = {
  planId: string
  planName: string
  materialId: string
  sourceKind: RiskSourceKind
  sourceId: number
  sourceLabel: string
  signal: PendingRiskSignal
  existing: UpgradedRiskRef | null
}

// 当节点没有 pendingSignal 但已经有 upgradedRisk 时（如状态已修复），
// 仍要能打开升级弹窗。用已有风险的 type/level 合成一个最小 signal，
// 让弹窗能正常提交（upsert 不会改动 type，只改 level/description/scope）。
function signalFromExisting(ref: UpgradedRiskRef): PendingRiskSignal {
  return {
    type: ref.type as PendingRiskSignal['type'],
    level: ref.level,
    delayDays: 0,
    reason: '（节点状态已变更，继续编辑该风险）',
  }
}

export function ExpansionTimeline() {
  const [data, setData] = useState<ExpansionTimelinePayload | null>(null)
  const [error, setError] = useState('')
  const [editingPlan, setEditingPlan] = useState<ExpansionTimelineRow | null>(null)
  const [creatingPlan, setCreatingPlan] = useState(false)
  const [deletingPlan, setDeletingPlan] = useState<ExpansionTimelineRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [uploadingAt, setUploadingAt] = useState<EvidenceTarget | null>(null)
  const [editingItem, setEditingItem] = useState<ExpansionMilestoneItem | null>(null)
  const [editingApproval, setEditingApproval] = useState<ApprovalRow | null>(null)
  const [editingCommissioning, setEditingCommissioning] = useState<CommissioningRow | null>(null)
  const [editingRamp, setEditingRamp] = useState<RampRow | null>(null)
  const [previewEvidence, setPreviewEvidence] = useState<EvidenceAttachment | null>(null)
  const [upgrading, setUpgrading] = useState<UpgradeTarget | null>(null)
  const [upgradeToast, setUpgradeToast] = useState<string | null>(null)
  // L2 折叠：单个 section 收起（按 planId 隔离），存 localStorage
  const [collapsedSections, setCollapsedSections] = useState<Record<string, Set<SectionKey>>>(() => loadCollapsedSections())

  function toggleSection(planId: string, key: SectionKey) {
    setCollapsedSections((prev) => {
      const next: Record<string, Set<SectionKey>> = { ...prev }
      const cur = new Set(next[planId] ?? [])
      if (cur.has(key)) cur.delete(key); else cur.add(key)
      next[planId] = cur
      saveCollapsedSections(next)
      return next
    })
  }

  function reload() {
    return api.get<ExpansionTimelinePayload>('/api/boards/expansion/views/timeline').then(setData)
  }

  async function confirmDelete() {
    if (!deletingPlan) return
    setDeleting(true)
    setDeleteError('')
    try {
      await api.delete(`/api/expansion-plans/${deletingPlan.id}`)
      setDeletingPlan(null)
      await reload()
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : '删除失败。')
    } finally {
      setDeleting(false)
    }
  }

  function startUpgrade(
    row: ExpansionTimelineRow,
    kind: RiskSourceKind,
    sourceId: number,
    sourceLabel: string,
    signal: PendingRiskSignal,
    existing: UpgradedRiskRef | null,
  ) {
    if (!row.materialId) return
    setUpgrading({
      planId: row.id,
      planName: row.name,
      materialId: row.materialId,
      sourceKind: kind,
      sourceId,
      sourceLabel,
      signal,
      existing,
    })
  }

  async function onRiskUpserted() {
    if (!upgrading) return
    const isUpdate = !!upgrading.existing
    setUpgradeToast(isUpdate ? `已更新风险：${upgrading.sourceLabel}` : `已升级为风险：${upgrading.sourceLabel}`)
    setTimeout(() => setUpgradeToast(null), 2400)
    await reload()
  }

  // 阀点编辑保存后：刷新数据。状态改成「已逾期」会让升级风险按钮自动出现（无需弹窗）
  async function onItemSaved() {
    setEditingItem(null)
    await reload()
  }

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

  const completedMilestones = data.rows.reduce(
    (sum, r) => sum + r.items.filter((it) => milestoneStatusMeta(it.status).tone === 'done').length,
    0,
  )
  const allItems = data.rows.flatMap((r) => r.items)
  const allApprovals = data.rows.flatMap((r) => r.approvals)
  const approvalTotal = allApprovals.length
  const approvalDone = allApprovals.filter((a) => a.status === '已完成').length
  const approvalOverdue = allApprovals.filter((a) => a.status === '已逾期').length

  return (
    <BoardShell
      boardId="expansion"
      boardLabel="扩产跟踪"
      title="里程碑时间轴"
      views={VIEWS}
      rightSlot={
        <button type="button" className="button button-primary" onClick={() => setCreatingPlan(true)}>
          <Plus size={14} /> 新增扩产计划
        </button>
      }
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
          key="approval-done"
          kpi={{
            label: '已批审批',
            value: approvalDone,
            unit: `/${approvalTotal}`,
            tone: 'green',
            hint: `5 家累计已批复数`,
          }}
        />,
        <KpiCard
          key="approval-overdue"
          kpi={{
            label: '逾期审批',
            value: approvalOverdue,
            unit: `/${approvalTotal}`,
            tone: approvalOverdue > 0 ? 'red' : 'green',
            hint: approvalOverdue > 0 ? '需催办' : '全部按时',
          }}
        />,
      ]}
    >
      <article className="panel timeline-gantt">
        <header className="panel-title">
          <strong>扩产甘特图</strong>
          <small className="muted">每行 8 个标准阀点</small>
        </header>
        <div className="gantt-legend">
          <span className="gantt-legend-item tone-done">
            <span className="dot">✓</span>已完成
          </span>
          <span className="gantt-legend-item tone-progress">
            <span className="dot">◐</span>进行中
          </span>
          <span className="gantt-legend-item is-overdue">
            <span className="dot">!</span>已逾期
          </span>
          <span className="gantt-legend-item tone-pending">
            <span className="dot">○</span>待开始
          </span>
          <span className="gantt-legend-sep">|</span>
          <span className="gantt-legend-item gantt-legend-expected">
            <span className="dot">今</span>今日位置
          </span>
        </div>
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
              <div key={row.id} className="gantt-row" data-plan-id={row.id}>
                <div className="gantt-row-label">
                  <button
                    type="button"
                    className="gantt-row-name"
                    onClick={() => {
                      const el = document.getElementById(`plan-group-${row.id}`)
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                    title="点击跳转到该计划的阀点明细与审批/验证记录"
                  >
                    <strong>{row.name}</strong>
                    <ChevronDown size={12} className="gantt-row-jump" />
                  </button>
                  <small>{row.supplierName} · {row.materialName}</small>
                  <div className="gantt-row-meta">
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
                    }}
                  />
                  {MILESTONE_TEMPLATE.map((m, idx) => {
                    const item = row.items.find((it) => it.milestoneKey === m.key)
                    const meta = item ? milestoneStatusMeta(item.status) : null
                    const overdue = item?.overdue
                    const tone = overdue ? 'overdue' : meta?.tone ?? 'pending'
                    const number = idx + 1
                    const msTime = item ? new Date(item.expectedArrival).getTime() : null
                    const pct =
                      msTime && total > 0
                        ? Math.max(0, Math.min(100, ((msTime - minStart) / total) * 100))
                        : 4 + (idx / 7) * 92
                    const showTip = true
                    const tipLines = item
                      ? [
                          `阀点 ${number} · ${m.name}`,
                          `状态：${meta?.label ?? item.status}`,
                          `计划完成：${fmtYM(item.expectedArrival)}`,
                          `实际完成：${item.actualArrival ? fmtYM(item.actualArrival) : '—'}`,
                          overdue ? `逾期 ${item.delayDays} 天` : '',
                        ].filter(Boolean)
                      : [`阀点 ${number} · ${m.name}`, '状态：未开始']
                    return (
                      <span
                        key={m.key}
                        className={`milestone-dot tone-${tone} ${overdue ? 'is-overdue' : ''}`}
                        style={{ left: `${pct}%` }}
                        {...(showTip ? { 'data-tip': tipLines.join('\n') } : {})}
                      >
                        <span className="milestone-dot-number">{number}</span>
                        <span className={`milestone-dot-icon icon-${tone}`}>
                          {tone === 'done' ? '✓' : tone === 'progress' ? '◐' : tone === 'overdue' ? '!' : ''}
                        </span>
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
        {data.rows.map((row) => {
          const planSections = collapsedSections[row.id] ?? new Set<SectionKey>()
          return (
          <div key={row.id} id={`plan-group-${row.id}`} className="timeline-plan-group">
            <header className="timeline-plan-group-head">
              <div className="plan-title">
                <strong>{row.name}</strong>
                <small className="muted">{row.supplierName} · {row.materialName}</small>
              </div>
              <div className="plan-actions">
                <button type="button" className="text-button text-button-primary" onClick={() => setEditingPlan(row)}>
                  <Pencil size={12} /> 编辑计划
                </button>
                <button type="button" className="text-button" onClick={() => setUploadingAt({ kind: 'plan', planId: row.id, planName: row.name })}>
                  <Upload size={12} /> 上传佐证
                </button>
                <button
                  type="button"
                  className="text-button text-button-danger"
                  onClick={() => { setDeleteError(''); setDeletingPlan(row) }}
                  title="删除该扩产计划（含其所有子节点）"
                >
                  <Trash2 size={12} /> 删除
                </button>
                <StatusBadge status={row.status} short />
              </div>
            </header>
            <section className={`timeline-plan-section ${planSections.has('milestones') ? 'is-collapsed' : ''}`}>
              <header className="timeline-plan-section-head">
                <button
                  type="button"
                  className="section-toggle"
                  onClick={() => toggleSection(row.id, 'milestones')}
                  aria-expanded={!planSections.has('milestones')}
                  aria-label={planSections.has('milestones') ? '展开阀点明细' : '收起阀点明细'}
                  title={planSections.has('milestones') ? '展开' : '收起'}
                >
                  <ChevronDown size={12} className={planSections.has('milestones') ? 'is-collapsed' : ''} />
                </button>
                <div className="section-head-title">
                  <div className="section-head-line">
                    <strong>全部阀点明细</strong>
                    <SectionSummary summary={summarizeMilestones(row)} />
                  </div>
                  <small className="muted">8 个标准阶段 · 卡片包含阀点序号/名称/状态/计划&实际日期/双方行动</small>
                </div>
              </header>
              <div className="milestone-grid">
                {MILESTONE_TEMPLATE.map((tmpl, idx) => {
                  const item = row.items.find((it) => it.milestoneKey === tmpl.key)
                  const itemLabel = item ? `阀点 ${idx + 1} · ${tmpl.name}` : `阀点 ${idx + 1} · ${tmpl.name}`
                  const upgradedRisk = item?.upgradedRisk ?? null
                  return (
                    <MilestoneCard
                      key={tmpl.key}
                      order={idx + 1}
                      templateName={tmpl.name}
                      TemplateIcon={tmpl.icon}
                      deliverables={tmpl.deliverables}
                      item={item}
                      itemLabel={itemLabel}
                      onEdit={item ? () => setEditingItem(item) : undefined}
                      onUploadEvidence={item ? () => setUploadingAt({
                        kind: 'item',
                        planId: row.id,
                        planName: row.name,
                        targetId: item.id,
                        targetLabel: `阀点 ${idx + 1} · ${tmpl.name}`,
                      }) : undefined}
                      onUpgrade={(item && (item.pendingRiskSignal || upgradedRisk))
                        ? () => startUpgrade(row, 'item', item.id, itemLabel, item.pendingRiskSignal ?? signalFromExisting(upgradedRisk!), upgradedRisk)
                        : undefined}
                      onPreviewEvidence={setPreviewEvidence}
                      upgradedRisk={upgradedRisk}
                    />
                  )
                })}
              </div>
            </section>
            <section className={`timeline-plan-section ${planSections.has('approvals') ? 'is-collapsed' : ''}`}>
              <header className="timeline-plan-section-head">
                <button
                  type="button"
                  className="section-toggle"
                  onClick={() => toggleSection(row.id, 'approvals')}
                  aria-expanded={!planSections.has('approvals')}
                  aria-label={planSections.has('approvals') ? '展开审批事项' : '收起审批事项'}
                  title={planSections.has('approvals') ? '展开' : '收起'}
                >
                  <ChevronDown size={12} className={planSections.has('approvals') ? 'is-collapsed' : ''} />
                </button>
                <div className="section-head-title">
                  <div className="section-head-line">
                    <strong>关键审批事项进度</strong>
                    <SectionSummary summary={summarizeApprovals(row)} />
                  </div>
                  <small className="muted">6 项前置审批 · 状态自动按日期推算 · 鼠标悬浮审批事项查看准备周期</small>
                </div>
              </header>
              <ApprovalSection
                approvals={row.approvals}
                onEdit={setEditingApproval}
                onUploadEvidence={(a, label) => setUploadingAt({
                  kind: 'approval',
                  planId: row.id,
                  planName: row.name,
                  targetId: a.id,
                  targetLabel: label,
                })}
                onPreviewEvidence={setPreviewEvidence}
                onUpgrade={(a, label) => (a.pendingRiskSignal || a.upgradedRisk)
                  ? startUpgrade(row, 'approval', a.id, label, a.pendingRiskSignal ?? signalFromExisting(a.upgradedRisk!), a.upgradedRisk)
                  : undefined}
              />
            </section>
            <section className={`timeline-plan-section ${planSections.has('commissionings') ? 'is-collapsed' : ''}`}>
              <header className="timeline-plan-section-head">
                <button
                  type="button"
                  className="section-toggle"
                  onClick={() => toggleSection(row.id, 'commissionings')}
                  aria-expanded={!planSections.has('commissionings')}
                  aria-label={planSections.has('commissionings') ? '展开试产验证' : '收起试产验证'}
                  title={planSections.has('commissionings') ? '展开' : '收起'}
                >
                  <ChevronDown size={12} className={planSections.has('commissionings') ? 'is-collapsed' : ''} />
                </button>
                <div className="section-head-title">
                  <div className="section-head-line">
                    <strong>试产验证记录</strong>
                    <SectionSummary summary={summarizeCommissionings(row)} />
                  </div>
                  <small className="muted">6 项验证项目 · 含目标值/实测值/合格判定/验证日期/备注</small>
                </div>
              </header>
              <CommissioningSection
                commissionings={row.commissionings}
                onEdit={setEditingCommissioning}
                onUploadEvidence={(c, label) => setUploadingAt({
                  kind: 'commissioning',
                  planId: row.id,
                  planName: row.name,
                  targetId: c.id,
                  targetLabel: label,
                })}
                onPreviewEvidence={setPreviewEvidence}
                onUpgrade={(c, label) => (c.pendingRiskSignal || c.upgradedRisk)
                  ? startUpgrade(row, 'commissioning', c.id, label, c.pendingRiskSignal ?? signalFromExisting(c.upgradedRisk!), c.upgradedRisk)
                  : undefined}
              />
            </section>
            <section className={`timeline-plan-section ${planSections.has('ramps') ? 'is-collapsed' : ''}`}>
              <header className="timeline-plan-section-head">
                <button
                  type="button"
                  className="section-toggle"
                  onClick={() => toggleSection(row.id, 'ramps')}
                  aria-expanded={!planSections.has('ramps')}
                  aria-label={planSections.has('ramps') ? '展开爬坡跟踪' : '收起爬坡跟踪'}
                  title={planSections.has('ramps') ? '展开' : '收起'}
                >
                  <ChevronDown size={12} className={planSections.has('ramps') ? 'is-collapsed' : ''} />
                </button>
                <div className="section-head-title">
                  <div className="section-head-line">
                    <strong>阶段爬坡跟踪</strong>
                    <SectionSummary summary={summarizeRamps(row)} />
                  </div>
                  <small className="muted">4 阶段爬坡 · 含负荷率/目标产能/计划周期/实际产能/确认日期</small>
                </div>
              </header>
              <RampSection
                ramps={row.ramps}
                onEdit={setEditingRamp}
                onUploadEvidence={(r, label) => setUploadingAt({
                  kind: 'ramp',
                  planId: row.id,
                  planName: row.name,
                  targetId: r.id,
                  targetLabel: label,
                })}
                onPreviewEvidence={setPreviewEvidence}
                onUpgrade={(r, label) => (r.pendingRiskSignal || r.upgradedRisk)
                  ? startUpgrade(row, 'ramp', r.id, label, r.pendingRiskSignal ?? signalFromExisting(r.upgradedRisk!), r.upgradedRisk)
                  : undefined}
              />
            </section>
          </div>
          )
        })}
      </section>

      {editingPlan && (
        <PlanEditModal plan={editingPlan} onClose={() => setEditingPlan(null)} onSaved={reload} />
      )}
      {uploadingAt && (
        <EvidenceUploadModal
          planId={uploadingAt.planId}
          planName={uploadingAt.planName}
          targetKind={uploadingAt.kind}
          targetId={uploadingAt.kind === 'plan' ? null : uploadingAt.targetId}
          targetLabel={uploadingAt.kind === 'plan' ? undefined : uploadingAt.targetLabel}
          onClose={() => setUploadingAt(null)}
          onUploaded={async () => { await reload() }}
        />
      )}
      {editingItem && (
        <MilestoneEditModal
          item={editingItem}
          planId={editingItem.type}
          onClose={() => setEditingItem(null)}
          onSaved={onItemSaved as (updatedItem?: ExpansionMilestoneItem) => void}
        />
      )}
      {editingApproval && (
        <ApprovalEditModal
          row={editingApproval}
          approvalId={editingApproval.id}
          onClose={() => setEditingApproval(null)}
          onSaved={reload}
        />
      )}
      {editingCommissioning && (
        <CommissioningEditModal
          row={editingCommissioning}
          commissioningId={editingCommissioning.id}
          onClose={() => setEditingCommissioning(null)}
          onSaved={reload}
        />
      )}
      {editingRamp && (
        <RampEditModal
          row={editingRamp}
          rampId={editingRamp.id}
          onClose={() => setEditingRamp(null)}
          onSaved={reload}
        />
      )}
      {previewEvidence && (
        <EvidencePreviewModal
          evidence={previewEvidence}
          onClose={() => setPreviewEvidence(null)}
          onVerified={reload}
        />
      )}
      {creatingPlan && (
        <PlanCreateModal
          onClose={() => setCreatingPlan(false)}
          onCreated={(newPlanId) => {
            setCreatingPlan(false)
            // 重新拉取时间轴，拿到包含 children 的完整 plan 行
            reload().then(() => {
              // 此时 data 可能还没更新到 state，所以从接口再拉一次最新 rows
              api.get<ExpansionTimelinePayload>('/api/boards/expansion/views/timeline').then((fresh) => {
                const found = fresh.rows.find((r) => r.id === newPlanId)
                if (found) setEditingPlan(found)
              })
            })
          }}
        />
      )}
      {deletingPlan && (
        <Modal
          title={`删除扩产计划 · ${deletingPlan.name}`}
          onClose={() => { if (!deleting) setDeletingPlan(null) }}
          width={460}
          footer={
            <>
              <button className="button button-secondary" onClick={() => setDeletingPlan(null)} disabled={deleting}>取消</button>
              <button className="button button-danger" onClick={confirmDelete} disabled={deleting}>
                {deleting ? '删除中…' : '确认删除'}
              </button>
            </>
          }
        >
          {deleteError && <p className="form-error">{deleteError}</p>}
          <p>确定要删除扩产计划「{deletingPlan.name}」吗？</p>
          <ul className="plan-delete-list muted">
            <li>该计划下的 8 个里程碑阀点、6 项审批、6 项试产验证、4 阶段爬坡记录将一并删除</li>
            <li>所有已上传的佐证文件也会被清理</li>
            <li>此操作不可恢复，请谨慎</li>
          </ul>
        </Modal>
      )}
      {upgrading && (
        <UpgradeRiskModal
          planId={upgrading.planId}
          planName={upgrading.planName}
          materialId={upgrading.materialId}
          sourceKind={upgrading.sourceKind}
          sourceId={upgrading.sourceId}
          sourceLabel={upgrading.sourceLabel}
          signal={upgrading.signal}
          existing={upgrading.existing}
          onClose={() => setUpgrading(null)}
          onUpserted={onRiskUpserted}
        />
      )}
      {upgradeToast && (
        <div className="upgrade-toast" role="status" aria-live="polite">
          <AlertTriangle size={13} />
          <span>{upgradeToast}</span>
        </div>
      )}
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
  deliverables?: string
  item?: ExpansionMilestoneItem
  itemLabel?: string
  onEdit?: () => void
  onUploadEvidence?: () => void
  onUpgrade?: () => void
  onPreviewEvidence?: (e: EvidenceAttachment) => void
  upgradedRisk?: UpgradedRiskRef | null
}

function MilestoneCard({ order, templateName, TemplateIcon, deliverables, item, onEdit, onUploadEvidence, onUpgrade, onPreviewEvidence, upgradedRisk }: MilestoneCardProps) {
  const meta = item ? milestoneStatusMeta(item.status) : milestoneStatusMeta('未开始')
  const Icon = TemplateIcon
  const overdue = item?.overdue ?? false
  const tone = overdue ? 'overdue' : meta.tone
  const pillMeta = PILL_META[tone]
  const upgraded = !!upgradedRisk
  const noteText = deliverables ?? ''
  return (
    <div className={`milestone-card ${overdue ? 'is-overdue' : ''} tone-${tone}`}>
      <header className="milestone-card-head">
        <span className="milestone-step-badge">{order}</span>
        <div className="milestone-card-title">
          <Icon size={14} color={meta.color} />
          <strong>{templateName}</strong>
        </div>
        <span
          className="milestone-pill"
          style={{ background: pillMeta.bg, color: pillMeta.color, border: `1px solid ${pillMeta.color}40` }}
        >
          {pillMeta.label}
        </span>
      </header>
      <div className="milestone-card-dates">
        <div>
          <small className="muted">计划完成</small>
          <span>{item ? fmtDate(item.expectedArrival) : '—'}</span>
        </div>
        <div>
          <small className="muted">实际完成</small>
          <span className={item?.actualArrival ? '' : 'muted'}>
            {item?.actualArrival ? fmtDate(item.actualArrival) : '—'}
          </span>
        </div>
        <div className="milestone-card-evidence">
          <small className="muted">佐证</small>
          {noteText ? (
            <HoverNote text={noteText}>
              <span className="milestone-evidence-wrap">
                {item ? (
                  <EvidenceChipList evidence={item.evidence} onPreview={onPreviewEvidence ?? (() => {})} emptyText="—" />
                ) : (
                  <span className="muted">—</span>
                )}
              </span>
            </HoverNote>
          ) : item ? (
            <EvidenceChipList evidence={item.evidence} onPreview={onPreviewEvidence ?? (() => {})} emptyText="—" />
          ) : (
            <span className="muted">—</span>
          )}
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
      {item?.note && (
        <div className="milestone-card-note">
          <small className="muted">备注</small>
          <p>{item.note}</p>
        </div>
      )}
      {item && (
        <footer className="milestone-card-foot">
          <div style={{ flex: 1 }} />
          {onUpgrade && (
            <button type="button" className="row-edit-btn upgrade-btn" onClick={onUpgrade} title={upgraded ? `查看/更新该节点已升级的风险（${upgradeDate(upgradedRisk)}）` : '将该节点信号升级为风险记录'}>
              <AlertTriangle size={11} /> {upgraded ? `已升级 ${upgradeDate(upgradedRisk)}` : '升级风险'}
            </button>
          )}
          {onEdit && (
            <button type="button" className="row-edit-btn" onClick={onEdit}>
              <Pencil size={11} /> 编辑
            </button>
          )}
          {onUploadEvidence && (
            <button type="button" className="row-edit-btn" onClick={onUploadEvidence} title="上传到该阀点的佐证">
              <Upload size={11} /> +佐证
            </button>
          )}
        </footer>
      )}
    </div>
  )
}

function ApprovalSection({ approvals, onEdit, onUploadEvidence, onPreviewEvidence, onUpgrade }: {
  approvals: ApprovalRow[]
  onEdit: (row: ApprovalRow) => void
  onUploadEvidence: (row: ApprovalRow, label: string) => void
  onPreviewEvidence: (e: EvidenceAttachment) => void
  onUpgrade: (row: ApprovalRow, label: string) => void
}) {
  if (!approvals.length) return null
  return (
    <section className="approval-progress">
      <table className="table">
        <thead>
          <tr>
            <th>审批事项</th>
            <th>审批机构</th>
            <th className="date">提交日期</th>
            <th className="date">预计批复</th>
            <th className="date">实际批复</th>
            <th>状态</th>
            <th>备注</th>
            <th>佐证</th>
            <th className="action-col">操作</th>
          </tr>
        </thead>
        <tbody>
          {approvals.map((a) => {
            const meta = approvalStatusMeta(a.status)
            const label = `审批 ${a.order} · ${a.name}`
            const upgraded = !!a.upgradedRisk
            return (
              <tr key={a.type} className={a.overdue ? 'is-overdue' : ''}>
                <td className="approval-item" data-cycle={APPROVAL_CYCLE_BY_KEY[a.type] ?? ''}>
                  <strong>{a.order}. {a.name}</strong>
                  {a.pendingRiskSignal && (
                    <div className="row-risk-signal">
                      <span className={`risk-signal-dot tone-${LEVEL_TONE[a.pendingRiskSignal.level]}`} />
                      <span className="muted">{a.pendingRiskSignal.reason}</span>
                    </div>
                  )}
                </td>
                <td>{a.agency}</td>
                <td className="date">{fmtYM(a.submittedAt)}</td>
                <td className="date">{fmtYM(a.expectedAt)}</td>
                <td className="date">{fmtYM(a.actualAt)}</td>
                <td>
                  <span
                    className="milestone-pill"
                    style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.ring}40` }}
                  >
                    {meta.label}
                  </span>
                </td>
                <td className="muted">{a.note || '—'}</td>
                <td>
                  <EvidenceChipList evidence={a.evidence} onPreview={onPreviewEvidence} />
                </td>
                <td>
                  <div className="row-action-stack">
                    {(a.pendingRiskSignal || a.upgradedRisk) && (
                      <button type="button" className="row-edit-btn upgrade-btn" onClick={() => onUpgrade(a, label)} title={upgraded ? `查看/更新该节点已升级的风险（${upgradeDate(a.upgradedRisk)}）` : '将该节点信号升级为风险记录'}>
                        <AlertTriangle size={11} /> {upgraded ? `已升级 ${upgradeDate(a.upgradedRisk)}` : '升级风险'}
                      </button>
                    )}
                    <button type="button" className="row-edit-btn" onClick={() => onEdit(a)}>
                      <Pencil size={11} /> 编辑
                    </button>
                    <button type="button" className="row-edit-btn" onClick={() => onUploadEvidence(a, label)}>
                      <Upload size={11} /> +佐证
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

function CommissioningSection({ commissionings, onEdit, onUploadEvidence, onPreviewEvidence, onUpgrade }: {
  commissionings: CommissioningRow[]
  onEdit: (row: CommissioningRow) => void
  onUploadEvidence: (row: CommissioningRow, label: string) => void
  onPreviewEvidence: (e: EvidenceAttachment) => void
  onUpgrade: (row: CommissioningRow, label: string) => void
}) {
  if (!commissionings.length) return null
  return (
    <section className="commissioning-progress">
      <table className="table">
        <thead>
          <tr>
            <th>验证项目</th>
            <th>验证标准</th>
            <th>目标值</th>
            <th>实测值</th>
            <th>合格判定</th>
            <th className="date">验证日期</th>
            <th>备注</th>
            <th>佐证</th>
            <th className="action-col">操作</th>
          </tr>
        </thead>
        <tbody>
          {COMMISSIONING_TYPES.map((tmpl) => {
            const row = commissionings.find((c) => c.type === tmpl.key)
            const meta = row ? commissioningStatusMeta(row.passStatus) : commissioningStatusMeta('PENDING')
            const label = `试产 ${tmpl.order} · ${tmpl.name}`
            const upgraded = !!row?.upgradedRisk
            return (
              <tr key={tmpl.key} className={row?.passStatus === 'FAIL' ? 'is-fail' : ''}>
                <td>
                  <strong>{tmpl.order}. {tmpl.name}</strong>
                  {row?.pendingRiskSignal && (
                    <div className="row-risk-signal">
                      <span className={`risk-signal-dot tone-${LEVEL_TONE[row.pendingRiskSignal.level]}`} />
                      <span className="muted">{row.pendingRiskSignal.reason}</span>
                    </div>
                  )}
                </td>
                <td className="muted">{tmpl.standard}</td>
                <td>{row?.targetValue || '—'}</td>
                <td className={row?.actualValue ? '' : 'muted'}>
                  {row?.actualValue || '—'}
                </td>
                <td>
                  <span
                    className="milestone-pill"
                    style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}40` }}
                  >
                    {row?.passLabel ?? '待开始'}
                  </span>
                </td>
                <td className="date">{row?.verifiedAt ? fmtDate(row.verifiedAt) : '—'}</td>
                <td className="muted">{row?.note || '—'}</td>
                <td>
                  <EvidenceChipList evidence={row?.evidence ?? []} onPreview={onPreviewEvidence} />
                </td>
                <td>
                  {row && (
                    <div className="row-action-stack">
                      {(row.pendingRiskSignal || row.upgradedRisk) && (
                        <button type="button" className="row-edit-btn upgrade-btn" onClick={() => onUpgrade(row, label)} title={upgraded ? `查看/更新该节点已升级的风险（${upgradeDate(row.upgradedRisk)}）` : '将该节点信号升级为风险记录'}>
                          <AlertTriangle size={11} /> {upgraded ? `已升级 ${upgradeDate(row.upgradedRisk)}` : '升级风险'}
                        </button>
                      )}
                      <button type="button" className="row-edit-btn" onClick={() => onEdit(row)}>
                        <Pencil size={11} /> 编辑
                      </button>
                      <button type="button" className="row-edit-btn" onClick={() => onUploadEvidence(row, label)}>
                        <Upload size={11} /> +佐证
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

function RampSection({ ramps, onEdit, onUploadEvidence, onPreviewEvidence, onUpgrade }: {
  ramps: RampRow[]
  onEdit: (row: RampRow) => void
  onUploadEvidence: (row: RampRow, label: string) => void
  onPreviewEvidence: (e: EvidenceAttachment) => void
  onUpgrade: (row: RampRow, label: string) => void
}) {
  if (!ramps.length) return null
  return (
    <section className="ramp-progress">
      <table className="table">
        <thead>
          <tr>
            <th>阶段</th>
            <th className="number">目标负荷率</th>
            <th className="number">目标产能（吨/月）</th>
            <th>计划周期</th>
            <th className="date">实际确认时间</th>
            <th className="number">实际达成产能</th>
            <th>达标状态</th>
            <th>备注</th>
            <th>佐证</th>
            <th className="action-col">操作</th>
          </tr>
        </thead>
        <tbody>
          {RAMP_PHASES.map((tmpl) => {
            const row = ramps.find((r) => r.phase === tmpl.phase)
            const meta = row ? rampStatusMeta(row.status) : rampStatusMeta('PENDING')
            const reached = row?.actualCapacity != null && row.targetCapacity > 0
              ? Math.round((row.actualCapacity / row.targetCapacity) * 100)
              : null
            const label = `爬坡 · ${tmpl.phase} (${tmpl.loadRate}%)`
            const upgraded = !!row?.upgradedRisk
            return (
              <tr key={tmpl.phase} className={row?.status === 'FAIL' ? 'is-fail' : ''}>
                <td>
                  <strong>{tmpl.phase}</strong>
                  <div className="muted" style={{ fontSize: 11 }}>{tmpl.period}</div>
                  {row?.pendingRiskSignal && (
                    <div className="row-risk-signal">
                      <span className={`risk-signal-dot tone-${LEVEL_TONE[row.pendingRiskSignal.level]}`} />
                      <span className="muted">{row.pendingRiskSignal.reason}</span>
                    </div>
                  )}
                </td>
                <td className="number">{tmpl.loadRate}%</td>
                <td className="number">{(row?.targetCapacity ?? tmpl.loadRate * 1000).toLocaleString()}</td>
                <td>{row?.plannedPeriod ?? tmpl.period}</td>
                <td className="date">{row?.confirmedAt ? fmtDate(row.confirmedAt) : '—'}</td>
                <td className="number">
                  {row?.actualCapacity != null ? (
                    <>
                      {row.actualCapacity.toLocaleString()}
                      {reached != null && (
                        <span className="muted" style={{ marginLeft: 4, fontSize: 11 }}>
                          ({reached}%)
                        </span>
                      )}
                    </>
                  ) : '—'}
                </td>
                <td>
                  <span
                    className="milestone-pill"
                    style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}40` }}
                  >
                    {row?.statusLabel ?? '待开始'}
                  </span>
                </td>
                <td className="muted">{row?.note || '—'}</td>
                <td>
                  <EvidenceChipList evidence={row?.evidence ?? []} onPreview={onPreviewEvidence} />
                </td>
                <td>
                  {row && (
                    <div className="row-action-stack">
                      {(row.pendingRiskSignal || row.upgradedRisk) && (
                        <button type="button" className="row-edit-btn upgrade-btn" onClick={() => onUpgrade(row, label)} title={upgraded ? `查看/更新该节点已升级的风险（${upgradeDate(row.upgradedRisk)}）` : '将该节点信号升级为风险记录'}>
                          <AlertTriangle size={11} /> {upgraded ? `已升级 ${upgradeDate(row.upgradedRisk)}` : '升级风险'}
                        </button>
                      )}
                      <button type="button" className="row-edit-btn" onClick={() => onEdit(row)}>
                        <Pencil size={11} /> 编辑
                      </button>
                      <button type="button" className="row-edit-btn" onClick={() => onUploadEvidence(row, label)}>
                        <Upload size={11} /> +佐证
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}