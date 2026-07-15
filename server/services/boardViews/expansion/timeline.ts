import { prisma } from '../../../lib/prisma.js'
import { calculateExpectedProgress, calculateExpansionRisk, type RiskLevel } from '../../riskEngine.js'

export async function getExpansionTimeline() {
  const plans = await prisma.expansionPlan.findMany({
    include: {
      supplier: true,
      material: true,
      items: { orderBy: { expectedArrival: 'asc' } },
    },
    orderBy: { startDate: 'asc' },
  })

  const rows = plans.map((p) => {
    const { expectedProgress, status, lag } = calculateExpansionRisk({
      startDate: p.startDate,
      endDate: p.endDate,
      progress: p.progress,
      now: new Date(),
    })
    const items = p.items.map((it) => {
      const overdue = !it.actualArrival && new Date() > it.expectedArrival
      const computedDelay = overdue
        ? Math.max(it.delayDays, Math.floor((Date.now() - it.expectedArrival.getTime()) / 86_400_000))
        : it.delayDays
      return {
        id: it.id,
        name: it.name,
        type: it.type,
        vendor: it.vendor,
        orderNo: it.orderNo,
        status: it.status,
        expectedArrival: it.expectedArrival.toISOString(),
        actualArrival: it.actualArrival?.toISOString() ?? null,
        delayDays: computedDelay,
        overdue,
      }
    })
    return {
      id: p.id,
      name: p.name,
      supplierName: p.supplier.shortName,
      materialName: p.material.name,
      startDate: p.startDate.toISOString(),
      endDate: p.endDate.toISOString(),
      stage: p.stage,
      progress: p.progress,
      expectedProgress,
      status: status as RiskLevel,
      lag,
      itemCount: p.items.length,
      overdueCount: items.filter((i) => i.overdue).length,
      items,
    }
  })

  return {
    board: 'expansion',
    view: 'timeline',
    generatedAt: new Date().toISOString(),
    kpis: [
      { label: '计划数量', value: rows.length, unit: '项', tone: 'blue' },
      { label: '里程碑跨度', value: '12', unit: '个月', hint: '最远至 2027Q1', tone: 'green' },
      { label: '已投 CAPEX', value: `${(plans.reduce((s, p) => s + p.investedCapex, 0) / 10000).toFixed(1)}`, unit: '亿元', tone: 'purple' },
      { label: '总 CAPEX', value: `${(plans.reduce((s, p) => s + p.totalCapex, 0) / 10000).toFixed(1)}`, unit: '亿元', tone: 'orange' },
    ],
    rows,
  }
}