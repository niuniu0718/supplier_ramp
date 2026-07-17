import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { api } from '../../lib/api'
import { StatusBadge } from '../ui/StatusBadge'
import type { ExpansionTimelineRow } from '../../types'

interface Props {
  plan: ExpansionTimelineRow
  onClose: () => void
  onSaved: () => void
}

// 风险等级和阶段都由后端自动推算：风险按「预期 - 实际 ≥ 25% 高 / ≥ 8% 中」实时聚合阀点完成度；
// 这里只保留风险说明（自由文本备注），不再暴露手动覆盖入口。

export function PlanEditModal({ plan, onClose, onSaved }: Props) {
  const [riskDescription, setRiskDescription] = useState(plan.riskDescription ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    setError('')
    setSaving(true)
    try {
      await api.patch(`/api/expansion-plans/${plan.id}`, {
        risk_description: riskDescription,
      })
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败。')
    } finally {
      setSaving(false)
    }
  }

  const completed = plan.completedItemCount ?? 0
  const total = plan.totalItemCount ?? 8
  const lag = Math.max(0, plan.expectedProgress - plan.progress)
  const stageLabel = PLAN_STAGE_LABEL[plan.stage] ?? plan.stage

  return (
    <Modal
      title={`编辑计划 · ${plan.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="button button-secondary" onClick={onClose} disabled={saving}>取消</button>
          <button className="button button-primary" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存'}</button>
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
          rows={4}
          placeholder="例如：关键设备到货延迟、试车一次未通过等。修改任意阀点状态后，此处留空可清除。"
        />
        <small className="muted" style={{ display: 'block', marginTop: 4 }}>
          自由文本备注，方便在时间轴/证据档案中说明当前风险上下文；不影响自动判定结果。
        </small>
      </div>
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