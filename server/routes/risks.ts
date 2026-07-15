import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { templatesFor } from '../services/actionTemplates.js'

export const risksRouter = Router()

risksRouter.get('/', async (_req, res, next) => {
  try {
    const risks = await prisma.risk.findMany({
      include: { material: { include: { supplier: true } }, actions: { include: { owner: true, task: true } } },
      orderBy: { level: 'desc' },
    })
    res.json({ risks })
  } catch (error) {
    next(error)
  }
})

risksRouter.get('/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id)
    const risk = await prisma.risk.findUnique({
      where: { id },
      include: {
        material: { include: { supplier: true } },
        actions: { include: { owner: true, recommender: true, task: { include: { attachments: true, updates: true } } } },
      },
    })
    if (!risk) {
      res.status(404).json({ message: '风险不存在。' })
      return
    }
    res.json({ risk })
  } catch (error) {
    next(error)
  }
})

risksRouter.get('/templates/:type', (req, res) => {
  const type = String(req.params.type)
  res.json({ templates: templatesFor(type) })
})

risksRouter.post('/:id/actions', async (req, res, next) => {
  try {
    if (req.currentUser?.role === 'SUPPLIER') {
      res.status(403).json({ message: '供应商不能创建措施。' })
      return
    }
    const riskId = String(req.params.id)
    const risk = await prisma.risk.findUnique({ where: { id: riskId } })
    if (!risk) {
      res.status(404).json({ message: '风险不存在。' })
      return
    }
    const schema = z.object({
      type: z.string(),
      description: z.string().min(1),
      ownerId: z.string(),
      deadline: z.string(),
      priority: z.enum(['P0', 'P1', 'P2']).default('P1'),
      startDate: z.string().optional(),
    })
    const data = schema.parse(req.body)
    const actionId = `A${String(Date.now()).slice(-6)}`
    const taskId = `T${String(Date.now()).slice(-6)}`
    const recommenderId = req.currentUser?.id ?? 'U_MANAGER'

    const action = await prisma.$transaction(async (tx) => {
      const a = await tx.action.create({
        data: {
          id: actionId,
          riskId,
          type: data.type,
          description: data.description,
          recommenderId,
          ownerId: data.ownerId,
          startDate: data.startDate ? new Date(data.startDate) : new Date(),
          deadline: new Date(data.deadline),
          priority: data.priority,
          status: 'NOT_STARTED',
          completion: 0,
        },
      })
      await tx.followTask.create({
        data: {
          id: taskId,
          actionId: a.id,
          title: data.description,
          ownerId: data.ownerId,
          startDate: data.startDate ? new Date(data.startDate) : new Date(),
          deadline: new Date(data.deadline),
          progress: 0,
          status: 'NOT_STARTED',
        },
      })
      await tx.risk.update({ where: { id: riskId }, data: { status: 'IN_PROGRESS' } })
      return a
    })
    res.json({ action })
  } catch (error) {
    next(error)
  }
})

risksRouter.post('/', async (req, res, next) => {
  try {
    if (req.currentUser?.role === 'SUPPLIER') {
      res.status(403).json({ message: '供应商不能创建风险。' })
      return
    }
    const schema = z.object({
      materialId: z.string(),
      type: z.string(),
      level: z.enum(['GREEN', 'YELLOW', 'ORANGE', 'RED']),
      description: z.string().min(1),
      impactScope: z.string().default(''),
    })
    const data = schema.parse(req.body)
    const id = `R${String(Date.now()).slice(-6)}`
    const creatorId = req.currentUser?.id ?? 'U_MANAGER'
    const risk = await prisma.risk.create({
      data: {
        id,
        materialId: data.materialId,
        type: data.type,
        level: data.level,
        description: data.description,
        impactScope: data.impactScope,
        creatorId,
        status: 'PENDING',
      },
    })
    res.json({ risk })
  } catch (error) {
    next(error)
  }
})

risksRouter.patch('/:id', async (req, res, next) => {
  try {
    if (req.currentUser?.role === 'SUPPLIER') {
      res.status(403).json({ message: '供应商不能修改风险。' })
      return
    }
    const id = String(req.params.id)
    const schema = z.object({
      level: z.enum(['GREEN', 'YELLOW', 'ORANGE', 'RED']).optional(),
      description: z.string().optional(),
      impactScope: z.string().optional(),
      status: z.enum(['PENDING', 'IN_PROGRESS', 'CLOSED', 'IGNORED']).optional(),
    })
    const data = schema.parse(req.body)
    const risk = await prisma.risk.update({
      where: { id },
      data: {
        ...data,
        closedAt: data.status === 'CLOSED' ? new Date() : undefined,
      },
    })
    res.json({ risk })
  } catch (error) {
    next(error)
  }
})