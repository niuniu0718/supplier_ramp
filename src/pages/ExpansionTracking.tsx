import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AlertTriangle, Banknote, CalendarRange, Factory, Gauge, PackagePlus, Search, SlidersHorizontal, TrendingUp, Wrench } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import type { ExpansionPlan, Material } from '../types'
import { Drawer } from '../components/ui/Drawer'
import { KpiCard } from '../components/ui/KpiCard'
import { PageHeader } from '../components/ui/PageHeader'
import { ProgressBar } from '../components/ui/ProgressBar'
import { ErrorState, LoadingState } from '../components/ui/States'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Modal } from '../components/ui/Modal'

const stageOrder = ['设计', '采购设备', '安装', '调试', '投产']
const itemStatusLabels: Record<string, string> = { UNSIGNED: '未签', SIGNED: '已签', PARTIAL: '部分到货', ARRIVED: '已到货', COMMISSIONING: '调试中', RUNNING: '已投产' }

export function ExpansionTracking() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [plans, setPlans] = useState<ExpansionPlan[]>([])
  const [selected, setSelected] = useState<ExpansionPlan | null>(null)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'overview' | 'timeline'>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createPrefill, setCreatePrefill] = useState<{ materialId: string; name: string } | null>(null)
  const initialDeepLinkHandled = useRef(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const rows = await api.get<ExpansionPlan[]>('/expansion-plans', user.id)
      setPlans(rows)
      if (!initialDeepLinkHandled.current) {
        initialDeepLinkHandled.current = true
        const planId = searchParams.get('plan')
        if (planId) {
          try { setSelected(await api.get<ExpansionPlan>(`/expansion-plans/${planId}`, user.id)) } catch { /* leave list */ }
        } else {
          const materialId = searchParams.get('materialId')
          const planName = searchParams.get('planName')
          if (materialId && planName) {
            setCreatePrefill({ materialId, name: planName })
          }
        }
      }
      setError('')
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : '扩产数据加载失败。') } finally { setLoading(false) }
  }, [user, searchParams])

  useEffect(() => { load() }, [load])

  const openPlan = async (plan: ExpansionPlan) => {
    setSelected(plan)
    setSearchParams({ plan: plan.id }, { replace: true })
    try { setSelected(await api.get<ExpansionPlan>(`/expansion-plans/${plan.id}`, user.id)) } catch { /* retain row */ }
  }
  const closePlan = () => { setSelected(null); setSearchParams({}) }
  const filtered = useMemo(() => plans.filter((plan) => {
    const statusMatch = statusFilter === 'ALL' || plan.status === statusFilter
    const searchMatch = !search || plan.name.includes(search) || plan.supplier.shortName.includes(search) || plan.material.name.includes(search)
    return statusMatch && searchMatch
  }), [plans, statusFilter, search])

  if (loading) return <LoadingState label="正在加载供应商扩产计划" />
  if (error) return <ErrorState message={error} onRetry={load} />

  const targetCapacity = plans.reduce((sum, plan) => sum + plan.targetCapacity, 0)
  const capex = plans.reduce((sum, plan) => sum + plan.totalCapex, 0)
  const invested = plans.reduce((sum, plan) => sum + plan.investedCapex, 0)
  const weightedProgress = targetCapacity ? Math.round(plans.reduce((sum, plan) => sum + plan.progress * plan.targetCapacity, 0) / targetCapacity) : 0
  const chartData = plans.map((plan) => ({ supplier: plan.supplier.shortName, 实际进度: plan.progress, 预期进度: plan.expectedProgress }))

  return (
    <>
      <PageHeader eyebrow="CAPACITY RAMP" title="供应商扩产跟踪" description="穿透计划、设备与关键物料，提前识别扩产掉链风险" />
      <section className="kpi-grid kpi-grid-4">
        <KpiCard label="扩产计划" value={plans.length} unit="项" hint={`${new Set(plans.map((plan) => plan.supplierId)).size} 家供应商`} icon={Factory} tone="blue" />
        <KpiCard label="目标新增产能" value={(targetCapacity / 10000).toFixed(1)} unit="万吨/年" hint="全部计划达产口径" icon={TrendingUp} tone="cyan" />
        <KpiCard label="综合计划进度" value={weightedProgress} unit="%" hint="按目标产能加权" icon={Gauge} tone="green" />
        <KpiCard label="红橙预警" value={plans.filter((plan) => ['RED', 'ORANGE'].includes(plan.status)).length} unit="项" hint={`已投入 CAPEX ${(invested / 10000).toFixed(1)} / ${(capex / 10000).toFixed(1)} 亿元`} icon={AlertTriangle} tone="red" />
      </section>

      <section className="dashboard-grid expansion-charts">
        <article className="panel chart-panel">
          <div className="panel-header"><div><span>横向对比</span><h3>各供应商实际 / 预期进度</h3></div><span className="panel-meta">%</span></div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ebf2" /><XAxis dataKey="supplier" tickLine={false} axisLine={false} tick={{ fill: '#65708a', fontSize: 11 }} /><YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: '#98a2b8', fontSize: 11 }} /><Tooltip /><Legend iconType="circle" iconSize={8} /><Bar dataKey="实际进度" fill="#2563eb" radius={[4, 4, 0, 0]} /><Bar dataKey="预期进度" fill="#b8c4d9" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
          </div>
        </article>
        <article className="panel expansion-alert-panel">
          <div className="panel-header"><div><span>风险预警</span><h3>需要关注的扩产计划</h3></div><span className="panel-meta">按严重度</span></div>
          <div className="expansion-alert-list">
            {plans.filter((plan) => plan.status !== 'GREEN').sort((a, b) => b.lag - a.lag).map((plan) => <button key={plan.id} onClick={() => openPlan(plan)}><StatusBadge status={plan.status} /><span><strong>{plan.name}</strong><small>{plan.supplier.shortName} · 落后预期 {plan.lag} 个百分点</small></span><strong>{plan.progress}%</strong></button>)}
          </div>
        </article>
      </section>

      <section className="panel expansion-workspace">
        <div className="table-toolbar">
          <div><span>计划工作台</span><h3>扩产进度总览</h3></div>
          <div className="toolbar-filters">
            <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索计划或供应商" /></label>
            <label className="select-field"><SlidersHorizontal size={15} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">全部状态</option><option value="RED">危险</option><option value="ORANGE">警告</option><option value="YELLOW">关注</option><option value="GREEN">健康</option></select></label>
            <div className="segmented"><button className={view === 'overview' ? 'active' : ''} onClick={() => setView('overview')}>计划卡片</button><button className={view === 'timeline' ? 'active' : ''} onClick={() => setView('timeline')}>里程碑</button></div>
          </div>
        </div>

        {view === 'overview' ? (
          <div className="plan-card-grid">
            {filtered.map((plan) => <button className="plan-card" key={plan.id} onClick={() => openPlan(plan)}>
              <div className="plan-card-head"><span className="plan-code">{plan.id}</span><StatusBadge status={plan.status} /></div>
              <h3>{plan.name}</h3><p>{plan.supplier.shortName} · {plan.material.name}</p>
              <div className="stage-steps">{stageOrder.map((stage, index) => <span key={stage} className={index <= stageOrder.indexOf(plan.stage) ? 'done' : ''}><i />{stage}</span>)}</div>
              <ProgressBar value={plan.progress} expected={plan.expectedProgress} status={plan.status} />
              <div className="plan-card-metrics"><div><span>目标产能</span><strong>{(plan.targetCapacity / 10000).toFixed(1)} 万吨/年</strong></div><div><span>CAPEX 进度</span><strong>{Math.round(plan.investedCapex / plan.totalCapex * 100)}%</strong></div><div><span>关键事项</span><strong>{plan.items.length} 项</strong></div></div>
              <div className="plan-card-foot"><span>更新于 {new Date(plan.updatedAt).toLocaleDateString('zh-CN')}</span><strong>查看详情 →</strong></div>
            </button>)}
          </div>
        ) : <GanttTimeline plans={filtered} onOpen={openPlan} />}
      </section>

      <Drawer open={Boolean(selected)} onClose={closePlan} title={selected ? `${selected.id} · ${selected.name}` : ''} subtitle="扩产进度、投资与关键路径" width="760px">
        {selected && <PlanDetail plan={selected} userId={user.id} onChanged={async () => { await load(); setSelected(await api.get<ExpansionPlan>(`/expansion-plans/${selected.id}`, user.id)) }} />}
      </Drawer>

      {createPrefill && <NewPlanModal prefill={createPrefill} userId={user.id} onClose={() => { setCreatePrefill(null); setSearchParams({}) }} onCreated={async (plan) => { setCreatePrefill(null); setSearchParams({ plan: plan.id }); await load(); setSelected(plan) }} />}
    </>
  )
}

