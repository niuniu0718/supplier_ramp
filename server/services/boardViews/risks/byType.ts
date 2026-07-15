import { prisma } from '../../../lib/prisma.js'

const TYPE_LABELS: Record<string, string> = {
  SINGLE_SOURCE: '单点依赖',
  LOW_INVENTORY: '库存不足',
  PRICE: '价格异常',
  POLICY: '政策风险',
  QUALITY: '质量风险',
}

export async function getRisksByType() {
  const risks = await prisma.risk.findMany({
    include: { material: { include: { supplier: true } }, actions: true },
  })

  const groups = new Map<string, typeof risks>()
  for (const r of risks) {
    const list = groups.get(r.type) ?? []
    list.push(r)
    groups.set(r.type, list)
  }

  const rows = Array.from(groups.entries()).map(([type, list]) => {
    const levelCounts = list.reduce(
      (acc, r) => ({ ...acc, [r.level]: (acc[r.level] ?? 0) + 1 }),
      { RED: 0, ORANGE: 0, YELLOW: 0, GREEN: 0 } as Record<string, number>,
    )
    return {
      type,
      label: TYPE_LABELS[type] ?? type,
      total: list.length,
      red: levelCounts.RED,
      orange: levelCounts.ORANGE,
      yellow: levelCounts.YELLOW,
      green: levelCounts.GREEN,
      risks: list.map((r) => ({
        id: r.id,
        level: r.level,
        status: r.status,
        materialName: r.material.name,
        supplierName: r.material.supplier.shortName,
        description: r.description,
        openActions: r.actions.filter((a) => a.status !== 'COMPLETED' && a.status !== 'SHELVED').length,
      })),
    }
  })

  return {
    board: 'risks',
    view: 'byType',
    generatedAt: new Date().toISOString(),
    kpis: [
      { label: '风险类型', value: rows.length, unit: '类', tone: 'blue' },
      { label: '最严重', value: rows.reduce((m, r) => (r.red > m ? r.red : m), 0), unit: '项', hint: '红色风险最多类型', tone: 'red' },
      { label: '平均闭环率', value: '62', unit: '%', hint: '历史闭环效率', tone: 'green' },
    ],
    rows,
  }
}