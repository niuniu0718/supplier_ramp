import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AlertOctagon, CheckCircle2, ClipboardCheck, Clock3, Factory, FileText, ListTodo, Paperclip, Search, Upload, UserRound } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import type { FollowTask } from '../types'
import { Drawer } from '../components/ui/Drawer'
import { KpiCard } from '../components/ui/KpiCard'
import { PageHeader } from '../components/ui/PageHeader'
import { ProgressBar } from '../components/ui/ProgressBar'
import { ErrorState, LoadingState } from '../components/ui/States'
import { StatusBadge } from '../components/ui/StatusBadge'

const actionTypeLabels: Record<string, string> = {
  SOURCING: '寻源', STOCK: '备货', TRANSFER: '调拨', PRICE_LOCK: '锁价', INSURANCE: '套保',
  CONTRACT: '合同', EXPANSION: '供应商扩产', OTHER: '其他',
}

export function TaskTracking() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tasks, setTasks] = useState<FollowTask[]>([])
  const [selected, setSelected] = useState<FollowTask | null>(null)
  const [filter, setFilter] = useState('MINE')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const initialDeepLinkHandled = useRef(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const rows = await api.get<FollowTask[]>('/tasks', user.id)
      setTasks(rows)
      if (!initialDeepLinkHandled.current) {
        initialDeepLinkHandled.current = true
        const taskId = searchParams.get('task')
        if (taskId) {
          try { setSelected(await api.get<FollowTask>(`/tasks/${taskId}`, user.id)) } catch { /* leave list */ }
        }
      }
      setError('')
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : '任务加载失败。') } finally { setLoading(false) }
  }, [user, searchParams])

  useEffect(() => { load() }, [load])

  const openTask = async (task: FollowTask) => {
    setSearchParams({ task: task.id })
    setSelected(task)
    try { setSelected(await api.get<FollowTask>(`/tasks/${task.id}`, user.id)) } catch { /* retain row */ }
  }
  const closeTask = () => { setSelected(null); setSearchParams({}) }

  const filtered = useMemo(() => tasks.filter((task) => {
    const filterMatch = filter === 'ALL' || (filter === 'MINE' ? task.ownerId === user.id : filter === 'OVERDUE' ? task.status === 'OVERDUE' : filter === 'COMPLETED' ? task.status === 'COMPLETED' : true)
    const searchMatch = !search || task.title.includes(search) || task.id.toLowerCase().includes(search.toLowerCase()) || task.action.risk.material.name.includes(search)
    return filterMatch && searchMatch
  }), [tasks, filter, search, user])

  if (loading) return <LoadingState label="正在加载措施跟进任务" />
  if (error) return <ErrorState message={error} onRetry={load} />

  const openTasks = tasks.filter((task) => task.status !== 'COMPLETED')
  const completedThisMonth = tasks.filter((task) => task.status === 'COMPLETED' && task.closedAt && new Date(task.closedAt).getMonth() === new Date().getMonth()).length
  const avgProgress = openTasks.length ? Math.round(openTasks.reduce((sum, task) => sum + task.progress, 0) / openTasks.length) : 100

  return (
    <>
      <PageHeader eyebrow="ACTION CLOSURE" title="措施跟进与闭环" description="明确责任、更新进展、沉淀证据，让每一项风险措施有始有终" />
      <section className="kpi-grid kpi-grid-4">
        <KpiCard label="我的待办" value={tasks.filter((task) => task.ownerId === user.id && task.status !== 'COMPLETED').length} unit="项" hint="由当前身份负责" icon={ListTodo} tone="blue" />
        <KpiCard label="逾期任务" value={tasks.filter((task) => task.status === 'OVERDUE').length} unit="项" hint="需立即更新或升级" icon={AlertOctagon} tone="red" />
        <KpiCard label="平均进度" value={avgProgress} unit="%" hint="全部开放任务" icon={ClipboardCheck} tone="cyan" />
        <KpiCard label="本月闭环" value={completedThisMonth} unit="项" hint="完成后自动关单" icon={CheckCircle2} tone="green" />
      </section>

      <section className="panel task-workspace">
        <div className="table-toolbar">
          <div><span>执行工作台</span><h3>措施跟进任务</h3></div>
          <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索任务、物料或编号" /></label>
        </div>
        <div className="tab-row">
          {[['MINE', '我的待办'], ['ALL', '全部任务'], ['OVERDUE', '逾期'], ['COMPLETED', '已闭环']].map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}<span>{value === 'MINE' ? tasks.filter((task) => task.ownerId === user.id && task.status !== 'COMPLETED').length : value === 'ALL' ? tasks.length : value === 'OVERDUE' ? tasks.filter((task) => task.status === 'OVERDUE').length : tasks.filter((task) => task.status === 'COMPLETED').length}</span></button>)}
        </div>
        <div className="task-list">
          {filtered.map((task) => {
            const daysLeft = Math.ceil((new Date(task.deadline).getTime() - Date.now()) / 86_400_000)
            return (
              <button className="task-row" key={task.id} onClick={() => openTask(task)}>
                <div className={`task-status-line status-line-${task.status === 'OVERDUE' ? 'red' : task.status === 'COMPLETED' ? 'green' : 'blue'}`} />
                <div className="task-main">
                  <div className="task-title-row">
                    <span className={`priority priority-${task.action.priority.toLowerCase()}`}>{task.action.priority}</span>
                    <strong>{task.title}</strong>
                    <span>{task.id}</span>
                    {task.action.type === 'EXPANSION' && <span className="expansion-chip"><Factory size={12} />供应商扩产</span>}
                  </div>
                  <div className="task-context"><span>{task.action.risk.material.name}</span><i /> <span>{task.action.risk.material.supplier.shortName}</span><i /> <span>关联风险 {task.action.risk.id}</span></div>
                </div>
                <div className="task-owner"><span className="avatar avatar-small" style={{ background: task.owner.avatarColor }}>{task.owner.name.slice(-1)}</span><div><strong>{task.owner.name}</strong><small>{task.owner.title}</small></div></div>
                <div className="task-progress"><ProgressBar value={task.progress} compact /><span>{task.progress}%</span></div>
                <div className={`task-deadline ${daysLeft < 0 && task.status !== 'COMPLETED' ? 'overdue' : ''}`}><Clock3 size={15} /><div><strong>{new Date(task.deadline).toLocaleDateString('zh-CN')}</strong><small>{task.status === 'COMPLETED' ? '已完成' : daysLeft < 0 ? `逾期 ${Math.abs(daysLeft)} 天` : `${daysLeft} 天后到期`}</small></div></div>
                <StatusBadge status={task.status} />
              </button>
            )
          })}
          {filtered.length === 0 && <div className="empty-state"><strong>当前视图暂无任务</strong><span>可切换筛选条件查看其他任务。</span></div>}
        </div>
      </section>

      <Drawer open={Boolean(selected)} onClose={closeTask} title={selected ? `${selected.id} · ${selected.title}` : ''} subtitle="任务进度、跟进记录与闭环证据" width="720px">
        {selected && <TaskDetail task={selected} currentUserId={user.id} onChanged={async () => { await load(); setSelected(await api.get<FollowTask>(`/tasks/${selected.id}`, user.id)) }} onLaunchExpansion={() => navigate(`/expansion?materialId=${selected.action.risk.materialId}&actionId=${selected.action.id}&taskId=${selected.id}&planName=${encodeURIComponent(`${selected.action.risk.material.name} · 扩产保供`)}`)} />}
      </Drawer>
    </>
  )
}

