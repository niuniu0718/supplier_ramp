import { prisma } from '../../../lib/prisma.js'

export async function getRisksEscalation() {
  const risks = await prisma.risk.findMany({
    include: { material: { include: { supplier: true } }, actions: { include: { task: true } } },
    orderBy: { level: 'desc' },
  })

  const pending = risks.filter((r) => r.status !== 'CLOSED' && r.status !== 'IGNORED' && r.level === 'RED')
  const active = risks.filter((r) => r.status !== 'CLOSED' && r.status !== 'IGNORED' && r.level !== 'RED')
  const closed = risks.filter((r) => r.status === 'CLOSED')

  const toRow = (r: typeof risks[number]) => ({
    id: r.id,
    type: r.type,
    level: r.level,
    status: r.status,
    materialName: r.material.name,
    supplierName: r.material.supplier.shortName,
    description: r.description,
    actions: r.actions.map((a) => ({
      id: a.id,
      type: a.type,
      status: a.status,
      deadline: a.deadline.toISOString(),
      taskId: a.task?.id ?? null,
      taskStatus: a.task?.status ?? null,
      taskProgress: a.task?.progress ?? 0,
    })),
  })

  return {
    board: 'risks',
    view: 'escalation',
    generatedAt: new Date().toISOString(),
    kpis: [
      { label: '待升级', value: pending.length, unit: '项', hint: '红色开放风险', tone: 'red' },
      { label: '已介入', value: active.length, unit: '项', hint: '橙/黄 跟进中', tone: 'orange' },
      { label: '已闭环', value: closed.length, unit: '项', hint: '历史关闭', tone: 'green' },
    ],
    pending: pending.map(toRow),
    active: active.map(toRow),
    closed: closed.map(toRow),
  }
}