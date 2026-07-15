import { prisma } from '../../../lib/prisma.js'
import { daysBetween } from './_utils.js'

export async function getTasksMyTodo(currentUserId?: string) {
  const tasks = await prisma.followTask.findMany({
    where: currentUserId
      ? { ownerId: currentUserId, status: { in: ['NOT_STARTED', 'IN_PROGRESS', 'OVERDUE'] } }
      : { status: { in: ['NOT_STARTED', 'IN_PROGRESS', 'OVERDUE'] } },
    include: {
      owner: true,
      action: { include: { risk: { include: { material: { include: { supplier: true } } } } } },
      attachments: true,
    },
    orderBy: { deadline: 'asc' },
  })

  const now = new Date()
  const rows = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    ownerName: t.owner.name,
    ownerId: t.ownerId,
    progress: t.progress,
    status: t.status,
    deadline: t.deadline.toISOString(),
    startDate: t.startDate.toISOString(),
    daysToDeadline: daysBetween(t.deadline, now),
    riskId: t.action.risk.id,
    riskLevel: t.action.risk.level,
    riskType: t.action.risk.type,
    materialName: t.action.risk.material.name,
    supplierName: t.action.risk.material.supplier.shortName,
    actionType: t.action.type,
    priority: t.action.priority,
    attachmentCount: t.attachments.length,
    progressDescription: t.progressDescription,
  }))

  return {
    board: 'tasks',
    view: 'myTodo',
    generatedAt: new Date().toISOString(),
    kpis: [
      { label: '我的待办', value: rows.length, unit: '项', tone: 'blue' },
      { label: '逾期', value: rows.filter((r) => r.daysToDeadline < 0).length, unit: '项', tone: 'red' },
      { label: '3 天内到期', value: rows.filter((r) => r.daysToDeadline >= 0 && r.daysToDeadline <= 3).length, unit: '项', tone: 'yellow' },
      { label: '已上传证据', value: rows.filter((r) => r.attachmentCount > 0).length, unit: '项', tone: 'green' },
    ],
    rows,
  }
}