function GanttTimeline({ plans, onOpen }: { plans: ExpansionPlan[]; onOpen: (plan: ExpansionPlan) => void }) {
  if (!plans.length) return <div className="empty-state"><strong>暂无扩产计划</strong><span>请调整筛选条件。</span></div>
  const min = Math.min(...plans.map((plan) => new Date(plan.startDate).getTime()))
  const max = Math.max(...plans.map((plan) => new Date(plan.endDate).getTime()))
  const range = Math.max(1, max - min)
  return <div className="gantt"><div className="gantt-axis"><span>{new Date(min).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short' })}</span><span>计划周期</span><span>{new Date(max).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short' })}</span></div>{plans.map((plan) => { const left = (new Date(plan.startDate).getTime() - min) / range * 100; const width = (new Date(plan.endDate).getTime() - new Date(plan.startDate).getTime()) / range * 100; return <button className="gantt-row" key={plan.id} onClick={() => onOpen(plan)}><div><strong>{plan.name}</strong><span>{plan.supplier.shortName}</span></div><div className="gantt-track"><span className={`gantt-bar gantt-${plan.status.toLowerCase()}`} style={{ left: `${left}%`, width: `${Math.max(width, 4)}%` }}><i style={{ width: `${plan.progress}%` }} /><b>{plan.progress}%</b></span></div></button> })}</div>
}

