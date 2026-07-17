import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../ui/Modal'
import { DatePickerField } from '../ui/DatePickerField'
import { api } from '../../lib/api'
import { APPROVAL_TYPES } from '../../lib/approval'
import { COMMISSIONING_TYPES } from '../../lib/commissioning'
import { MILESTONE_TEMPLATE } from '../../lib/milestone'
import { RAMP_PHASES } from '../../lib/ramp'

interface MetaSupplier {
  id: string
  shortName: string
  name: string
  category: string
}
interface MetaMaterial {
  id: string
  name: string
  type: string
  supplierId: string
  demandMonthly: number
}
interface ExpansionMeta {
  suppliers: MetaSupplier[]
  materials: MetaMaterial[]
  milestoneTemplate: { order: number; key: string; name: string }[]
  approvalTemplate: { order: number; key: string; name: string; agency: string }[]
  commissioningTemplate: { order: number; key: string; name: string; standard: string }[]
  rampTemplate: { order: number; phase: string; loadRate: number; period: string }[]
}

interface Props {
  onClose: () => void
  onCreated: (newPlanId: string) => void
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function inOneYearStr() {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function PlanCreateModal({ onClose, onCreated }: Props) {
  const [meta, setMeta] = useState<ExpansionMeta | null>(null)
  const [metaError, setMetaError] = useState('')

  const [name, setName] = useState('')
  const [materialId, setMaterialId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [startDate, setStartDate] = useState(todayStr())
  const [endDate, setEndDate] = useState(inOneYearStr())
  const [targetCapacity, setTargetCapacity] = useState('1000')
  const [investedCapex, setInvestedCapex] = useState('0')
  const [totalCapex, setTotalCapex] = useState('0')
  const [fundingSources, setFundingSources] = useState('自筹')
  const [riskDescription, setRiskDescription] = useState('')

  const [genItems, setGenItems] = useState(true)
  const [genApprovals, setGenApprovals] = useState(true)
  const [genCommissionings, setGenCommissionings] = useState(true)
  const [genRamps, setGenRamps] = useState(true)

  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get<ExpansionMeta>('/api/expansion-meta')
      .then(setMeta)
      .catch((err) => setMetaError(err instanceof Error ? err.message : '加载失败。'))
  }, [])

  const filteredMaterials = useMemo(() => {
    if (!meta) return []
    if (supplierId) return meta.materials.filter((m) => m.supplierId === supplierId)
    return meta.materials
  }, [meta, supplierId])

  // 选了物料自动带上物料的默认供应商
  useEffect(() => {
    if (materialId && meta) {
      const m = meta.materials.find((mm) => mm.id === materialId)
      if (m) setSupplierId(m.supplierId)
    }
  }, [materialId, meta])

  async function save() {
    setError('')
    if (!name.trim()) { setError('请填写计划名称。'); return }
    if (!materialId) { setError('请选择物料。'); return }
    if (!supplierId) { setError('请选择供应商。'); return }
    if (!startDate || !endDate) { setError('请填写起止日期。'); return }
    if (endDate <= startDate) { setError('结束日期必须晚于开始日期。'); return }

    setSaving(true)
    try {
      const fundingList = fundingSources
        .split(/[,，、\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      const { plan } = await api.post<{ plan: { id: string } }>('/api/expansion-plans', {
        name: name.trim(),
        materialId,
        supplierId,
        startDate,
        endDate,
        targetCapacity: Number(targetCapacity) || 0,
        investedCapex: Number(investedCapex) || 0,
        totalCapex: Number(totalCapex) || 0,
        fundingSources: fundingList,
        riskDescription: riskDescription.trim(),
        generate: {
          items: genItems,
          approvals: genApprovals,
          commissionings: genCommissionings,
          ramps: genRamps,
        },
      })
      onCreated(plan.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="新增扩产计划"
      onClose={onClose}
      width={680}
      footer={
        <>
          <button className="button button-secondary" onClick={onClose} disabled={saving}>取消</button>
          <button className="button button-primary" onClick={save} disabled={saving || !meta}>
            {saving ? '创建中…' : '创建并编辑子节点'}
          </button>
        </>
      }
    >
      {metaError && <p className="form-error">{metaError}</p>}
      {error && <p className="form-error">{error}</p>}

      {!meta ? (
        <div className="muted">加载中…</div>
      ) : (
        <>
          <div className="form-row-2col">
            <div className="form-row">
              <label>计划名称 *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：二期 3 万吨电池级碳酸锂扩产"
              />
            </div>
            <div className="form-row">
              <label>物料 *</label>
              <select value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
                <option value="">请选择物料</option>
                {filteredMaterials.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}（{m.type}）</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row-2col">
            <div className="form-row">
              <label>供应商 *</label>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">请选择供应商</option>
                {meta.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.shortName} · {s.category}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label className="muted">初始阶段</label>
              <div className="muted" style={{ paddingTop: 8, fontSize: 12 }}>
                新建计划统一为「立项」阶段；后续由阀点完成度自动推算（无需手动设置）。
              </div>
            </div>
          </div>

          <div className="form-row-2col">
            <DatePickerField label="开始日期 *" value={startDate} onChange={setStartDate} />
            <DatePickerField label="结束日期 *" value={endDate} onChange={setEndDate} />
          </div>

          <div className="form-row-2col">
            <div className="form-row">
              <label>目标产能（吨/月）</label>
              <input
                type="number"
                min={0}
                value={targetCapacity}
                onChange={(e) => setTargetCapacity(e.target.value)}
                placeholder="例如 30000"
              />
            </div>
            <div className="form-row">
              <label>资金来源</label>
              <input
                value={fundingSources}
                onChange={(e) => setFundingSources(e.target.value)}
                placeholder="多个用逗号分隔，如：自筹, 银行贷款"
              />
            </div>
          </div>

          <div className="form-row-2col">
            <div className="form-row">
              <label>已投 CAPEX（万元）</label>
              <input
                type="number"
                min={0}
                value={investedCapex}
                onChange={(e) => setInvestedCapex(e.target.value)}
              />
            </div>
            <div className="form-row">
              <label>总 CAPEX（万元）</label>
              <input
                type="number"
                min={0}
                value={totalCapex}
                onChange={(e) => setTotalCapex(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <label>风险说明</label>
            <textarea
              value={riskDescription}
              onChange={(e) => setRiskDescription(e.target.value)}
              rows={2}
              placeholder="可填写关键设备、瓶颈环节、单点风险等。"
            />
          </div>

          <fieldset className="plan-create-template">
            <legend>按模板自动生成的子节点</legend>
            <p className="muted plan-create-template-hint">
              根据「开始 / 结束日期」自动排布计划日期，所有时间点可在创建后于各模块编辑面板微调。
            </p>
            <label className="plan-create-template-row">
              <input
                type="checkbox"
                checked={genItems}
                onChange={(e) => setGenItems(e.target.checked)}
              />
              <span><strong>{MILESTONE_TEMPLATE.length} 个里程碑阀点</strong> · 在 [开始, 结束] 内均匀排布</span>
            </label>
            <label className="plan-create-template-row">
              <input
                type="checkbox"
                checked={genApprovals}
                onChange={(e) => setGenApprovals(e.target.checked)}
              />
              <span>
                <strong>{APPROVAL_TYPES.length} 项标准审批</strong> · 排布在前 2/3 时段 ·
                初始状态「未开始」，<code>expected_at</code> 按审批顺序递推
              </span>
            </label>
            <label className="plan-create-template-row">
              <input
                type="checkbox"
                checked={genCommissionings}
                onChange={(e) => setGenCommissionings(e.target.checked)}
              />
              <span>
                <strong>{COMMISSIONING_TYPES.length} 项试车验证</strong> · 排布在收尾段 ·
                <code>target_value</code> 预填模板验证标准
              </span>
            </label>
            <label className="plan-create-template-row">
              <input
                type="checkbox"
                checked={genRamps}
                onChange={(e) => setGenRamps(e.target.checked)}
              />
              <span>
                <strong>{RAMP_PHASES.length} 阶段量产爬坡</strong> · 排布在最后 1/3 时段 ·
                <code>target_capacity</code> 按目标产能 × 负荷率推算
              </span>
            </label>
          </fieldset>
        </>
      )}
    </Modal>
  )
}