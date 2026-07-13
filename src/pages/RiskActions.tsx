import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardPlus, Clock3, Search, ShieldAlert, Sparkles, Target, UserRound } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import type { ActionTemplate, ReferenceData, Risk } from '../types'
import { Drawer } from '../components/ui/Drawer'
import { KpiCard } from '../components/ui/KpiCard'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { ErrorState, LoadingState } from '../components/ui/States'
import { StatusBadge } from '../components/ui/StatusBadge'
import { ProgressBar } from '../components/ui/ProgressBar'

const riskTypeLabels: Record<string, string> = {
  SINGLE_SOURCE: '单点依赖', LOW_INVENTORY: '库存不足', PRICE: '价格异常', POLICY: '政策风险', QUALITY: '质量风险', OTHER: '其他风险',
}

export function RiskActions() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [risks, setRisks] = useState<Risk[]>([])
  const [reference, setReference] = useState<ReferenceData | null>(null)
  const [selected, setSelected] = useState<Risk | null>(null)
  const [filter, setFilter] = useState('OPEN')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionOpen, setActionOpen] = useState(false)
  const initialDeepLinkHandled = useRef(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [riskRows, refs] = await Promise.all([
        api.get<Risk[]>('/risks', user.id),
        api.get<ReferenceData>('/reference-data', user.id),
      ])
      setRisks(riskRows)
      setReference(refs)
      if (!initialDeepLinkHandled.current) {
        initialDeepLinkHandled.current = true
        const riskId = searchParams.get('risk')
        const materialId = searchParams.get('material')
        let targetId = riskId
        if (!targetId && materialId) {
          const match = riskRows.find((risk) => risk.materialId === materialId && !['CLOSED', 'IGNORED'].includes(risk.status))
          if (match) {
            targetId = match.id
            setSearchParams({ risk: match.id }, { replace: true })
          }
        }
        if (targetId) {
          try { setSelected(await api.get<Risk>(`/risks/${targetId}`, user.id)) } catch { /* leave list visible */ }
        }
      }
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '风险数据加载失败。')
    } finally { setLoading(false) }
  }, [user, searchParams, setSearchParams])

  useEffect(() => { load() }, [load])

  const openRisk = async (risk: Risk) => {
    setSearchParams({ risk: risk.id })
    setSelected(risk)
    try { setSelected(await api.get<Risk>(`/risks/${risk.id}`, user.id)) } catch { /* list data remains visible */ }
  }

  const closeRisk = () => { setSelected(null); setSearchParams({}) }
  const active = risks.filter((risk) => !['CLOSED', 'IGNORED'].includes(risk.status))
  const filtered = useMemo(() => risks.filter((risk) => {
    const filterMatch = filter === 'ALL' || (filter === 'OPEN' ? !['CLOSED', 'IGNORED'].includes(risk.status) : risk.status === filter)
    const searchMatch = !search || risk.material.name.includes(search) || risk.id.toLowerCase().includes(search.toLowerCase()) || risk.description.includes(search)
    return filterMatch && searchMatch
  }), [risks, filter, search])

  if (loading) return <LoadingState label="正在加载风险与措施" />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <>
      <PageHeader eyebrow="RISK RESPONSE" title="风险物料与应对措施" description="风险自动浮现、措施智能推荐、责任任务一键发起" />
      <section className="kpi-grid kpi-grid-4">
        <KpiCard label="开放风险" value={active.length} unit="项" hint="等待评估或处理中" icon={ShieldAlert} tone="red" />
        <KpiCard label="危险 / 警告" value={active.filter((risk) => ['RED', 'ORANGE'].includes(risk.level)).length} unit="项" hint="需优先制定措施" icon={AlertTriangle} tone="orange" />
        <KpiCard label="已定措施" value={risks.reduce((sum, risk) => sum + risk.actions.length, 0)} unit="项" hint="覆盖风险处置动作" icon={Target} tone="blue" />
        <KpiCard label="已闭环" value={risks.filter((risk) => risk.status === 'CLOSED').length} unit="项" hint="措施全部完成" icon={CheckCircle2} tone="green" />
      </section>

      <section className="panel data-panel">
        <div className="table-toolbar risk-toolbar">
          <div><span>风险台账</span><h3>风险物料清单</h3></div>
          <div className="toolbar-filters">
            <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索风险或物料" /></label>
          </div>
        </div>
        <div className="tab-row">
          {[['OPEN', '开放风险'], ['PENDING', '待评估'], ['IN_PROGRESS', '跟进中'], ['CLOSED', '已闭环'], ['ALL', '全部']].map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}<span>{value === 'OPEN' ? active.length : value === 'ALL' ? risks.length : risks.filter((risk) => risk.status === value).length}</span></button>)}
        </div>
        <div className="table-scroll">
          <table className="data-table risk-table">
            <thead><tr><th>风险事件</th><th>风险类型</th><th>等级</th><th>供应商</th><th>影响范围</th><th>状态</th><th>措施</th><th>发现时间</th></tr></thead>
            <tbody>
              {filtered.map((risk) => (
                <tr key={risk.id} onClick={() => openRisk(risk)}>
                  <td><div className="primary-cell wide"><strong>{risk.material.name}</strong><span>{risk.id} · {risk.description}</span></div></td>
                  <td><span className="category-tag">{riskTypeLabels[risk.type] ?? risk.type}</span></td>
                  <td><StatusBadge status={risk.level} /></td>
                  <td>{risk.material.supplier.shortName}</td>
                  <td className="truncate-cell">{risk.impactScope}</td>
                  <td><StatusBadge status={risk.status} /></td>
                  <td><span className="action-count">{risk.actions.length}</span></td>
                  <td>{new Date(risk.discoveredAt).toLocaleDateString('zh-CN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">共 {filtered.length} 条风险记录</div>
      </section>

      <Drawer open={Boolean(selected)} onClose={closeRisk} title={selected ? `${selected.id} · ${selected.material.name}` : ''} subtitle="风险详情与应对措施" width="700px">
        {selected && (
          <div className="detail-stack risk-detail">
            <div className={`risk-detail-hero risk-hero-${selected.level.toLowerCase()}`}>
              <div><StatusBadge status={selected.level} /><span>{riskTypeLabels[selected.type]}</span><span>{selected.isAuto ? '系统自动识别' : '人工录入'}</span></div>
              <h3>{selected.description}</h3>
              <p>影响范围：{selected.impactScope}</p>
            </div>
            <section className="detail-section">
              <h4>风险来源</h4>
              <div className="metric-grid"><DetailMetric label="月需求" value={`${selected.material.demandMonthly.toLocaleString()} 吨`} /><DetailMetric label="月供应" value={`${selected.material.supplyMonthly.toLocaleString()} 吨`} /><DetailMetric label="安全库存" value={`${selected.material.safetyStockMonths} 个月`} /><DetailMetric label="供应商" value={selected.material.supplier.shortName} /></div>
            </section>
            <section className="detail-section">
              <div className="section-title-row"><div><h4>应对措施</h4><p>当前 {selected.actions.length} 项措施</p></div>{selected.status !== 'CLOSED' && <button className="button button-primary button-small" onClick={() => setActionOpen(true)}><ClipboardPlus size={16} />制定措施</button>}</div>
              {selected.actions.length === 0 ? (
                <div className="recommendation-empty"><Sparkles size={22} /><strong>该风险尚未制定措施</strong><span>系统已根据“{riskTypeLabels[selected.type]}”准备 {selected.templates?.length ?? 0} 条建议。</span><button className="button button-secondary button-small" onClick={() => setActionOpen(true)}>查看推荐措施</button></div>
              ) : selected.actions.map((action) => (
                <article className="action-card" key={action.id}>
                  <div className="action-card-head"><span className={`priority priority-${action.priority.toLowerCase()}`}>{action.priority}</span><StatusBadge status={action.status} /><span>{action.id}</span></div>
                  <h4>{action.description}</h4>
                  <div className="action-meta"><span><UserRound size={14} />{action.owner.name}</span><span><Clock3 size={14} />{new Date(action.deadline).toLocaleDateString('zh-CN')} 截止</span></div>
                  <ProgressBar value={action.completion} compact />
                </article>
              ))}
            </section>
          </div>
        )}
      </Drawer>

      {selected && reference && <ActionForm risk={selected} reference={reference} open={actionOpen} onClose={() => setActionOpen(false)} userId={user.id} onSaved={async (taskId) => { setActionOpen(false); await load(); setSelected(await api.get<Risk>(`/risks/${selected.id}`, user.id)); navigate(`/tasks?task=${taskId}`) }} />}
    </>
  )
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return <div className="metric-item"><span>{label}</span><strong>{value}</strong></div>
}

function ActionForm({ risk, reference, open, onClose, userId, onSaved }: { risk: Risk; reference: ReferenceData; open: boolean; onClose: () => void; userId: string; onSaved: (taskId: string) => Promise<void> }) {
  const templates = risk.templates ?? []
  const [selectedTemplate, setSelectedTemplate] = useState<ActionTemplate | null>(templates[0] ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const defaultDeadline = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)

  useEffect(() => { setSelectedTemplate(templates[0] ?? null) }, [risk.id, risk.templates])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      const created = await api.post<{ task: { id: string } }>(`/risks/${risk.id}/actions`, {
        type: form.get('type'), description: form.get('description'), ownerId: form.get('ownerId'), deadline: form.get('deadline'), priority: form.get('priority'), taskTitle: form.get('taskTitle'),
      }, userId)
      await onSaved(created.task.id)
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : '措施创建失败。') } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={`为 ${risk.id} 制定应对措施`}>
      <form className="action-form" onSubmit={submit}>
        <label className="field"><span>系统推荐模板</span></label>
        <div className="template-list">
          {templates.map((template) => <button type="button" key={template.title} className={selectedTemplate?.title === template.title ? 'selected' : ''} onClick={() => setSelectedTemplate(template)}><Sparkles size={17} /><span><strong>{template.title}</strong><small>{template.description}</small></span></button>)}
        </div>
        <input type="hidden" name="type" value={selectedTemplate?.type ?? 'OTHER'} />
        <label className="field"><span>措施描述</span><textarea name="description" rows={3} value={selectedTemplate?.description ?? ''} onChange={(event) => setSelectedTemplate((current) => ({ type: current?.type ?? 'OTHER', title: current?.title ?? '自定义措施', description: event.target.value }))} required /></label>
        <label className="field"><span>跟进任务标题</span><input name="taskTitle" defaultValue={selectedTemplate?.title ?? ''} key={selectedTemplate?.title} required /></label>
        <div className="form-grid">
          <label className="field"><span>责任人</span><select name="ownerId" required>{reference.owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name} · {owner.title}</option>)}</select></label>
          <label className="field"><span>优先级</span><select name="priority" defaultValue="P0"><option>P0</option><option>P1</option><option>P2</option></select></label>
          <label className="field field-span-2"><span>截止日期</span><input name="deadline" type="date" min={new Date().toISOString().slice(0, 10)} defaultValue={defaultDeadline} required /></label>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="form-actions"><button type="button" className="button button-secondary" onClick={onClose}>取消</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? '创建中…' : '创建措施并发起任务'}</button></div>
      </form>
    </Modal>
  )
}