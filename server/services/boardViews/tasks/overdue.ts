import { prisma } from '../../../lib/prisma.js'
import { daysBetween } from './_utils.js'

export async function getTasksOverdue() {
  const now = new Date()
  const tasks = await prisma.followTask.findMany({
    where: { status: { in: ['IN_PROGRESS', 'OVERDUE', 'NOT_STARTED'] } },
    include: {
      owner: true,
      action: { include: { risk: { include: { material: { include: { supplier: true } } } } } },
      attachments: true,
    },
  })

  const overdue = tasks
    .map((t) => ({
      id: t.id,
      title: t.title,
      ownerName: t.owner.name,
      progress: t.progress,
      status: t.status,
      deadline: t.deadline.toISOString(),
      daysOverdue: -daysBetween(t.deadline, now),
      riskLevel: t.action.risk.level,
      riskType: t.action.risk.type,
      materialName: t.action.risk.material.name,
      supplierName: t.action.risk.material.supplier.shortName,
      priority: t.action.priority,
      attachmentCount: t.attachments.length,
    }))
    .filter((t) => t.daysOverdue > 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue)

  return {
    board: 'tasks',
    view: 'overdue',
    generatedAt: new Date().toISOString(),
    kpis: [
      { label: '逾期任务', value: overdue.length, unit: '项', tone: 'red' },
      { label: '逾期 ≥ 7 天', value: overdue.filter((t) => t.daysOverdue >= 7).length, unit: '项', hint: '已升级', tone: 'red' },
      { label: '逾期 < 7 天', value: overdue.filter((t) => t.daysOverdue < 7).length, unit: '项', hint: '可补救', tone: 'orange' },
    ],
    rows: overdue,
  }
}