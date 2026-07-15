import { prisma } from '../../../lib/prisma.js'

export async function getRisksClosure() {
  const risks = await prisma.risk.findMany({
    where: { status: 'CLOSED' },
    include: { material: { include: { supplier: true } } },
    orderBy: { closedAt: 'desc' },
  })

  const now = new Date()
  const weekStart = new Date(now.getTime() - 7 * 86_400_000)
  const monthStart = new Date(now.getTime() - 30 * 86_400_000)

  const thisWeek = risks.filter((r) => r.closedAt && r.closedAt >= weekStart)
  const thisMonth = risks.filter((r) => r.closedAt && r.closedAt >= monthStart)

  const avgClosureDays = (() => {
    const valid = risks.filter((r) => r.closedAt)
    if (valid.length === 0) return 0
    const totalDays = valid.reduce(
      (s, r) => s + Math.floor((r.closedAt!.getTime() - r.discoveredAt.getTime()) / 86_400_000),
      0,
    )
    return Math.round(totalDays / valid.length)
  })()

  const byType = new Map<string, { type: string; count: number }>()
  for (const r of risks) {
    const cur = byType.get(r.type) ?? { type: r.type, count: 0 }
    cur.count++
    byType.set(r.type, cur)
  }

  return {
    board: 'risks',
    view: 'closure',
    generatedAt: new Date().toISOString(),
    kpis: [
      { label: '本周闭环', value: thisWeek.length, unit: '项', tone: 'green' },
      { label: '本月闭环', value: thisMonth.length, unit: '项', tone: 'blue' },
      { label: '平均闭环时长', value: avgClosureDays, unit: '天', tone: 'orange' },
      { label: '累计闭环', value: risks.length, unit: '项', tone: 'purple' },
    ],
    rows: risks.map((r) => ({
      id: r.id,
      type: r.type,
      materialName: r.material.name,
      supplierName: r.material.supplier.shortName,
      discoveredAt: r.discoveredAt.toISOString(),
      closedAt: r.closedAt?.toISOString() ?? '',
      durationDays: r.closedAt ? Math.floor((r.closedAt.getTime() - r.discoveredAt.getTime()) / 86_400_000) : 0,
    })),
    byType: Array.from(byType.values()),
  }
}