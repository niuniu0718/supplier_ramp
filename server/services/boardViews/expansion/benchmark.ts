import { prisma } from '../../../lib/prisma.js'
import { calculateExpansionRisk, type RiskLevel } from '../../riskEngine.js'

export async function getExpansionBenchmark() {
  const plans = await prisma.expansionPlan.findMany({
    include: { supplier: true, material: true, items: true },
    orderBy: { supplier: { shortName: 'asc' } },
  })

  const bySupplier = new Map<string, {
    supplierId: string
    supplierName: string
    category: string
    plans: typeof plans
    totalProgress: number
    totalExpected: number
    totalCapex: number
    investedCapex: number
    riskCount: number
    redCount: number
    orangeCount: number
    itemTotal: number
  }>()

  for (const p of plans) {
    const { expectedProgress, status } = calculateExpansionRisk({
      startDate: p.startDate,
      endDate: p.endDate,
      progress: p.progress,
      now: new Date(),
    })
    const cur = bySupplier.get(p.supplierId) ?? {
      supplierId: p.supplierId,
      supplierName: p.supplier.shortName,
      category: p.supplier.category,
      plans: [],
      totalProgress: 0,
      totalExpected: 0,
      totalCapex: 0,
      investedCapex: 0,
      riskCount: 0,
      redCount: 0,
      orangeCount: 0,
      itemTotal: 0,
    }
    cur.plans = [...cur.plans, p]
    cur.totalProgress += p.progress
    cur.totalExpected += expectedProgress
    cur.totalCapex += p.totalCapex
    cur.investedCapex += p.investedCapex
    if (status === 'RED') cur.redCount++
    if (status === 'ORANGE') cur.orangeCount++
    if (status !== 'GREEN') cur.riskCount++
    cur.itemTotal += p.items.length
    bySupplier.set(p.supplierId, cur)
  }

  const rows = Array.from(bySupplier.values()).map((g) => ({
    supplierId: g.supplierId,
    supplierName: g.supplierName,
    category: g.category,
    planCount: g.plans.length,
    avgProgress: g.plans.length ? Math.round(g.totalProgress / g.plans.length) : 0,
    avgExpected: g.plans.length ? Math.round(g.totalExpected / g.plans.length) : 0,
    totalCapex: g.totalCapex,
    investedCapex: g.investedCapex,
    investRatio: g.totalCapex ? Math.round((g.investedCapex / g.totalCapex) * 100) : 0,
    riskCount: g.riskCount,
    redCount: g.redCount,
    orangeCount: g.orangeCount,
    itemTotal: g.itemTotal,
    worstStatus: (g.redCount > 0 ? 'RED' : g.orangeCount > 0 ? 'ORANGE' : 'GREEN') as RiskLevel,
  }))

  return {
    board: 'expansion',
    view: 'benchmark',
    generatedAt: new Date().toISOString(),
    kpis: [
      { label: '供应商', value: rows.length, unit: '家', tone: 'blue' },
      { label: '对比维度', value: '6', unit: '项', hint: '进度/CAPEX/风险/设备', tone: 'green' },
      { label: '高风险供应商', value: rows.filter((r) => r.worstStatus !== 'GREEN').length, unit: '家', hint: '红或橙', tone: 'red' },
    ],
    rows,
  }
}