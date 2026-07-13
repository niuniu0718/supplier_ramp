import { Router } from 'express'
import { asyncHandler } from '../lib/asyncHandler.js'
import { prisma } from '../lib/prisma.js'
import { riskRank, type RiskLevel } from '../services/riskEngine.js'

export const dashboardRouter = Router()

dashboardRouter.get('/', asyncHandler(async (req, res) => {
  const supplierFilter = req.currentUser?.role === 'SUPPLIER' && req.currentUser.supplierId
    ? { supplierId: req.currentUser.supplierId }
    : {}
  const taskFilter = req.currentUser?.role === 'PROCUREMENT_ENGINEER'
    ? { ownerId: req.currentUser.id }
    : {}

  const [materials, snapshots, risks, tasks, plans] = await Promise.all([
    prisma.material.findMany({
      where: supplierFilter,
      include: {
        supplier: true,
        risks: { include: { actions: true }, orderBy: { discoveredAt: 'desc' } },
        expansionPlans: { select: { id: true, name: true, status: true, progress: true } },
      },
      orderBy: { id: 'asc' },
    }),
    prisma.healthSnapshot.findMany({
      where: req.currentUser?.role === 'SUPPLIER' && req.currentUser.supplierId
        ? { material: { supplierId: req.currentUser.supplierId } }
        : {},
      orderBy: { weekDate: 'asc' },
    }),
    prisma.risk.findMany({
      where: {
        status: { notIn: ['CLOSED', 'IGNORED'] },
        ...(req.currentUser?.role === 'SUPPLIER' && req.currentUser.supplierId
          ? { material: { supplierId: req.currentUser.supplierId } }
          : {}),
      },
      include: { material: { include: { supplier: true } }, actions: true },
    }),
    prisma.followTask.findMany({ where: taskFilter }),
    prisma.expansionPlan.findMany({ where: supplierFilter }),
  ])

  const riskCounts: Record<RiskLevel, number> = { GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 }
  const typeMap = new Map<string, Record<RiskLevel, number>>()
  for (const material of materials) {
    riskCounts[material.riskLevel as RiskLevel] += 1
    const row = typeMap.get(material.type) ?? { GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 }
    row[material.riskLevel as RiskLevel] += 1
    typeMap.set(material.type, row)
  }

  const trendMap = new Map<string, { total: number; count: number; date: Date }>()
  for (const snapshot of snapshots) {
    const row = trendMap.get(snapshot.weekLabel) ?? { total: 0, count: 0, date: snapshot.weekDate }
    row.total += snapshot.score
    row.count += 1
    trendMap.set(snapshot.weekLabel, row)
  }

  const materialRows = materials.map((material) => ({
    ...material,
    supplyGap: material.demandMonthly - material.supplyMonthly,
    gapRatio: material.demandMonthly > 0
      ? (material.demandMonthly - material.supplyMonthly) / material.demandMonthly
      : 0,
    actionCount: material.risks.reduce((sum, risk) => sum + risk.actions.length, 0),
  }))

  res.json({
    summary: {
      materialCount: materials.length,
      supplierCount: new Set(materials.map((item) => item.supplierId)).size,
      demandTotal: materials.reduce((sum, item) => sum + item.demandMonthly, 0),
      supplyTotal: materials.reduce((sum, item) => sum + item.supplyMonthly, 0),
      openRiskCount: risks.length,
      activeTaskCount: tasks.filter((task) => task.status !== 'COMPLETED').length,
      overdueTaskCount: tasks.filter((task) => task.status !== 'COMPLETED' && task.deadline < new Date()).length,
      expansionPlanCount: plans.length,
      expansionRiskCount: plans.filter((plan) => ['ORANGE', 'RED'].includes(plan.status)).length,
    },
    riskCounts,
    typeDistribution: Array.from(typeMap, ([type, counts]) => ({ type, ...counts })),
    healthTrend: Array.from(trendMap, ([week, row]) => ({
      week,
      score: Math.round(row.total / row.count),
      date: row.date,
    })),
    gapAnalysis: materialRows
      .map((material) => ({ id: material.id, name: material.name, type: material.type, gap: material.supplyGap }))
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 7),
    topRisks: [...materialRows]
      .sort((a, b) => riskRank[b.riskLevel as RiskLevel] - riskRank[a.riskLevel as RiskLevel] || b.gapRatio - a.gapRatio)
      .slice(0, 10),
    materials: materialRows,
  })
}))
