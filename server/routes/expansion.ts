import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../lib/asyncHandler.js'
import { prisma } from '../lib/prisma.js'
import { refreshExpansionPlan } from '../services/expansionService.js'
import { calculateExpansionRisk } from '../services/riskEngine.js'
import { nextPlanId } from '../services/idGenerator.js'

export const expansionRouter = Router()

function serializePlan<T extends { fundingSources: string; riskTypes: string; startDate: Date; endDate: Date; progress: number; updatedAt: Date }>(plan: T) {
  const calculation = calculateExpansionRisk(plan)
  return {
    ...plan,
    expectedProgress: calculation.expectedProgress,
    status: calculation.status,
    lag: calculation.lag,
    fundingSources: plan.fundingSources ? plan.fundingSources.split(',') : [],
    riskTypes: plan.riskTypes ? plan.riskTypes.split(',') : [],
  }
}

expansionRouter.get('/', asyncHandler(async (req, res) => {
  const plans = await prisma.expansionPlan.findMany({
    where: req.currentUser?.role === 'SUPPLIER' && req.currentUser.supplierId
      ? { supplierId: req.currentUser.supplierId }
      : {},
    include: {
      supplier: true,
      material: true,
      owner: { select: { id: true, name: true, title: true } },
      items: { orderBy: { expectedArrival: 'asc' } },
    },
    orderBy: { endDate: 'asc' },
  })
  res.json(plans.map(serializePlan))
}))

const createPlanSchema = z.object({
  materialId: z.string().min(1),
  name: z.string().min(2),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  targetCapacity: z.coerce.number().positive(),
  totalCapex: z.coerce.number().nonnegative(),
  investedCapex: z.coerce.number().nonnegative().optional().default(0),
  fundingSources: z.array(z.string()).optional().default([]),
  stage: z.enum(['设计', '采购设备', '安装', '调试', '投产']).optional().default('设计'),
  progress: z.coerce.number().int().min(0).max(100).optional().default(0),
  riskDescription: z.string().min(2).optional().default('来自风险措施触发的扩产跟踪'),
})

expansionRouter.post('/', asyncHandler(async (req, res) => {
  if (req.currentUser?.role === 'DEPARTMENT_LEADER') {
    res.status(403).json({ message: '部门领导身份为只读。' })
    return
  }
  const data = createPlanSchema.parse(req.body)
  const material = await prisma.material.findUnique({ where: { id: data.materialId } })
  if (!material) {
    res.status(404).json({ message: '物料不存在，无法创建扩产计划。' })
    return
  }
  const planId = await nextPlanId()
  const calculation = calculateExpansionRisk({
    startDate: data.startDate,
    endDate: data.endDate,
    progress: data.progress,
    updatedAt: new Date(),
  })
  const plan = await prisma.expansionPlan.create({
    data: {
      id: planId,
      materialId: material.id,
      supplierId: material.supplierId,
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      targetCapacity: data.targetCapacity,
      investedCapex: data.investedCapex ?? 0,
      totalCapex: data.totalCapex,
      fundingSources: (data.fundingSources ?? []).join(','),
      stage: data.stage ?? '设计',
      progress: data.progress ?? 0,
      expectedProgress: calculation.expectedProgress,
      status: calculation.status,
      riskTypes: '',
      riskDescription: data.riskDescription ?? '',
      ownerId: req.currentUser?.role === 'SUPPLIER' && req.currentUser.supplierId === material.supplierId
        ? req.currentUser.id
        : material.ownerId,
    },
    include: { supplier: true, material: true, owner: { select: { id: true, name: true, title: true } }, items: true },
  })
  res.status(201).json(serializePlan(plan))
}))

expansionRouter.get('/:id', asyncHandler(async (req, res) => {
  const plan = await prisma.expansionPlan.findUnique({
    where: { id: String(req.params.id) },
    include: { supplier: true, material: true, owner: true, items: { orderBy: { expectedArrival: 'asc' } } },
  })
  if (!plan) {
    res.status(404).json({ message: '扩产计划不存在。' })
    return
  }
  if (req.currentUser?.role === 'SUPPLIER' && plan.supplierId !== req.currentUser.supplierId) {
    res.status(403).json({ message: '无权查看其他供应商扩产计划。' })
    return
  }
  res.json(serializePlan(plan))
}))

expansionRouter.patch('/:id', asyncHandler(async (req, res) => {
  const input = z.object({
    progress: z.coerce.number().int().min(0).max(100).optional(),
    stage: z.enum(['设计', '采购设备', '安装', '调试', '投产']).optional(),
    riskDescription: z.string().min(2).optional(),
  }).parse(req.body)
  const current = await prisma.expansionPlan.findUniqueOrThrow({ where: { id: String(req.params.id) } })
  if (req.currentUser?.role === 'DEPARTMENT_LEADER') {
    res.status(403).json({ message: '部门领导身份为只读。' })
    return
  }
  if (req.currentUser?.role === 'SUPPLIER' && current.supplierId !== req.currentUser.supplierId) {
    res.status(403).json({ message: '只能更新本供应商的扩产计划。' })
    return
  }
  res.json(serializePlan(await refreshExpansionPlan(current.id, input)))
}))
