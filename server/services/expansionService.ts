import { prisma } from '../lib/prisma.js'
import { createNotification, notifyInternalRoles } from './notificationService.js'
import { calculateExpansionRisk } from './riskEngine.js'

export async function refreshExpansionPlan(planId: string, input: {
  progress?: number
  stage?: string
  riskDescription?: string
}) {
  const current = await prisma.expansionPlan.findUniqueOrThrow({ where: { id: planId } })
  const progress = input.progress ?? current.progress
  const calculation = calculateExpansionRisk({
    startDate: current.startDate,
    endDate: current.endDate,
    progress,
    updatedAt: new Date(),
  })

  const plan = await prisma.expansionPlan.update({
    where: { id: planId },
    data: {
      progress,
      stage: input.stage ?? current.stage,
      riskDescription: input.riskDescription ?? current.riskDescription,
      expectedProgress: calculation.expectedProgress,
      status: calculation.status,
    },
    include: { supplier: true, material: true, items: true, owner: true },
  })

  if (calculation.status !== 'GREEN') {
    await createNotification({
      userId: plan.ownerId,
      type: 'EXPANSION',
      level: calculation.status,
      title: `${plan.name}进度状态已更新`,
      message: `实际进度 ${plan.progress}%，预期进度 ${plan.expectedProgress}%。`,
      link: `/expansion?plan=${plan.id}`,
    })
  }
  if (calculation.status === 'RED') {
    await notifyInternalRoles({
      type: 'EXPANSION',
      level: 'RED',
      title: `${plan.name}触发危险预警`,
      message: `${plan.supplier.shortName}实际进度落后预期 ${calculation.lag} 个百分点。`,
      link: `/expansion?plan=${plan.id}`,
    }, ['PROCUREMENT_MANAGER', 'DEPARTMENT_LEADER'])
  }

  return plan
}
