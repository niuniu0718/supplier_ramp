import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { createNotification } from './notificationService.js'

function taskStatus(progress: number, deadline: Date) {
  if (progress >= 100) return 'COMPLETED'
  if (deadline < new Date()) return 'OVERDUE'
  if (progress > 0) return 'IN_PROGRESS'
  return 'NOT_STARTED'
}

export async function updateTaskProgress(input: {
  taskId: string
  progress: number
  description: string
  authorId: string
}) {
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const current = await tx.followTask.findUniqueOrThrow({
      where: { id: input.taskId },
      include: { action: true },
    })
    const status = taskStatus(input.progress, current.deadline)
    const completed = status === 'COMPLETED'

    const task = await tx.followTask.update({
      where: { id: input.taskId },
      data: {
        progress: input.progress,
        progressDescription: input.description,
        status,
        closedAt: completed ? new Date() : null,
        updates: {
          create: {
            progress: input.progress,
            description: input.description,
            authorId: input.authorId,
          },
        },
      },
      include: {
        owner: { select: { id: true, name: true } },
        action: { include: { risk: true } },
        updates: { include: { author: true }, orderBy: { createdAt: 'desc' } },
        attachments: true,
      },
    })

    await tx.action.update({
      where: { id: current.actionId },
      data: {
        completion: input.progress,
        status: completed ? 'COMPLETED' : input.progress > 0 ? 'IN_PROGRESS' : 'NOT_STARTED',
      },
    })

    if (completed) {
      const remaining = await tx.action.count({
        where: { riskId: current.action.riskId, status: { not: 'COMPLETED' } },
      })
      if (remaining === 0) {
        await tx.risk.update({
          where: { id: current.action.riskId },
          data: { status: 'CLOSED', closedAt: new Date() },
        })
      }
    } else {
      await tx.risk.update({
        where: { id: current.action.riskId },
        data: { status: 'IN_PROGRESS', closedAt: null },
      })
    }

    return task
  })

  if (result.status === 'COMPLETED') {
    await createNotification({
      userId: result.ownerId,
      type: 'TASK',
      level: 'GREEN',
      title: `${result.title}已完成闭环`,
      message: '任务进度已达到 100%，关联措施状态已自动更新。',
      link: `/tasks?task=${result.id}`,
    })
  }
  return result
}
