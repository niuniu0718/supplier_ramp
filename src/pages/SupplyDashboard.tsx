import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, Boxes, CircleAlert, CircleCheck, Factory, Filter, PackagePlus, Search, ShieldAlert, TrendingDown } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import type { DashboardData, Material, ReferenceData } from '../types'
import { Drawer } from '../components/ui/Drawer'
import { ErrorState, LoadingState } from '../components/ui/States'
import { KpiCard } from '../components/ui/KpiCard'
import { Modal } from '../components/ui/Modal'
import { PageHeader } from '../components/ui/PageHeader'
import { StatusBadge } from '../components/ui/StatusBadge'

const statusColors = { GREEN: '#18a875', YELLOW: '#d9a21b', ORANGE: '#ef7d32', RED: '#dc3f4c' }
const types = ['全部类型', '正极', '负极', '电解液', '隔膜', '辅材']

export function SupplyDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [reference, setReference] = useState<ReferenceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('全部类型')
  const [riskFilter, setRiskFilter] = useState('ALL')
  const [selected, setSelected] = useState<Material | null>(null)
  const [detail, setDetail] = useState<Material | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const goToOpenRisk = (material: Material) => {
    const openRisk = (material.risks ?? []).find((risk) => !['CLOSED', 'IGNORED'].includes(risk.status))
    if (openRisk) navigate(`/risks?risk=${openRisk.id}`)
    else navigate(`/risks?material=${material.id}`)
  }

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const [dashboard, refs] = await Promise.all([
        api.get<DashboardData>('/dashboard', user.id),
        api.get<ReferenceData>('/reference-data', user.id),
      ])
      setData(dashboard)
      setReference(refs)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '看板加载失败。')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!selected || !user) {
      setDetail(null)
      return
    }
    api.get<Material>(`/materials/${selected.id}`, user.id).then(setDetail).catch(() => setDetail(selected))
  }, [selected, user])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.materials.filter((item) => {
      const matchesSearch = !search || item.name.includes(search) || item.supplier.shortName.includes(search) || item.id.toLowerCase().includes(search.toLowerCase())
      const matchesType = typeFilter === '全部类型' || item.type === typeFilter
      const matchesRisk = riskFilter === 'ALL' || item.riskLevel === riskFilter
      return matchesSearch && matchesType && matchesRisk
    })
  }, [data, search, typeFilter, riskFilter])

  if (loading) return <LoadingState label="正在汇总供需与风险数据" />
  if (error || !data) return <ErrorState message={error || '暂无数据'} onRetry={load} />

  const gapTotal = Math.max(0, data.summary.demandTotal - data.summary.supplyTotal)

  return (
    <>
      <PageHeader
        eyebrow="SUPPLY OVERVIEW"
        title="供需全景驾驶舱"
        description={`截至 ${new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date())} · 自动汇总全部化学料供需与风险状态`}
        actions={<button className="button button-primary" onClick={() => setFormOpen(true)}><PackagePlus size={17} />录入物料</button>}
      />

      <section className="kpi-grid kpi-grid-6">
        <KpiCard label="监控物料" value={data.summary.materialCount} unit="类" hint={`${data.summary.supplierCount} 家核心供应商`} icon={Boxes} tone="blue" />
        <KpiCard label="健康" value={data.riskCounts.GREEN} unit="类" hint="供需与库存正常" icon={CircleCheck} tone="green" />
        <KpiCard label="关注" value={data.riskCounts.YELLOW} unit="类" hint="需要持续观察" icon={CircleAlert} tone="orange" />
        <KpiCard label="警告" value={data.riskCounts.ORANGE} unit="类" hint="需制定改善动作" icon={AlertTriangle} tone="orange" />
        <KpiCard label="危险" value={data.riskCounts.RED} unit="类" hint="需立即升级处理" icon={ShieldAlert} tone="red" />
        <KpiCard label="月度净缺口" value={gapTotal.toLocaleString()} unit="吨" hint={`${data.summary.openRiskCount} 项开放风险`} icon={TrendingDown} tone="purple" />
      </section>

      <section className="dashboard-grid dashboard-grid-main">
        <article className="panel chart-panel">
          <div className="panel-header"><div><span>风险结构</span><h3>各物料类型健康度分布</h3></div><span className="panel-meta">共 {data.summary.materialCount} 类</span></div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.typeDistribution} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ebf2" />
                <XAxis dataKey="type" tickLine={false} axisLine={false} tick={{ fill: '#65708a', fontSize: 12 }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#98a2b8', fontSize: 11 }} />
                <Tooltip cursor={{ fill: '#f5f7fb' }} contentStyle={{ border: '1px solid #e2e7f0', borderRadius: 10, boxShadow: '0 10px 28px rgba(17, 24, 39, .08)' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <Bar name="健康" dataKey="GREEN" stackId="risk" fill={statusColors.GREEN} radius={[0, 0, 3, 3]} />
                <Bar name="关注" dataKey="YELLOW" stackId="risk" fill={statusColors.YELLOW} />
                <Bar name="警告" dataKey="ORANGE" stackId="risk" fill={statusColors.ORANGE} />
                <Bar name="危险" dataKey="RED" stackId="risk" fill={statusColors.RED} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel chart-panel">
          <div className="panel-header"><div><span>8 周趋势</span><h3>综合供应健康度</h3></div><span className={`trend-chip ${data.healthTrend.at(-1)!.score >= data.healthTrend[0].score ? 'up' : 'down'}`}>{data.healthTrend.at(-1)!.score} 分</span></div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.healthTrend} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ebf2" />
                <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fill: '#65708a', fontSize: 12 }} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: '#98a2b8', fontSize: 11 }} />
                <Tooltip contentStyle={{ border: '1px solid #e2e7f0', borderRadius: 10 }} formatter={(value) => [`${value} 分`, '健康度']} />
                <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid-secondary">
        <article className="panel chart-panel gap-panel">
          <div className="panel-header"><div><span>缺口分析</span><h3>高缺口物料排行</h3></div><span className="panel-meta">吨 / 月</span></div>
          <div className="chart-body chart-body-short">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.gapAnalysis} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e7ebf2" />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: '#98a2b8', fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={90} tickLine={false} axisLine={false} tick={{ fill: '#4b5670', fontSize: 11 }} />
                <Tooltip formatter={(value) => [`${Number(value).toLocaleString()} 吨`, '供需缺口']} />
                <Bar dataKey="gap" radius={[0, 5, 5, 0]}>
                  {data.gapAnalysis.map((entry) => <Cell key={entry.id} fill={entry.gap > 1000 ? '#dc3f4c' : entry.gap > 0 ? '#ef7d32' : '#18a875'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel risk-top-panel">
          <div className="panel-header"><div><span>优先处理</span><h3>风险物料 TOP 5</h3></div><button className="text-button" onClick={() => setRiskFilter('RED')}>只看危险</button></div>
          <div className="risk-top-list">
            {data.topRisks.slice(0, 5).map((item, index) => (
              <button key={item.id} onClick={() => goToOpenRisk(item)}>
                <span className="risk-rank">{String(index + 1).padStart(2, '0')}</span>
                <span className="risk-item-copy"><strong>{item.name}</strong><small>{item.supplier.shortName} · 缺口 {Math.max(0, item.supplyGap).toLocaleString()} 吨</small></span>
                <StatusBadge status={item.riskLevel} />
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="panel data-panel">
        <div className="table-toolbar">
          <div><span>物料台账</span><h3>化学料供需总览</h3></div>
          <div className="toolbar-filters">
            <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索物料或供应商" /></label>
            <label className="select-field"><Filter size={15} /><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>{types.map((type) => <option key={type}>{type}</option>)}</select></label>
            <select className="plain-select" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}><option value="ALL">全部状态</option><option value="RED">危险</option><option value="ORANGE">警告</option><option value="YELLOW">关注</option><option value="GREEN">健康</option></select>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>物料</th><th>类型</th><th>供应商</th><th className="number">月需求</th><th className="number">月供应</th><th className="number">供需缺口</th><th>库存覆盖</th><th>单点依赖</th><th>风险状态</th><th>措施</th></tr></thead>
            <tbody>
              {filtered.map((item) => {
                const hasOpenRisk = (item.risks ?? []).some((risk) => !['CLOSED', 'IGNORED'].includes(risk.status))
                return (
                <tr key={item.id} onClick={() => hasOpenRisk ? goToOpenRisk(item) : setSelected(item)}>
                  <td><div className="primary-cell"><strong>{item.name}</strong><span>{item.id}</span></div></td>
                  <td><span className="category-tag">{item.type}</span></td>
                  <td><div className="primary-cell"><strong>{item.supplier.shortName}</strong><span>{item.supplier.location}</span></div></td>
                  <td className="number">{item.demandMonthly.toLocaleString()}<small> 吨</small></td>
                  <td className="number">{item.supplyMonthly.toLocaleString()}<small> 吨</small></td>
                  <td className={`number ${item.supplyGap > 0 ? 'negative' : 'positive'}`}>{item.supplyGap > 0 ? '-' : '+'}{Math.abs(item.supplyGap).toLocaleString()}<small> 吨</small></td>
                  <td><strong>{(item.inventory / item.demandMonthly).toFixed(1)}</strong><small> 个月</small></td>
                  <td>{item.singleSource ? <span className="single-source">是 · {item.dependenceLevel}</span> : <span className="muted">否</span>}</td>
                  <td><StatusBadge status={item.riskLevel} /></td>
                  <td><span className="action-count">{item.actionCount}{hasOpenRisk && <i title="有开放风险，点击跳转" />}</span></td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
        <div className="table-footer">显示 {filtered.length} / {data.materials.length} 类物料</div>
      </section>

      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.name ?? ''} subtitle={`${selected?.id ?? ''} · 物料供需与风险详情`}>
        {detail ? <MaterialDetail material={detail} /> : <LoadingState label="加载物料详情" />}
      </Drawer>

      {reference && <MaterialForm open={formOpen} onClose={() => setFormOpen(false)} reference={reference} userId={user.id} onSaved={() => { setFormOpen(false); load() }} />}
    </>
  )
}

function MaterialDetail({ material }: { material: Material }) {
  return (
    <div className="detail-stack">
      <div className="detail-hero">
        <div><span>综合风险等级</span><StatusBadge status={material.riskLevel} /></div>
        <p>{material.riskDescription}</p>
      </div>
      <section className="detail-section"><h4>供需核心指标</h4><div className="metric-grid"><Metric label="月需求量" value={`${material.demandMonthly.toLocaleString()} 吨`} /><Metric label="月供应量" value={`${material.supplyMonthly.toLocaleString()} 吨`} /><Metric label="库存量" value={`${material.inventory.toLocaleString()} 吨`} /><Metric label="安全库存" value={`${material.safetyStockMonths} 个月`} /></div></section>
      <section className="detail-section"><h4>供应关系</h4><div className="info-list"><div><span>当前供应商</span><strong>{material.supplier.name}</strong></div><div><span>单点依赖</span><strong>{material.singleSource ? `是 · ${material.dependenceLevel}` : '否'}</strong></div><div><span>供应商所在地</span><strong>{material.supplier.location}</strong></div></div></section>
      <section className="detail-section"><h4>关联风险与措施</h4>{material.risks?.length ? material.risks.map((risk) => <div className="linked-card" key={risk.id}><div><StatusBadge status={risk.level} /><span>{risk.id}</span></div><strong>{risk.description}</strong><small>{risk.actions?.length ?? 0} 项措施 · 当前{risk.status === 'CLOSED' ? '已闭环' : '处理中'}</small></div>) : <p className="muted">暂无关联风险。</p>}</section>
      <section className="detail-section"><h4>关联扩产计划</h4>{material.expansionPlans?.length ? material.expansionPlans.map((plan) => <div className="linked-card" key={plan.id}><div><StatusBadge status={plan.status} /><span>{plan.id}</span></div><strong>{plan.name}</strong><small>当前进度 {plan.progress}%</small></div>) : <p className="muted">暂无关联扩产计划。</p>}</section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric-item"><span>{label}</span><strong>{value}</strong></div>
}

function MaterialForm({ open, onClose, reference, userId, onSaved }: { open: boolean; onClose: () => void; reference: ReferenceData; userId: string; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      await api.post('/materials', {
        name: form.get('name'), type: form.get('type'), supplierId: form.get('supplierId'),
        demandMonthly: form.get('demandMonthly'), supplyMonthly: form.get('supplyMonthly'), inventory: form.get('inventory'),
        safetyStockMonths: form.get('safetyStockMonths'), singleSource: form.get('singleSource') === 'on',
        dependenceLevel: form.get('dependenceLevel') || null, riskDescription: form.get('riskDescription'), ownerId: form.get('ownerId'),
      }, userId)
      onSaved()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '保存失败。')
    } finally { setSaving(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="录入化学料供需数据">
      <form className="form-grid" onSubmit={submit}>
        <label className="field field-span-2"><span>物料名称</span><input name="name" required placeholder="例如：电池级碳酸锂" /></label>
        <label className="field"><span>物料类型</span><select name="type" required>{types.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="field"><span>供应商</span><select name="supplierId" required>{reference.suppliers.map((item) => <option value={item.id} key={item.id}>{item.shortName}</option>)}</select></label>
        <label className="field"><span>月需求量（吨）</span><input name="demandMonthly" type="number" min="0" required /></label>
        <label className="field"><span>月供应量（吨）</span><input name="supplyMonthly" type="number" min="0" required /></label>
        <label className="field"><span>库存量（吨）</span><input name="inventory" type="number" min="0" required /></label>
        <label className="field"><span>安全库存（月）</span><input name="safetyStockMonths" type="number" min="0" step="0.1" required /></label>
        <label className="field"><span>单点依赖程度</span><select name="dependenceLevel"><option value="">不适用</option><option>独家</option><option>主供</option></select></label>
        <label className="field checkbox-field"><input name="singleSource" type="checkbox" /><span>属于单点依赖物料</span></label>
        <label className="field"><span>负责人</span><select name="ownerId" required>{reference.owners.map((owner) => <option value={owner.id} key={owner.id}>{owner.name} · {owner.title}</option>)}</select></label>
        <label className="field field-span-2"><span>主要风险描述</span><textarea name="riskDescription" required rows={3} placeholder="描述供需、库存、单点依赖或交付风险" /></label>
        {error && <div className="form-error field-span-2">{error}</div>}
        <div className="form-actions field-span-2"><button type="button" className="button button-secondary" onClick={onClose}>取消</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? '保存中…' : '保存并自动评估风险'}</button></div>
      </form>
    </Modal>
  )
}