function PlanDetail({ plan, userId, onChanged }: { plan: ExpansionPlan; userId: string; onChanged: () => Promise<void> }) {
  const [progress, setProgress] = useState(plan.progress)
  const [stage, setStage] = useState(plan.stage)
  const [description, setDescription] = useState(plan.riskDescription)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { setProgress(plan.progress); setStage(plan.stage); setDescription(plan.riskDescription) }, [plan.id, plan.progress, plan.stage, plan.riskDescription])
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError('')
    try { await api.patch(`/expansion-plans/${plan.id}`, { progress, stage, riskDescription: description }, userId); await onChanged() } catch (requestError) { setError(requestError instanceof Error ? requestError.message : '更新失败。') } finally { setSaving(false) }
  }

  return <div className="detail-stack plan-detail">
    <div className={`plan-detail-hero risk-hero-${plan.status.toLowerCase()}`}>
      <div><StatusBadge status={plan.status} /><span>{plan.supplier.name}</span></div><h3>{plan.material.name} · 目标新增 {(plan.targetCapacity / 10000).toFixed(1)} 万吨/年</h3><p>{plan.riskDescription}</p>
    </div>
    <section className="detail-section"><h4>项目概况</h4><div className="metric-grid metric-grid-3"><PlanMetric icon={CalendarRange} label="计划周期" value={`${new Date(plan.startDate).toLocaleDateString('zh-CN')} — ${new Date(plan.endDate).toLocaleDateString('zh-CN')}`} /><PlanMetric icon={Banknote} label="CAPEX 投入" value={`${plan.investedCapex.toLocaleString()} / ${plan.totalCapex.toLocaleString()} 万元`} /><PlanMetric icon={Factory} label="当前阶段" value={plan.stage} /></div><div className="large-progress"><ProgressBar value={plan.progress} expected={plan.expectedProgress} status={plan.status} /></div></section>
    <form className="progress-update-card" onSubmit={submit}><div className="section-title-row"><div><h4>更新扩产进度</h4><p>保存后系统将重算红黄绿状态</p></div><strong className="progress-big">{progress}%</strong></div><div className="form-grid"><label className="field"><span>当前阶段</span><select value={stage} onChange={(event) => setStage(event.target.value)}>{stageOrder.map((item) => <option key={item}>{item}</option>)}</select></label><label className="field"><span>实际进度</span><input type="number" min="0" max="100" value={progress} onChange={(event) => setProgress(Number(event.target.value))} /></label><label className="field field-span-2"><span>本周风险与进展说明</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} required /></label></div>{error && <div className="form-error">{error}</div>}<button className="button button-primary button-full" disabled={saving}>{saving ? '正在提交…' : '提交更新并重算状态'}</button></form>
    <section className="detail-section"><h4>关键设备 / 物料 <span className="section-count">{plan.items.length}</span></h4><div className="item-list">{plan.items.map((item) => <div className="expansion-item" key={item.id}><span className="item-icon">{item.type === 'EQUIPMENT' ? <Wrench size={17} /> : <Factory size={17} />}</span><div><strong>{item.name}</strong><small>{item.vendor} · {item.orderNo}</small></div><div><strong>{itemStatusLabels[item.status] ?? item.status}</strong><small>预计 {new Date(item.expectedArrival).toLocaleDateString('zh-CN')}</small></div>{item.delayDays > 0 ? <span className="delay-chip">延期 {item.delayDays} 天</span> : <span className="on-time-chip">按期</span>}</div>)}</div></section>
  </div>
}