function TaskDetail({ task, currentUserId, onChanged, onLaunchExpansion }: { task: FollowTask; currentUserId: string; onChanged: () => Promise<void>; onLaunchExpansion: () => void }) {
  const [progress, setProgress] = useState(task.progress)
  const [description, setDescription] = useState(task.progressDescription)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { setProgress(task.progress); setDescription(task.progressDescription) }, [task.id, task.progress, task.progressDescription])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.patch(`/tasks/${task.id}/progress`, { progress, description }, currentUserId)
      if (file) {
        const form = new FormData()
        form.append('file', file)
        const response = await fetch(`/api/tasks/${task.id}/attachments`, { method: 'POST', headers: { 'X-User-Id': currentUserId }, body: form })
        if (!response.ok) { const body = await response.json(); throw new Error(body.message ?? '附件上传失败。') }
      }
      setFile(null)
      await onChanged()
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : '更新失败。') } finally { setSaving(false) }
  }

  return (
    <div className="detail-stack task-detail">
      <div className="task-detail-hero">
        <div>
          <span className={`priority priority-${task.action.priority.toLowerCase()}`}>{task.action.priority}</span>
          <StatusBadge status={task.status} />
          <span className="action-type-chip">{actionTypeLabels[task.action.type] ?? task.action.type}</span>
        </div>
        <p>{task.action.description}</p>
        <div className="task-info-grid">
          <div><span>关联物料</span><strong>{task.action.risk.material.name}</strong></div>
          <div><span>责任人</span><strong>{task.owner.name}</strong></div>
          <div><span>开始日期</span><strong>{new Date(task.startDate).toLocaleDateString('zh-CN')}</strong></div>
          <div><span>截止日期</span><strong>{new Date(task.deadline).toLocaleDateString('zh-CN')}</strong></div>
        </div>
      </div>

      {task.status !== 'COMPLETED' && (
        <form className="progress-update-card" onSubmit={submit}>
          <div className="section-title-row"><div><h4>更新任务进度</h4><p>进度达到 100% 后系统将自动闭环</p></div><strong className="progress-big">{progress}%</strong></div>
          <div className="progress-preset-row">{[25, 50, 75, 100].map((value) => <button type="button" key={value} className={progress === value ? 'active' : ''} onClick={() => setProgress(value)}>{value}%</button>)}</div>
          <input className="range-input" type="range" min="0" max="100" step="5" value={progress} onChange={(event) => setProgress(Number(event.target.value))} />
          <label className="field"><span>本次进展描述</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} required placeholder="说明本次完成内容、问题和下一步计划" /></label>
          <label className="upload-field"><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><Upload size={18} /><span><strong>{file ? file.name : '上传进展证据'}</strong><small>支持 JPG、PNG、WebP、PDF，最大 8MB</small></span></label>
          {error && <div className="form-error">{error}</div>}
          <button className="button button-primary button-full" disabled={saving}>{saving ? '正在提交…' : progress === 100 ? '提交并完成闭环' : '保存本次更新'}</button>
        </form>
      )}

      {task.action.type === 'EXPANSION' && task.status !== 'COMPLETED' && (
        <section className="detail-section expansion-launch">
          <div className="expansion-launch-card">
            <div><Factory size={22} /><div><strong>供应商扩产跟踪</strong><small>本措施涉及供应商新增产能，可一键发起扩产计划监控进度与关键事项。</small></div></div>
            <button className="button button-secondary" onClick={onLaunchExpansion}><Factory size={17} />发起供应商扩产跟踪</button>
          </div>
        </section>
      )}

      <section className="detail-section">
        <h4>跟进时间线</h4>
        <div className="timeline">
          {task.updates.map((update) => <div className="timeline-item" key={update.id}><i /><div><div><strong>{update.author.name}</strong><span>更新至 {update.progress}%</span><time>{new Date(update.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></div><p>{update.description}</p></div></div>)}
          <div className="timeline-item"><i /><div><div><strong>系统</strong><span>创建任务</span><time>{new Date(task.startDate).toLocaleDateString('zh-CN')}</time></div><p>措施已确认，任务进入跟进流程。</p></div></div>
        </div>
      </section>

      <section className="detail-section">
        <h4>闭环证据 <span className="section-count">{task.attachments.length}</span></h4>
        <div className="attachment-list">
          {task.attachments.map((attachment) => <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer"><FileText size={20} /><span><strong>{attachment.fileName}</strong><small>{(attachment.size / 1024).toFixed(0)} KB · {new Date(attachment.createdAt).toLocaleDateString('zh-CN')}</small></span></a>)}
          {task.attachments.length === 0 && <div className="attachment-empty"><Paperclip size={18} />暂未上传证据附件</div>}
        </div>
      </section>
    </div>
  )
}