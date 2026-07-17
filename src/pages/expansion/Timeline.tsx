import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, Paperclip, Pencil, Plus, Trash2, Upload, type LucideIcon } from 'lucide-react'
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
import { api } from '../../lib/api'
import { APPROVAL_CYCLE_BY_KEY, approvalStatusMeta } from '../../lib/approval'
import { MILESTONE_TEMPLATE, milestoneStatusMeta } from '../../lib/milestone'
import { COMMISSIONING_TYPES, commissioningStatusMeta } from '../../lib/commissioning'
import { RAMP_PHASES, rampStatusMeta } from '../../lib/ramp'
import type {
  ApprovalRow,
  CommissioningRow,
  EvidenceAttachment,
  ExpansionMilestoneItem,
  ExpansionTimelinePayload,
  ExpansionTimelineRow,
  RampRow,
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

type EvidenceTarget =
  | { kind: 'plan'; planId: string; planName: string }
  | { kind: 'item'; planId: string; planName: string; targetId: number; targetLabel: string }
  | { kind: 'approval'; planId: string; planName: string; targetId: number; targetLabel: string }
  | { kind: 'commissioning'; planId: string; planName: string; targetId: number; targetLabel: string }
  | { kind: 'ramp'; planId: string; planName: string; targetId: number; targetLabel: string }

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
      description="8 个标准阀点 · 5 个扩产计划横向对比 · 供应商/采购双侧明细"
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
        {data.rows.map((row) => (
          <div key={row.id} id={`plan-group-${row.id}`} className="timeline-plan-group">
            <header className="timeline-plan-group-head">
              <div>
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
            <section className="timeline-plan-section">
              <header className="timeline-plan-section-head">
                <strong>全部阀点明细</strong>
                <small className="muted">8 个标准阶段 · 卡片包含阀点序号/名称/状态/计划&实际日期/双方行动</small>
              </header>
              <div className="milestone-grid">
                {MILESTONE_TEMPLATE.map((tmpl, idx) => {
                  const item = row.items.find((it) => it.milestoneKey === tmpl.key)
                  const itemLabel = item ? `阀点 ${idx + 1} · ${tmpl.name}` : `阀点 ${idx + 1} · ${tmpl.name}`
                  return (
                    <MilestoneCard
                      key={tmpl.key}
                      order={idx + 1}
                      templateName={tmpl.name}
                      TemplateIcon={tmpl.icon}
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
                    />
                  )
                })}
              </div>
            </section>
            <section className="timeline-plan-section">
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
              />
            </section>
            <section className="timeline-plan-section">
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
              />
            </section>
            <section className="timeline-plan-section">
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
              />
            </section>
          </div>
        ))}
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
          onSaved={reload}
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
        />
      )}
      {creatingPlan && (
        <PlanCreateModal onClose={() => setCreatingPlan(false)} onCreated={reload} />
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
            <li>该计划下的 8 个里程碑阀点、6 项审批、6 项试车验证、4 阶段爬坡记录将一并删除</li>
            <li>所有已上传的佐证文件也会被清理</li>
            <li>此操作不可恢复，请谨慎</li>
          </ul>
        </Modal>
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
  item?: ExpansionMilestoneItem
  itemLabel?: string
  onEdit?: () => void
  onUploadEvidence?: () => void
}

function MilestoneCard({ order, templateName, TemplateIcon, item, onEdit, onUploadEvidence }: MilestoneCardProps) {
  const meta = item ? milestoneStatusMeta(item.status) : milestoneStatusMeta('未开始')
  const Icon = TemplateIcon
  const overdue = item?.overdue ?? false
  const tone = overdue ? 'overdue' : meta.tone
  const pillMeta = PILL_META[tone]
  const evCount = item?.evidence.length ?? 0
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
        {overdue && (
          <span className="overdue-badge">
            <AlertTriangle size={11} /> 逾期 {item?.delayDays ?? 0} 天
          </span>
        )}
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
        <div>
          <small className="muted">佐证</small>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Paperclip size={11} className="muted" /> {evCount}
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
      {item?.note && (
        <div className="milestone-card-note">
          <small className="muted">备注</small>
          <p>{item.note}</p>
        </div>
      )}
      {item && (
        <footer className="milestone-card-foot">
          {evCount > 0 && (
            <div className="evidence-chip-row">
              {item.evidence.slice(0, 3).map((e) => (
                <a key={e.id} href={e.url} target="_blank" rel="noreferrer"
                   className={`evidence-chip verification-${e.verificationStatus === 'VERIFIED' ? 'verified' : e.verificationStatus === 'REJECTED' ? 'rejected' : e.requiresVerification ? 'pending' : 'neutral'}`}
                   title={`${e.name}${e.requiresVerification ? ` · ${e.verificationStatus === 'VERIFIED' ? '已认证' : e.verificationStatus === 'REJECTED' ? '已退回' : '待认证'}` : ''}`}>
                  {e.name}
                </a>
              ))}
              {evCount > 3 && <span className="evidence-chip muted">+{evCount - 3}</span>}
            </div>
          )}
          <div style={{ flex: 1 }} />
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

function ApprovalSection({ approvals, onEdit, onUploadEvidence, onPreviewEvidence }: {
  approvals: ApprovalRow[]
  onEdit: (row: ApprovalRow) => void
  onUploadEvidence: (row: ApprovalRow, label: string) => void
  onPreviewEvidence: (e: EvidenceAttachment) => void
}) {
  if (!approvals.length) return null
  return (
    <section className="approval-progress">
      <header className="timeline-plan-section-head">
        <strong>关键审批事项进度</strong>
        <small className="muted">6 项前置审批 · 状态自动按日期推算 · 鼠标悬浮审批事项查看准备周期</small>
      </header>
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
            return (
              <tr key={a.type} className={a.overdue ? 'is-overdue' : ''}>
                <td className="approval-item" data-cycle={APPROVAL_CYCLE_BY_KEY[a.type] ?? ''}>
                  <strong>{a.order}. {a.name}</strong>
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
                  <button type="button" className="row-edit-btn" onClick={() => onEdit(a)}>
                    <Pencil size={11} /> 编辑
                  </button>
                  <button type="button" className="row-edit-btn" onClick={() => onUploadEvidence(a, `审批 ${a.order} · ${a.name}`)}>
                    <Upload size={11} /> +佐证
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

function CommissioningSection({ commissionings, onEdit, onUploadEvidence, onPreviewEvidence }: {
  commissionings: CommissioningRow[]
  onEdit: (row: CommissioningRow) => void
  onUploadEvidence: (row: CommissioningRow, label: string) => void
  onPreviewEvidence: (e: EvidenceAttachment) => void
}) {
  if (!commissionings.length) return null
  return (
    <section className="commissioning-progress">
      <header className="timeline-plan-section-head">
        <strong>试车验证记录</strong>
        <small className="muted">6 项验证项目 · 含目标值/实测值/合格判定/验证日期/备注</small>
      </header>
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
            return (
              <tr key={tmpl.key} className={row?.passStatus === 'FAIL' ? 'is-fail' : ''}>
                <td>
                  <strong>{tmpl.order}. {tmpl.name}</strong>
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
                    <>
                      <button type="button" className="row-edit-btn" onClick={() => onEdit(row)}>
                        <Pencil size={11} /> 编辑
                      </button>
                      <button type="button" className="row-edit-btn" onClick={() => onUploadEvidence(row, `试车 ${tmpl.order} · ${tmpl.name}`)}>
                        <Upload size={11} /> +佐证
                      </button>
                    </>
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

function RampSection({ ramps, onEdit, onUploadEvidence, onPreviewEvidence }: {
  ramps: RampRow[]
  onEdit: (row: RampRow) => void
  onUploadEvidence: (row: RampRow, label: string) => void
  onPreviewEvidence: (e: EvidenceAttachment) => void
}) {
  if (!ramps.length) return null
  return (
    <section className="ramp-progress">
      <header className="timeline-plan-section-head">
        <strong>量产爬坡计划跟踪</strong>
        <small className="muted">4 阶段爬坡 · 负荷率 40→100% · 含目标/实际产能与达标判定</small>
      </header>
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
            return (
              <tr key={tmpl.phase} className={row?.status === 'FAIL' ? 'is-fail' : ''}>
                <td>
                  <strong>{tmpl.phase}</strong>
                  <div className="muted" style={{ fontSize: 11 }}>{tmpl.period}</div>
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
                    <>
                      <button type="button" className="row-edit-btn" onClick={() => onEdit(row)}>
                        <Pencil size={11} /> 编辑
                      </button>
                      <button type="button" className="row-edit-btn" onClick={() => onUploadEvidence(row, `爬坡 · ${tmpl.phase} (${tmpl.loadRate}%)`)}>
                        <Upload size={11} /> +佐证
                      </button>
                    </>
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