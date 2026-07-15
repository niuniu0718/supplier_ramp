import { prisma } from '../../../lib/prisma.js'
import { escalationLevel } from './_utils.js'

export async function getTasksEscalation() {
  const tasks = await prisma.followTask.findMany({
    where: { status: { in: ['NOT_STARTED', 'IN_PROGRESS', 'OVERDUE'] } },
    include: {
      owner: true,
      action: { include: { risk: { include: { material: { include: { supplier: true } } } } } },
      attachments: true,
    },
  })

  const now = new Date()
  const remind: typeof tasks = []
  const overdue: typeof tasks = []
  const escalated: typeof tasks = []

  for (const t of tasks) {
    const { level } = escalationLevel(t.deadline, now)
    if (level === 'ESCALATED') escalated.push(t)
    else if (level === 'OVERDUE') overdue.push(t)
    else if (level === 'REMIND') remind.push(t)
  }

  const toRow = (t: typeof tasks[number]) => ({
    id: t.id,
    title: t.title,
    ownerName: t.owner.name,
    progress: t.progress,
    status: t.status,
    deadline: t.deadline.toISOString(),
    daysToDeadline: Math.floor((t.deadline.getTime() - now.getTime()) / 86_400_000),
    riskLevel: t.action.risk.level,
    riskType: t.action.risk.type,
    materialName: t.action.risk.material.name,
    supplierName: t.action.risk.material.supplier.shortName,
    priority: t.action.priority,
    attachmentCount: t.attachments.length,
  })

  return {
    board: 'tasks',
    view: 'escalation',
    generatedAt: now.toISOString(),
    kpis: [
      { label: '3 天内到期', value: remind.length, unit: '项', hint: '黄灯提醒', tone: 'yellow' },
      { label: '已逾期', value: overdue.length, unit: '项', hint: '抄送采购经理', tone: 'orange' },
      { label: '逾期 ≥ 7 天', value: escalated.length, unit: '项', hint: '升级至部门领导', tone: 'red' },
    ],
    remind: remind.map(toRow),
    overdue: overdue.map(toRow),
    escalated: escalated.map(toRow),
  }
}