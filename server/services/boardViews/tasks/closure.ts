import { prisma } from '../../../lib/prisma.js'

export async function getTasksClosure() {
  const tasks = await prisma.followTask.findMany({
    where: { status: 'COMPLETED' },
    include: { owner: true, action: { include: { risk: true } } },
    orderBy: { closedAt: 'desc' },
  })

  const now = new Date()
  const weekStart = new Date(now.getTime() - 7 * 86_400_000)
  const monthStart = new Date(now.getTime() - 30 * 86_400_000)

  const thisWeek = tasks.filter((t) => t.closedAt && t.closedAt >= weekStart)
  const thisMonth = tasks.filter((t) => t.closedAt && t.closedAt >= monthStart)

  const byPriority = new Map<string, { priority: string; count: number }>()
  for (const t of tasks) {
    const p = t.action.priority
    const cur = byPriority.get(p) ?? { priority: p, count: 0 }
    cur.count++
    byPriority.set(p, cur)
  }

  return {
    board: 'tasks',
    view: 'closure',
    generatedAt: now.toISOString(),
    kpis: [
      { label: '本周闭环', value: thisWeek.length, unit: '项', tone: 'green' },
      { label: '本月闭环', value: thisMonth.length, unit: '项', tone: 'blue' },
      { label: '累计闭环', value: tasks.length, unit: '项', tone: 'purple' },
    ],
    rows: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      ownerName: t.owner.name,
      priority: t.action.priority,
      riskType: t.action.risk.type,
      closedAt: t.closedAt?.toISOString() ?? '',
      durationDays: t.closedAt ? Math.floor((t.closedAt.getTime() - t.createdAt.getTime()) / 86_400_000) : 0,
    })),
    byPriority: Array.from(byPriority.values()),
  }
}