import { useEffect, useMemo, useState } from 'react'
import { Boxes, Factory, ShieldAlert, ShieldCheck } from 'lucide-react'
import { BoardShell } from '../../components/layout/BoardShell'
import { KpiCard } from '../../components/ui/KpiCard'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { ErrorState, LoadingState } from '../../components/ui/States'
import { api } from '../../lib/api'
import type { ExpansionOverviewPayload, ExpansionPlanCard } from '../../types'

const VIEWS = [
  { to: '/board/expansion/view/overview', label: '进度总览' },
  { to: '/board/expansion/view/timeline', label: '里程碑时间轴' },
  { to: '/board/expansion/view/evidence', label: '证据档案' },
]

const CATEGORY_ORDER = ['正极', '负极', '电解液', '隔膜', '添加剂', '其他']
const STATUS_TONE: Record<string, string> = {
  RED: 'var(--red)',
  ORANGE: 'var(--orange)',
  YELLOW: 'var(--yellow)',
  GREEN: 'var(--green)',
}

function groupByCategory(cards: ExpansionPlanCard[]) {
  const groups = new Map<string, ExpansionPlanCard[]>()
  for (const c of cards) {
    const cat = c.supplierCategory || '其他'
    if (!groups.has(cat)) groups.set(cat, [])
    groups.get(cat)!.push(c)
  }
  const ordered: { category: string; cards: ExpansionPlanCard[] }[] = []
  for (const cat of CATEGORY_ORDER) {
    const list = groups.get(cat)
    if (list && list.length) ordered.push({ category: cat, cards: list })
  }
  for (const [cat, list] of groups) {
    if (!CATEGORY_ORDER.includes(cat)) ordered.push({ category: cat, cards: list })
  }
  return ordered
}

export function ExpansionOverview() {
  const [data, setData] = useState<ExpansionOverviewPayload | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<ExpansionOverviewPayload>('/api/boards/expansion/views/overview')
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败。'))
  }, [])

  const grouped = useMemo(() => (data ? groupByCategory(data.cards) : []), [data])

  if (error) return <ErrorState message={error} />
  if (!data) return <LoadingState label="加载扩产总览…" />

  return (
    <BoardShell
      boardId="expansion"
      boardLabel="扩产跟踪"
      title="供应商扩产进度总览"
      description="按物料品类分组的扩产计划进度"
      views={VIEWS}
      kpis={data.kpis.map((k, i) => <KpiCard key={i} kpi={k} icon={[Factory, ShieldCheck, ShieldAlert, ShieldAlert, ShieldAlert, Boxes][i] ?? Factory} />)}
    >
      <div className="category-groups">
        {grouped.map(({ category, cards }) => {
          const worst = cards.reduce((acc, c) => {
            const order = ['GREEN', 'YELLOW', 'ORANGE', 'RED']
            return order.indexOf(c.status) > order.indexOf(acc) ? c.status : acc
          }, 'GREEN' as ExpansionPlanCard['status'])
          const avgProgress = Math.round(cards.reduce((s, c) => s + c.progress, 0) / cards.length)
          return (
            <section key={category} className="category-group">
              <header className="category-group-head">
                <div className="category-group-title">
                  <h2>{category}</h2>
                  <span className="muted">{cards.length} 项计划 · 平均 {avgProgress}%</span>
                </div>
                <span
                  className="evidence-tag"
                  style={{ background: STATUS_TONE[worst], color: '#fff', borderColor: 'transparent' }}
                >
                  最差 {worst}
                </span>
              </header>
              <div className="cards-grid">
                {cards.map((c) => (
                  <article key={c.id} className="plan-card">
                    <header className="plan-card-head">
                      <div>
                        <h3>{c.name}</h3>
                        <small>{c.supplierName} · {c.materialName}</small>
                      </div>
                      <StatusBadge status={c.status} short />
                    </header>
                    <div>
                      <span className="muted">阶段</span>
                      <strong style={{ marginLeft: 8 }}>{c.stage}</strong>
                      <span style={{ marginLeft: 14 }} className="muted">滞后</span>
                      <strong style={{ marginLeft: 4, color: c.lag > 10 ? 'var(--red)' : 'var(--text)' }}>{c.lag}%</strong>
                    </div>
                    <ProgressBar progress={c.progress} expected={c.expectedProgress} />
                    {c.riskTypes.length > 0 && (
                      <div>
                        {c.riskTypes.map((r) => <span key={r} className="evidence-tag" style={{ marginRight: 6 }}>{r}</span>)}
                      </div>
                    )}
                    <small className="muted">更新于 {new Date(c.updatedAt).toLocaleString('zh-CN')}</small>
                  </article>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </BoardShell>
  )
}