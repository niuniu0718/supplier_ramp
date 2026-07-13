import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../lib/asyncHandler.js'
import { prisma } from '../lib/prisma.js'
import { templatesFor } from '../services/actionTemplates.js'
import { nextActionId, nextTaskId } from '../services/idGenerator.js'
import { createNotification } from '../services/notificationService.js'

export const risksRouter = Router()

const actionSchema = z.object({
  type: z.string().min(1),
  description: z.string().min(4),
  ownerId: z.string().min(1),
  deadline: z.coerce.date(),
  priority: z.enum(['P0', 'P1', 'P2']),
  taskTitle: z.string().min(3),
})

risksRouter.get('/templates/:type', (req, res) => {
  res.json(templatesFor(String(req.params.type)))
})

risksRouter.get('/', asyncHandler(async (req, res) => {
  const risks = await prisma.risk.findMany({
    where: {
      ...(req.query.status && req.query.status !== 'ALL' ? { status: String(req.query.status) } : {}),
      ...(req.currentUser?.role === 'SUPPLIER' && req.currentUser.supplierId
        ? { material: { supplierId: req.currentUser.supplierId } }
        : {}),
    },
    include: {
      material: { include: { supplier: true, expansionPlans: true } },
      creator: { select: { id: true, name: true } },
      actions: {
        include: {
          owner: { select: { id: true, name: true, title: true } },
          task: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: [{ discoveredAt: 'desc' }],
  })
  res.json(risks)
}))

risksRouter.get('/:id', asyncHandler(async (req, res) => {
  const risk = await prisma.risk.findUnique({
    where: { id: String(req.params.id) },
    include: {
      material: { include: { supplier: true, expansionPlans: true } },
      creator: true,
      actions: {
        include: { owner: true, recommender: true, task: { include: { updates: true, attachments: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!risk) {
    res.status(404).json({ message: '风险记录不存在。' })
    return
  }
  if (req.currentUser?.role === 'SUPPLIER' && risk.material.supplierId !== req.currentUser.supplierId) {
    res.status(403).json({ message: '无权查看其他供应商风险。' })
    return
  }
  res.json({ ...risk, templates: templatesFor(risk.type) })
}))

risksRouter.post('/:id/actions', asyncHandler(async (req, res) => {
  if (req.currentUser?.role === 'SUPPLIER' || req.currentUser?.role === 'DEPARTMENT_LEADER') {
    res.status(403).json({ message: '当前身份无权创建执行措施。' })
    return
  }
  const data = actionSchema.parse(req.body)
  const [actionId, taskId, risk, owner] = await Promise.all([
    nextActionId(),
    nextTaskId(),
    prisma.risk.findUniqueOrThrow({ where: { id: String(req.params.id) } }),
    prisma.user.findUnique({ where: { id: data.ownerId } }),
  ])
  if (!owner || !['PROCUREMENT_ENGINEER', 'PROCUREMENT_MANAGER'].includes(owner.role)) {
    res.status(400).json({ message: '请选择有效的内部责任人。' })
    return
  }
  const action = await prisma.$transaction(async (tx) => {
    const created = await tx.action.create({
      data: {
        id: actionId,
        riskId: risk.id,
        type: data.type,
        description: data.description,
        recommenderId: req.currentUser!.id,
        ownerId: data.ownerId,
        deadline: data.deadline,
        priority: data.priority,
        status: 'NOT_STARTED',
        task: {
          create: {
            id: taskId,
            title: data.taskTitle,
            ownerId: data.ownerId,
            startDate: new Date(),
            deadline: data.deadline,
            status: 'NOT_STARTED',
          },
        },
      },
      include: { owner: true, task: true },
    })
    await tx.risk.update({
      where: { id: risk.id },
      data: { status: 'ACTION_DEFINED', closedAt: null },
    })
    return created
  })
  await createNotification({
    userId: data.ownerId,
    type: 'TASK',
    level: data.priority === 'P0' ? 'RED' : 'YELLOW',
    title: `新任务：${data.taskTitle}`,
    message: data.description,
    link: `/tasks?task=${taskId}`,
  })
  res.status(201).json(action)
}))
