import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { api } from '../../lib/api'
import type {
  PendingRiskSignal,
  RiskLevel,
  RiskRow,
  RiskSourceKind,
  UpgradedRiskRef,
} from '../../types'
import { LEVEL_LABEL, LEVEL_ORDER, levelBadgeMeta, typeBadgeMeta } from '../../lib/risk'

interface Props {
  planId: string
  planName: string
  sourceKind: RiskSourceKind
  sourceId: number
  sourceLabel: string
  signal: PendingRiskSignal
  materialId: string
  existing: UpgradedRiskRef | null
  onClose: () => void
  onUpserted: (risk: RiskRow) => void
}

export function UpgradeRiskModal({
  planId,
  planName,
  sourceKind,
  sourceId,
  sourceLabel,
  signal,
  materialId,
  existing,
  onClose,
  onUpserted,
}: Props) {
  const [level, setLevel] = useState<RiskLevel>(existing?.level ?? signal.level)
  const [description, setDescription] = useState(
    existing ? '' : `[自动生成] ${signal.reason}`,
  )
  const [impactScope, setImpactScope] = useState(planName)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [hydrated, setHydrated] = useState(!existing)
  const typeMeta = typeBadgeMeta(signal.type)
  const initialLevelMeta = levelBadgeMeta(signal.level)

  // 已有风险时，从 GET /api/risks/{id} 拉完整记录以预填 description/impactScope
  useEffect(() => {
    if (!existing) return
    let cancelled = false
    api.get<RiskRow>(`/api/risks/${existing.id}`).then((r) => {
      if (cancelled) return
      setDescription(r.description)
      setImpactScope(r.impactScope || planName)
      setLevel(r.level)
      setHydrated(true)
    }).catch(() => setHydrated(true))
    return () => { cancelled = true }
  }, [existing, planName])

  async function submit() {
    setError('')
    setSubmitting(true)
    try {
      const risk = await api.post<RiskRow>('/api/risks', {
        materialId,
        type: signal.type,
        level,
        description,
        impactScope,
        creatorId: 'admin',
        sourceKind,
        sourceId,
        sourcePlanId: planId,
      })
      onUpserted(risk)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败。')
    } finally {
      setSubmitting(false)
    }
  }

  const isUpdate = !!existing
  const title = isUpdate ? `更新风险 · ${sourceLabel}` : `升级风险 · ${sourceLabel}`

  return (
    <Modal
      title={title}
      onClose={onClose}
      width={560}
      footer={
        <>
          <button className="button button-secondary" onClick={onClose} disabled={submitting}>取消</button>
          <button className="button button-primary" onClick={submit} disabled={submitting || !hydrated}>
            {submitting ? '提交中…' : isUpdate ? '保存更新' : '升级为风险'}
          </button>
        </>
      }
    >
      {error && <p className="form-error">{error}</p>}

      {isUpdate && (
        <div className="upgrade-signal-card upgrade-signal-update">
          <div className="upgrade-signal-row">
            <span className="muted">已有风险</span>
            <span className={`milestone-pill tone-${levelBadgeMeta(existing!.level).tone}`}>
              {levelBadgeMeta(existing!.level).label} · {existing!.status}
            </span>
            <small className="muted">提交后保留原风险 ID，覆盖 level / 描述 / 范围</small>
          </div>
        </div>
      )}

      <div className="upgrade-signal-card">
        <div className="upgrade-signal-row">
          <span className="muted">风险类型</span>
          <span className={`milestone-pill tone-${typeMeta.tone}`}>{typeMeta.label}</span>
        </div>
        <div className="upgrade-signal-row">
          <span className="muted">推荐等级</span>
          <span className={`milestone-pill tone-${initialLevelMeta.tone}`}>
            {initialLevelMeta.label}（{signal.level}）
          </span>
        </div>
        <div className="upgrade-signal-row">
          <span className="muted">命中原因</span>
          <span>{signal.reason}</span>
        </div>
        <div className="upgrade-signal-row">
          <span className="muted">来源节点</span>
          <span>
            {sourceLabel} · <span className="muted">{planName}</span>
          </span>
        </div>
      </div>

      <div className="form-row">
        <label>风险等级</label>
        <div className="level-radio-group">
          {LEVEL_ORDER.map((lv) => {
            const meta = levelBadgeMeta(lv)
            return (
              <label key={lv} className={`level-radio tone-${meta.tone}`}>
                <input
                  type="radio"
                  name="upgrade-level"
                  value={lv}
                  checked={level === lv}
                  onChange={() => setLevel(lv)}
                />
                <span>{meta.label}</span>
                <small className="muted">{lv}</small>
              </label>
            )
          })}
        </div>
      </div>

      <div className="form-row">
        <label>风险描述</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="例：立项批复延期 25 天，环评批文未到，影响后续土建招标。"
        />
      </div>

      <div className="form-row">
        <label>影响范围</label>
        <input
          value={impactScope}
          onChange={(e) => setImpactScope(e.target.value)}
          placeholder="例：P001 二期 / 仅土建招标 / 全项目"
        />
      </div>
    </Modal>
  )
}
