import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { DatePickerField } from '../ui/DatePickerField'
import { api } from '../../lib/api'
import { StatusBadge } from '../ui/StatusBadge'
import { APPROVAL_TYPES } from '../../lib/approval'
import { COMMISSIONING_TYPES } from '../../lib/commissioning'
import { RAMP_PHASES } from '../../lib/ramp'
import type {
  ApprovalRow,
  CommissioningRow,
  ExpansionMilestoneItem,
  ExpansionTimelineRow,
  RampRow,
} from '../../types'

interface Props {
  plan: ExpansionTimelineRow
  onClose: () => void
  onSaved: () => void
}

// 风险等级和阶段都由后端自动推算：风险按「预期 - 实际 ≥ 25% 高 / ≥ 8% 中」实时聚合阀点完成度；
// 这里只保留风险说明（自由文本备注），不再暴露手动覆盖入口。

type ItemDraft = Record<number, string> // itemId -> expectedArrival (YYYY-MM-DD)
type ApprovalDraft = Record<string, { expectedAt: string; note: string }> // type -> draft
type CommissioningDraft = Record<string, { verifiedAt: string; note: string }> // type -> draft
type RampDraft = Record<string, { confirmedAt: string; note: string }> // phase -> draft

function dateOnly(iso: string | null | undefined) {
  return iso ? iso.slice(0, 10) : ''
}

function serialize(v: string) {
  return v ? `${v}T00:00:00` : ''
}