function PlanMetric({ icon: Icon, label, value }: { icon: typeof CalendarRange; label: string; value: string }) { return <div className="metric-item icon-metric"><Icon size={17} /><span>{label}</span><strong>{value}</strong></div> }

function NewPlanModal({ prefill, userId, onClose, onCreated }: { prefill: { materialId: string; name: string }; userId: string; onClose: () => void; onCreated: (plan: ExpansionPlan) => Promise<void> }) {
  const [material, setMaterial] = useState<Material | null>(null)
  const [name, setName] = useState(prefill.name)
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10))
  const [targetCapacity, setTargetCapacity] = useState(10000)
  const [totalCapex, setTotalCapex] = useState(20000)
  const [investedCapex, setInvestedCapex] = useState(0)
  const [stage, setStage] = useState('设计')
  const [progress, setProgress] = useState(0)
  const [riskDescription, setRiskDescription] = useState('由对应风险措施触发，需要新增产能保障供应。')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { api.get<Material>(`/materials/${prefill.materialId}`, userId).then(setMaterial).catch(() => undefined) }, [prefill.materialId, userId])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const plan = await api.post<ExpansionPlan>('/expansion-plans', {
        materialId: prefill.materialId,
        name, startDate, endDate, targetCapacity, totalCapex, investedCapex, stage, progress, riskDescription,
      }, userId)
      await onCreated(plan)
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : '创建扩产计划失败。') } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title="为供应商发起扩产跟踪">
      <form className="form-grid expansion-new-form" onSubmit={submit}>
        {material && <div className="field field-span-2 expansion-new-banner">
          <span>关联物料</span>
          <strong>{material.name} · {material.supplier.name}</strong>
          <small>计划将自动关联到当前供应商，无需重复选择。</small>
        </div>}
        <label className="field field-span-2"><span>计划名称</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label className="field"><span>计划开始日期</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></label>
        <label className="field"><span>计划结束日期</span><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></label>
        <label className="field"><span>目标新增产能（吨/年）</span><input type="number" min="0" step="100" value={targetCapacity} onChange={(event) => setTargetCapacity(Number(event.target.value))} required /></label>
        <label className="field"><span>总投资 CAPEX（万元）</span><input type="number" min="0" step="100" value={totalCapex} onChange={(event) => setTotalCapex(Number(event.target.value))} required /></label>
        <label className="field"><span>当前阶段</span><select value={stage} onChange={(event) => setStage(event.target.value)}>{stageOrder.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="field"><span>当前进度（%）</span><input type="number" min="0" max="100" value={progress} onChange={(event) => setProgress(Number(event.target.value))} /></label>
        <label className="field field-span-2"><span>进展说明 / 风险</span><textarea rows={3} value={riskDescription} onChange={(event) => setRiskDescription(event.target.value)} required /></label>
        {error && <div className="form-error field-span-2">{error}</div>}
        <div className="form-actions field-span-2"><button type="button" className="button button-secondary" onClick={onClose}>取消</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? '创建中…' : '创建并打开计划详情'}</button></div>
      </form>
    </Modal>
  )
}