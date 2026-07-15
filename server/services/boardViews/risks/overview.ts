import { prisma } from '../../../lib/prisma.js'

export async function getRisksOverview() {
  const risks = await prisma.risk.findMany({
    include: { material: { include: { supplier: true } }, actions: true },
    orderBy: [{ status: 'asc' }, { level: 'desc' }, { discoveredAt: 'desc' }],
  })

  const counts = risks.reduce(
    (acc, r) => ({ ...acc, [r.level]: (acc[r.level] ?? 0) + 1 }),
    { RED: 0, ORANGE: 0, YELLOW: 0, GREEN: 0 } as Record<string, number>,
  )

  const openCount = risks.filter((r) => r.status !== 'CLOSED' && r.status !== 'IGNORED').length

  const rows = risks.map((r) => ({
    id: r.id,
    type: r.type,
    level: r.level,
    status: r.status,
    description: r.description,
    impactScope: r.impactScope,
    materialName: r.material.name,
    supplierName: r.material.supplier.shortName,
    actionCount: r.actions.length,
    openActionCount: r.actions.filter((a) => a.status !== 'COMPLETED' && a.status !== 'SHELVED').length,
    discoveredAt: r.discoveredAt.toISOString(),
  }))

  return {
    board: 'risks',
    view: 'overview',
    generatedAt: new Date().toISOString(),
    kpis: [
      { label: '总风险', value: risks.length, unit: '项', tone: 'blue' },
      { label: '开放中', value: openCount, unit: '项', hint: '待处理 / 跟进中', tone: 'orange' },
      { label: '红色', value: counts.RED, unit: '项', hint: '需立即升级', tone: 'red' },
      { label: '橙色', value: counts.ORANGE, unit: '项', hint: '需介入', tone: 'orange' },
      { label: '黄色', value: counts.YELLOW, unit: '项', hint: '需关注', tone: 'yellow' },
      { label: '绿色', value: counts.GREEN, unit: '项', hint: '已闭环', tone: 'green' },
    ],
    rows,
  }
}