export function PlanEditModal({ plan, onClose, onSaved }: Props) {
  const [riskDescription, setRiskDescription] = useState(plan.riskDescription ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState('')

  // 各 L2 模块的本地编辑草稿（key -> 当前值）
  const [itemDates, setItemDates] = useState<ItemDraft>(() => {
    const m: ItemDraft = {}
    for (const it of plan.items) m[it.id] = dateOnly(it.expectedArrival)
    return m
  })
  const [approvalDrafts, setApprovalDrafts] = useState<ApprovalDraft>(() => {
    const m: ApprovalDraft = {}
    for (const a of plan.approvals) m[a.type] = { expectedAt: dateOnly(a.expectedAt), note: a.note ?? '' }
    return m
  })
  const [commissioningDrafts, setCommissioningDrafts] = useState<CommissioningDraft>(() => {
    const m: CommissioningDraft = {}
    for (const c of plan.commissionings) m[c.type] = { verifiedAt: dateOnly(c.verifiedAt), note: c.note ?? '' }
    return m
  })
  const [rampDrafts, setRampDrafts] = useState<RampDraft>(() => {
    const m: RampDraft = {}
    for (const r of plan.ramps) m[r.phase] = { confirmedAt: dateOnly(r.confirmedAt), note: r.note ?? '' }
    return m
  })

  // 标记是否被改过（用于决定哪些需要在保存时 PATCH）
  const [dirtyItems, setDirtyItems] = useState<Set<number>>(new Set())
  const [dirtyApprovals, setDirtyApprovals] = useState<Set<string>>(new Set())
  const [dirtyCommissionings, setDirtyCommissionings] = useState<Set<string>>(new Set())
  const [dirtyRamps, setDirtyRamps] = useState<Set<string>>(new Set())

  function markItemDirty(id: number) {
    setDirtyItems((s) => {
      if (s.has(id)) return s
      const n = new Set(s); n.add(id); return n
    })
  }
  function markApprovalDirty(type: string) {
    setDirtyApprovals((s) => {
      if (s.has(type)) return s
      const n = new Set(s); n.add(type); return n
    })
  }
  function markCommissioningDirty(type: string) {
    setDirtyCommissionings((s) => {
      if (s.has(type)) return s
      const n = new Set(s); n.add(type); return n
    })
  }
  function markRampDirty(phase: string) {
    setDirtyRamps((s) => {
      if (s.has(phase)) return s
      const n = new Set(s); n.add(phase); return n
    })
  }

  async function save() {
    setError('')
    setSaving(true)
    setProgress('')
    try {
      // 计划本身的风险说明
      await api.patch(`/api/expansion-plans/${plan.id}`, {
        risk_description: riskDescription,
      })

      // 子节点更新：仅 PATCH 有变化的项
      const tasks: Promise<unknown>[] = []
      for (const it of plan.items) {
        if (!dirtyItems.has(it.id)) continue
        tasks.push(api.patch(`/api/expansion-items/${it.id}`, {
          expected_arrival: serialize(itemDates[it.id] ?? ''),
        }))
      }
      for (const a of plan.approvals) {
        if (!dirtyApprovals.has(a.type)) continue
        const draft = approvalDrafts[a.type]
        tasks.push(api.patch(`/api/approvals/${a.id}`, {
          expected_at: serialize(draft.expectedAt),
          note: draft.note,
        }))
      }
      for (const c of plan.commissionings) {
        if (!dirtyCommissionings.has(c.type)) continue
        const draft = commissioningDrafts[c.type]
        tasks.push(api.patch(`/api/commissionings/${c.id}`, {
          verified_at: serialize(draft.verifiedAt),
          note: draft.note,
        }))
      }
      for (const r of plan.ramps) {
        if (!dirtyRamps.has(r.phase)) continue
        const draft = rampDrafts[r.phase]
        tasks.push(api.patch(`/api/ramps/${r.id}`, {
          confirmed_at: serialize(draft.confirmedAt),
          note: draft.note,
        }))
      }

      const total = tasks.length
      if (total > 0) {
        let done = 0
        for (const t of tasks) {
          await t
          done++
          setProgress(`已保存 ${done}/${total}…`)
        }
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败。')
    } finally {
      setSaving(false)
      setProgress('')
    }
  }

  const completed = plan.completedItemCount ?? 0
  const total = plan.totalItemCount ?? 8
  const lag = Math.max(0, plan.expectedProgress - plan.progress)
  const stageLabel = PLAN_STAGE_LABEL[plan.stage] ?? plan.stage

  // 按模板顺序整理子节点（保证显示稳定）
  const sortedItems: ExpansionMilestoneItem[] = [...plan.items].sort(
    (a, b) => (a.milestoneOrder || 0) - (b.milestoneOrder || 0),
  )
  const approvalsByType = new Map<string, ApprovalRow>(plan.approvals.map((a) => [a.type, a]))
  const commissioningsByType = new Map<string, CommissioningRow>(plan.commissionings.map((c) => [c.type, c]))
  const rampsByPhase = new Map<string, RampRow>(plan.ramps.map((r) => [r.phase, r]))

  const dirtyCount =
    dirtyItems.size + dirtyApprovals.size + dirtyCommissionings.size + dirtyRamps.size

  return (
    <Modal
      title={`编辑计划 · ${plan.name}`}
      onClose={onClose}
      width={760}
      footer={
        <>
          <button className="button button-secondary" onClick={onClose} disabled={saving}>取消</button>
          <button className="button button-primary" onClick={save} disabled={saving}>
            {saving ? (progress || '保存中…') : `保存全部${dirtyCount ? ` (${dirtyCount} 项变更)` : ''}`}
          </button>
        </>
      }
    >
      {error && <p className="form-error">{error}</p>}
      <div className="plan-progress-summary">
        <div>
          <small>实际进度</small>
          <strong>{plan.progress}%</strong>
          <span className="muted">已 {completed}/{total} 阀点</span>
        </div>
        <div>
          <small>预期进度</small>
          <strong>{plan.expectedProgress}%</strong>
          <span className="muted">按时间线性外推</span>
        </div>
        <div>
          <small>滞后</small>
          <strong>{lag}%</strong>
          <span className="muted">≥ 25% 高 / ≥ 8% 中</span>
        </div>
        <div>
          <small>当前风险</small>
          <strong><StatusBadge status={plan.status} /></strong>
        </div>
      </div>
      <p className="plan-edit-hint muted">
        阶段：<strong>{stageLabel}</strong>　·　风险等级由「实际进度 vs 预期进度」实时自动判定
        （滞后 ≥ 25% 为高、≥ 8% 为中、否则为低），无法手动调整；
        调整任意阀点的状态即可触发重算。
      </p>
      <div className="form-row">
        <label>风险说明</label>
        <textarea
          value={riskDescription}
          onChange={(e) => setRiskDescription(e.target.value)}
          rows={3}
          placeholder="例如：关键设备到货延迟、试车一次未通过等。修改任意阀点状态后，此处留空可清除。"
        />
        <small className="muted" style={{ display: 'block', marginTop: 4 }}>
          自由文本备注，方便在时间轴/证据档案中说明当前风险上下文；不影响自动判定结果。
        </small>
      </div>

      <section className="plan-edit-children">
        <header className="plan-edit-children-head">
          <strong>子节点计划时间</strong>
          <small className="muted">
            调整 4 个 L2 模块的计划日期 · {sortedItems.length} 阀点 ·
            {' '}{plan.approvals.length} 审批 · {plan.commissionings.length} 试产 ·
            {' '}{plan.ramps.length} 爬坡
          </small>
        </header>

        {/* 阀点 */}
        <details className="plan-edit-children-group" open>
          <summary>
            <strong>里程碑阀点 · 计划完成日期</strong>
            <small className="muted">8 项</small>
          </summary>
          <table className="table plan-edit-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>阀点</th>
                <th>计划完成</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((it) => (
                <tr key={it.id} className={dirtyItems.has(it.id) ? 'is-dirty' : ''}>
                  <td className="muted">{it.milestoneOrder}</td>
                  <td>
                    <strong>{it.milestoneName ?? it.name}</strong>
                    <div className="muted" style={{ fontSize: 11 }}>{it.status}</div>
                  </td>
                  <td>
                    <DatePickerField
                      label=""
                      value={itemDates[it.id] ?? ''}
                      onChange={(v) => {
                        setItemDates((s) => ({ ...s, [it.id]: v }))
                        markItemDirty(it.id)
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>

        {/* 审批 */}
        <details className="plan-edit-children-group" open>
          <summary>
            <strong>关键审批 · 预计批复日期</strong>
            <small className="muted">6 项前置审批</small>
          </summary>
          <table className="table plan-edit-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>审批事项</th>
                <th>预计批复</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {APPROVAL_TYPES.map((tmpl) => {
                const a = approvalsByType.get(tmpl.key)
                if (!a) return null
                const draft = approvalDrafts[tmpl.key] ?? { expectedAt: '', note: '' }
                const dirty = dirtyApprovals.has(tmpl.key)
                return (
                  <tr key={tmpl.key} className={dirty ? 'is-dirty' : ''}>
                    <td className="muted">{tmpl.order}</td>
                    <td>
                      <strong>{tmpl.name}</strong>
                      <div className="muted" style={{ fontSize: 11 }}>{tmpl.agency}</div>
                    </td>
                    <td>
                      <DatePickerField
                        label=""
                        value={draft.expectedAt}
                        onChange={(v) => {
                          setApprovalDrafts((s) => ({
                            ...s,
                            [tmpl.key]: { ...s[tmpl.key], expectedAt: v },
                          }))
                          markApprovalDirty(tmpl.key)
                        }}
                      />
                    </td>
                    <td>
                      <input
                        className="plan-edit-note-input"
                        value={draft.note}
                        onChange={(e) => {
                          setApprovalDrafts((s) => ({
                            ...s,
                            [tmpl.key]: { ...s[tmpl.key], note: e.target.value },
                          }))
                          markApprovalDirty(tmpl.key)
                        }}
                        placeholder="如：材料受理中"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </details>

        {/* 试车 */}
        <details className="plan-edit-children-group">
          <summary>
            <strong>试产验证 · 验证日期</strong>
            <small className="muted">6 项验证项目</small>
          </summary>
          <table className="table plan-edit-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>验证项目</th>
                <th>验证日期</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {COMMISSIONING_TYPES.map((tmpl) => {
                const c = commissioningsByType.get(tmpl.key)
                if (!c) return null
                const draft = commissioningDrafts[tmpl.key] ?? { verifiedAt: '', note: '' }
                const dirty = dirtyCommissionings.has(tmpl.key)
                return (
                  <tr key={tmpl.key} className={dirty ? 'is-dirty' : ''}>
                    <td className="muted">{tmpl.order}</td>
                    <td>
                      <strong>{tmpl.name}</strong>
                      <div className="muted" style={{ fontSize: 11 }}>{c.passLabel}</div>
                    </td>
                    <td>
                      <DatePickerField
                        label=""
                        value={draft.verifiedAt}
                        onChange={(v) => {
                          setCommissioningDrafts((s) => ({
                            ...s,
                            [tmpl.key]: { ...s[tmpl.key], verifiedAt: v },
                          }))
                          markCommissioningDirty(tmpl.key)
                        }}
                      />
                    </td>
                    <td>
                      <input
                        className="plan-edit-note-input"
                        value={draft.note}
                        onChange={(e) => {
                          setCommissioningDrafts((s) => ({
                            ...s,
                            [tmpl.key]: { ...s[tmpl.key], note: e.target.value },
                          }))
                          markCommissioningDirty(tmpl.key)
                        }}
                        placeholder="如：合格 / 不合格"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </details>

        {/* 爬坡 */}
        <details className="plan-edit-children-group">
          <summary>
            <strong>量产爬坡 · 计划确认日期</strong>
            <small className="muted">4 阶段爬坡</small>
          </summary>
          <table className="table plan-edit-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>阶段</th>
                <th>计划确认日期</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {RAMP_PHASES.map((tmpl, idx) => {
                const r = rampsByPhase.get(tmpl.phase)
                if (!r) return null
                const draft = rampDrafts[tmpl.phase] ?? { confirmedAt: '', note: '' }
                const dirty = dirtyRamps.has(tmpl.phase)
                return (
                  <tr key={tmpl.phase} className={dirty ? 'is-dirty' : ''}>
                    <td className="muted">{idx + 1}</td>
                    <td>
                      <strong>{tmpl.phase}</strong>
                      <div className="muted" style={{ fontSize: 11 }}>
                        负荷 {tmpl.loadRate}% · {tmpl.period}
                      </div>
                    </td>
                    <td>
                      <DatePickerField
                        label=""
                        value={draft.confirmedAt}
                        onChange={(v) => {
                          setRampDrafts((s) => ({
                            ...s,
                            [tmpl.phase]: { ...s[tmpl.phase], confirmedAt: v },
                          }))
                          markRampDirty(tmpl.phase)
                        }}
                      />
                    </td>
                    <td>
                      <input
                        className="plan-edit-note-input"
                        value={draft.note}
                        onChange={(e) => {
                          setRampDrafts((s) => ({
                            ...s,
                            [tmpl.phase]: { ...s[tmpl.phase], note: e.target.value },
                          }))
                          markRampDirty(tmpl.phase)
                        }}
                        placeholder="如：阶段达成说明"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </details>
      </section>
    </Modal>
  )
}

const PLAN_STAGE_LABEL: Record<string, string> = {
  采购设备: '采购设备',
  安装: '安装',
  调试: '调试',
  投产: '投产',
  完工: '完工',
}