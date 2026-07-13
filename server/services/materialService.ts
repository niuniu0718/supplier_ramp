import { prisma } from '../lib/prisma.js'
import { nextRiskId } from './idGenerator.js'
import { createNotification, notifyInternalRoles } from './notificationService.js'
import { calculateMaterialRisk } from './riskEngine.js'

function inferRiskType(material: {
  singleSource: boolean
  safetyStockMonths: number
  demandMonthly: number
  supplyMonthly: number
  inventory: number
}) {
  if (material.singleSource) return 'SINGLE_SOURCE'
  if (material.inventory < material.demandMonthly || material.supplyMonthly < material.demandMonthly) {
    return 'LOW_INVENTORY'
  }
  return 'OTHER'
}

export async function recalculateMaterialRisk(materialId: string) {
  const material = await prisma.material.findUniqueOrThrow({
    where: { id: materialId },
  })
  const level = calculateMaterialRisk(material)
  await prisma.material.update({ where: { id: material.id }, data: { riskLevel: level } })

  const openRisk = await prisma.risk.findFirst({
    where: { materialId, isAuto: true, status: { notIn: ['CLOSED', 'IGNORED'] } },
    orderBy: { discoveredAt: 'desc' },
  })

  if (level === 'GREEN') {
    if (openRisk) {
      await prisma.risk.update({
        where: { id: openRisk.id },
        data: { status: 'CLOSED', closedAt: new Date() },
      })
    }
    return level
  }

  const type = inferRiskType(material)
  const description = material.riskDescription || `${material.name}触发${level}级自动风险预警。`
  let riskId = openRisk?.id
  if (openRisk) {
    await prisma.risk.update({
      where: { id: openRisk.id },
      data: { type, level, description },
    })
  } else {
    riskId = await nextRiskId()
    await prisma.risk.create({
      data: {
        id: riskId,
        materialId,
        type,
        level,
        description,
        impactScope: '待采购工程师评估',
        creatorId: material.ownerId,
        status: 'PENDING',
        isAuto: true,
      },
    })
  }

  await createNotification({
    userId: material.ownerId,
    type: 'RISK',
    level,
    title: `${material.name}触发风险预警`,
    message: description,
    link: `/risks?risk=${riskId}`,
  })
  if (level === 'RED') {
    await notifyInternalRoles({
      type: 'RISK',
      level,
      title: `${material.name}触发危险预警`,
      message: description,
      link: `/risks?risk=${riskId}`,
    }, ['PROCUREMENT_MANAGER', 'DEPARTMENT_LEADER'])
  }
  return level
}
