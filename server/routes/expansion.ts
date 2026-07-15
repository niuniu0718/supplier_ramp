import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { calculateExpectedProgress, calculateExpansionRisk } from '../services/riskEngine.js'
import { createNotification } from '../services/notifications.js'

export const expansionRouter = Router()

const SUPPLIER_FIELDS = ['progress', 'stage', 'riskDescription'] as const

const fullUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  targetCapacity: z.number().nonnegative().optional(),
  investedCapex: z.number().nonnegative().optional(),
  totalCapex: z.number().nonnegative().optional(),
  fundingSources: z.array(z.string()).optional(),
  stage: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
  riskTypes: z.array(z.string()).optional(),
  riskDescription: z.string().optional(),
  status: z.enum(['GREEN', 'YELLOW', 'ORANGE', 'RED']).optional(),
})

function applySupplierScope(where: { supplierId?: string }, user?: { role: string; supplierId: string | null }) {
  if (user?.role === 'SUPPLIER') {
    if (!user.supplierId) return false
    where.supplierId = user.supplierId
  }
  return true
}

expansionRouter.get('/', async (req, res, next) => {
  try {
    const where: { supplierId?: string } = {}
    if (!applySupplierScope(where, req.currentUser)) {
      res.json({ plans: [] })
      return
    }
    const plans = await prisma.expansionPlan.findMany({
      where,
      include: { supplier: true, material: true, items: true, evidence: true },
      orderBy: { updatedAt: 'desc' },
    })
    const withComputed = plans.map((p) => {
      const { expectedProgress, status, lag } = calculateExpansionRisk({
        startDate: p.startDate,
        endDate: p.endDate,
        progress: p.progress,
        now: new Date(),
      })
      return { ...p, expectedProgress, computedStatus: status, lag }
    })
    res.json({ plans: withComputed })
  } catch (error) {
    next(error)
  }
})

expansionRouter.get('/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id)
    const plan = await prisma.expansionPlan.findUnique({
      where: { id },
      include: {
        supplier: true,
        material: true,
        items: true,
        evidence: { include: { uploadedBy: true }, orderBy: { uploadedAt: 'desc' } },
        owner: true,
      },
    })
    if (!plan) {
      res.status(404).json({ message: '扩产计划不存在。' })
      return
    }
    if (req.currentUser?.role === 'SUPPLIER' && req.currentUser.supplierId !== plan.supplierId) {
      res.status(403).json({ message: '无权查看其他供应商的计划。' })
      return
    }
    const { expectedProgress, status, lag } = calculateExpansionRisk({
      startDate: plan.startDate,
      endDate: plan.endDate,
      progress: plan.progress,
      now: new Date(),
    })
    res.json({ plan: { ...plan, expectedProgress, computedStatus: status, lag } })
  } catch (error) {
    next(error)
  }
})

expansionRouter.post('/', async (req, res, next) => {
  try {
    if (req.currentUser?.role === 'SUPPLIER') {
      res.status(403).json({ message: '供应商不能创建扩产计划。' })
      return
    }
    const schema = z.object({
      materialId: z.string(),
      supplierId: z.string(),
      name: z.string().min(1),
      startDate: z.string(),
      endDate: z.string(),
      targetCapacity: z.number().nonnegative(),
      totalCapex: z.number().nonnegative(),
      fundingSources: z.array(z.string()),
      stage: z.string(),
      progress: z.number().min(0).max(100),
      riskTypes: z.array(z.string()),
      riskDescription: z.string().optional(),
    })
    const data = schema.parse(req.body)
    const id = `P${String(Date.now()).slice(-6)}`
    const startDate = new Date(data.startDate)
    const endDate = new Date(data.endDate)
    const expectedProgress = calculateExpectedProgress(startDate, endDate)
    const { status } = calculateExpansionRisk({ startDate, endDate, progress: data.progress })
    const plan = await prisma.expansionPlan.create({
      data: {
        id,
        materialId: data.materialId,
        supplierId: data.supplierId,
        name: data.name,
        startDate,
        endDate,
        targetCapacity: data.targetCapacity,
        investedCapex: 0,
        totalCapex: data.totalCapex,
        fundingSources: data.fundingSources,
        stage: data.stage,
        progress: data.progress,
        expectedProgress,
        status,
        riskTypes: data.riskTypes,
        riskDescription: data.riskDescription ?? '',
        ownerId: req.currentUser?.id ?? 'U_MANAGER',
      },
    })
    res.json({ plan })
  } catch (error) {
    next(error)
  }
})

expansionRouter.patch('/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id)
    const existing = await prisma.expansionPlan.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ message: '扩产计划不存在。' })
      return
    }

    const isSupplier = req.currentUser?.role === 'SUPPLIER'
    if (isSupplier && req.currentUser?.supplierId !== existing.supplierId) {
      res.status(403).json({ message: '无权修改其他供应商的计划。' })
      return
    }

    const data = fullUpdateSchema.parse(req.body)

    if (isSupplier) {
      const allowed = Object.fromEntries(
        Object.entries(data).filter(([key]) => SUPPLIER_FIELDS.includes(key as typeof SUPPLIER_FIELDS[number])),
      )
      if (Object.keys(allowed).length === 0) {
        res.status(403).json({ message: '供应商只能修改进度 / 阶段 / 风险描述。' })
        return
      }
      Object.assign(data, allowed)
      for (const key of Object.keys(data)) {
        if (!SUPPLIER_FIELDS.includes(key as typeof SUPPLIER_FIELDS[number])) delete (data as Record<string, unknown>)[key]
      }
    }

    const merged = { ...existing, ...data }
    const startDate = data.startDate ? new Date(data.startDate) : existing.startDate
    const endDate = data.endDate ? new Date(data.endDate) : existing.endDate
    const expectedProgress = calculateExpectedProgress(startDate, endDate)
    const { status } = calculateExpansionRisk({
      startDate,
      endDate,
      progress: merged.progress,
    })

    const plan = await prisma.expansionPlan.update({
      where: { id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        expectedProgress,
        status,
      },
    })

    if (isSupplier && data.progress !== undefined && data.progress !== existing.progress) {
      const managers = await prisma.user.findMany({ where: { role: 'PROCUREMENT_MANAGER' } })
      for (const m of managers) {
        await createNotification({
          userId: m.id,
          type: 'EVIDENCE_UPDATE',
          level: status === 'RED' ? 'RED' : status === 'ORANGE' ? 'ORANGE' : 'GREEN',
          title: `扩产计划 ${plan.id} 进度更新`,
          message: `${plan.name} 进度更新至 ${plan.progress}%。`,
          link: `/board/expansion/view/overview?plan=${plan.id}`,
        })
      }
    }

    res.json({ plan: { ...plan, expectedProgress, computedStatus: status } })
  } catch (error) {
    next(error)
  }
})