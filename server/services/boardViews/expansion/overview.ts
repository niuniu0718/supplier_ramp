import { prisma } from '../../../lib/prisma.js'
import { calculateExpectedProgress, calculateExpansionRisk, riskRank, type RiskLevel } from '../../riskEngine.js'

export interface ExpansionOverviewPlan {
  id: string
  name: string
  supplierId: string
  supplierName: string
  materialName: string
  stage: string
  progress: number
  expectedProgress: number
  status: RiskLevel
  lag: number
  riskTypes: string[]
  updatedAt: string
}

export async function getExpansionOverview() {
  const plans = await prisma.expansionPlan.findMany({
    include: { supplier: true, material: true },
    orderBy: { updatedAt: 'desc' },
  })

  const items: ExpansionOverviewPlan[] = plans.map((p) => {
    const { expectedProgress, status, lag } = calculateExpansionRisk({
      startDate: p.startDate,
      endDate: p.endDate,
      progress: p.progress,
      now: new Date(),
    })
    return {
      id: p.id,
      name: p.name,
      supplierId: p.supplierId,
      supplierName: p.supplier.shortName,
      materialName: p.material.name,
      stage: p.stage,
      progress: p.progress,
      expectedProgress,
      status,
      lag,
      riskTypes: Array.isArray(p.riskTypes) ? (p.riskTypes as string[]) : [],
      updatedAt: p.updatedAt.toISOString(),
    }
  })

  const riskCounts = items.reduce(
    (acc, p) => ({ ...acc, [p.status]: (acc[p.status] ?? 0) + 1 }),
    { RED: 0, ORANGE: 0, YELLOW: 0, GREEN: 0 } as Record<RiskLevel, number>,
  )
  const supplierCount = new Set(items.map((i) => i.supplierId)).size
  const totalCapex = items.reduce((s, i) => s + (plans.find((p) => p.id === i.id)?.totalCapex ?? 0), 0)

  items.sort((a, b) => riskRank[b.status] - riskRank[a.status] || b.lag - a.lag)

  return {
    board: 'expansion',
    view: 'overview',
    generatedAt: new Date().toISOString(),
    kpis: [
      { label: '扩产计划', value: items.length, unit: '项', hint: `${supplierCount} 家供应商`, tone: 'blue' },
      { label: '绿色推进', value: riskCounts.GREEN, unit: '项', hint: '进度正常', tone: 'green' },
      { label: '关注', value: riskCounts.YELLOW, unit: '项', hint: '需观察', tone: 'yellow' },
      { label: '警告', value: riskCounts.ORANGE, unit: '项', hint: '需介入', tone: 'orange' },
      { label: '危险', value: riskCounts.RED, unit: '项', hint: '需升级', tone: 'red' },
      { label: '总投资', value: `${(totalCapex / 10000).toFixed(1)}`, unit: '亿元', hint: 'CAPEX 总预算', tone: 'purple' },
    ],
    cards: items,
  }
}