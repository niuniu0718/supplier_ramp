import type { Action, FollowTask, Risk } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { createNotification, notifyInternalRoles } from './notifications.js'

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const DAY_MS = 86_400_000

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / DAY_MS)
}

export interface EscalationResult {
  scanned: number
  yellowed: number
  oranged: number
  reddened: number
}

export async function applyDeadlineEscalations(now = new Date()): Promise<EscalationResult> {
  const tasks = await prisma.followTask.findMany({
    where: { status: { in: ['NOT_STARTED', 'IN_PROGRESS'] } },
    include: { action: { include: { risk: { include: { material: true } } } }, owner: true },
  })

  const result: EscalationResult = { scanned: tasks.length, yellowed: 0, oranged: 0, reddened: 0 }

  for (const task of tasks) {
    const dueIn = daysBetween(task.deadline, now)
    const overdueBy = -dueIn

    if (overdueBy >= 7) {
      const alreadySent = await prisma.notification.findFirst({
        where: { type: 'TASK_RED_ESCALATION', link: { contains: task.id }, createdAt: { gte: new Date(now.getTime() - 6 * DAY_MS) } },
      })
      if (!alreadySent) {
        await notifyInternalRoles({
          role: 'PROCUREMENT_MANAGER',
          type: 'TASK_RED_ESCALATION',
          level: 'RED',
          title: `任务 ${task.id} 升级至采购经理`,
          message: `${task.title} 已逾期 ${overdueBy} 天，请介入协调。`,
          link: `/board/tasks/view/escalation?task=${task.id}`,
        })
        await notifyInternalRoles({
          role: 'DEPARTMENT_LEADER',
          type: 'TASK_RED_ESCALATION',
          level: 'RED',
          title: `任务 ${task.id} 升级至部门领导`,
          message: `${task.title} 逾期 ${overdueBy} 天，请知悉。`,
          link: `/board/tasks/view/escalation?task=${task.id}`,
        })
        await prisma.followTask.update({ where: { id: task.id }, data: { status: 'OVERDUE' } })
        result.reddened++
      }
      continue
    }

    if (overdueBy >= 1) {
      const alreadySent = await prisma.notification.findFirst({
        where: { type: 'TASK_OVERDUE', link: { contains: task.id }, createdAt: { gte: new Date(now.getTime() - 3 * DAY_MS) } },
      })
      if (!alreadySent) {
        await createNotification({
          userId: task.ownerId,
          type: 'TASK_OVERDUE',
          level: 'ORANGE',
          title: `任务 ${task.id} 已逾期`,
          message: `${task.title} 逾期 ${overdueBy} 天，请尽快推进。`,
          link: `/board/tasks/view/overdue?task=${task.id}`,
        })
        await notifyInternalRoles({
          role: 'PROCUREMENT_MANAGER',
          type: 'TASK_OVERDUE_CC',
          level: 'ORANGE',
          title: `任务 ${task.id} 抄送`,
          message: `${task.title} 逾期 ${overdueBy} 天，已抄送。`,
          link: `/board/tasks/view/overdue?task=${task.id}`,
        })
        result.oranged++
      }
      continue
    }

    if (dueIn >= 0 && dueIn <= 3) {
      const alreadySent = await prisma.notification.findFirst({
        where: { type: 'TASK_REMINDER', link: { contains: task.id }, createdAt: { gte: new Date(now.getTime() - DAY_MS) } },
      })
      if (!alreadySent) {
        await createNotification({
          userId: task.ownerId,
          type: 'TASK_REMINDER',
          level: 'YELLOW',
          title: `任务 ${task.id} 即将到期`,
          message: `${task.title} 还剩 ${dueIn} 天到期。`,
          link: `/board/tasks/view/my-todo?task=${task.id}`,
        })
        result.yellowed++
      }
    }
  }

  return result
}

export interface ProgressUpdateInput {
  taskId: string
  progress: number
  description: string
  authorId: string
}

export interface ProgressUpdateResult {
  task: FollowTask
  action: Action | null
  risk: Risk | null
  closed: boolean
}

export async function updateTaskProgress(input: ProgressUpdateInput): Promise<ProgressUpdateResult> {
  const task = await prisma.followTask.findUnique({
    where: { id: input.taskId },
    include: { action: { include: { risk: { include: { actions: { include: { task: true } } } } } }, attachments: true },
  })
  if (!task) throw new HttpError(404, '任务不存在。')

  if (input.progress === 100 && task.attachments.length === 0) {
    throw new HttpError(422, '进度更新至 100% 需先上传至少 1 份证据（附件）。')
  }

  const nextStatus =
    input.progress === 100
      ? 'COMPLETED'
      : task.status === 'NOT_STARTED'
        ? 'IN_PROGRESS'
        : task.status

  const [updatedTask] = await prisma.$transaction([
    prisma.followTask.update({
      where: { id: task.id },
      data: {
        progress: input.progress,
        status: nextStatus,
        progressDescription: input.description,
        closedAt: input.progress === 100 ? new Date() : task.closedAt,
      },
    }),
    prisma.taskUpdate.create({
      data: {
        taskId: task.id,
        progress: input.progress,
        description: input.description,
        authorId: input.authorId,
      },
    }),
  ])

  let closedAction: Action | null = null
  let closedRisk: Risk | null = null
  let closed = false

  if (input.progress === 100) {
    closedAction = await prisma.action.update({
      where: { id: task.actionId },
      data: { status: 'COMPLETED', completion: 100 },
    })

    const openActions = task.action.risk.actions.filter(
      (a) => a.id !== task.actionId && a.status !== 'COMPLETED' && a.status !== 'SHELVED',
    )
    if (openActions.length === 0) {
      closedRisk = await prisma.risk.update({
        where: { id: task.action.risk.id },
        data: { status: 'CLOSED', closedAt: new Date() },
      })
      closed = true
    }
  }

  return { task: updatedTask, action: closedAction, risk: closedRisk, closed }
}