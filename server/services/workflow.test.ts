import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../lib/prisma.js'
import { updateTaskProgress } from './workflow.js'

const riskId = 'R_TEST'
const actionId = 'A_TEST'
const taskId = 'T_TEST'

async function cleanup() {
  await prisma.notification.deleteMany({ where: { link: `/tasks?task=${taskId}` } })
  await prisma.taskUpdate.deleteMany({ where: { taskId } })
  await prisma.attachment.deleteMany({ where: { taskId } })
  await prisma.followTask.deleteMany({ where: { id: taskId } })
  await prisma.action.deleteMany({ where: { id: actionId } })
  await prisma.risk.deleteMany({ where: { id: riskId } })
}

describe('task workflow', () => {
  beforeEach(async () => {
    await cleanup()
    await prisma.risk.create({
      data: {
        id: riskId,
        materialId: 'M002',
        type: 'LOW_INVENTORY',
        level: 'ORANGE',
        description: '自动化测试风险',
        impactScope: '测试范围',
        creatorId: 'U_ENGINEER',
        status: 'IN_PROGRESS',
      },
    })
    await prisma.action.create({
      data: {
        id: actionId,
        riskId,
        type: 'STOCK',
        description: '自动化测试措施',
        recommenderId: 'U_MANAGER',
        ownerId: 'U_ENGINEER',
        deadline: new Date(Date.now() + 86_400_000),
        priority: 'P0',
        status: 'IN_PROGRESS',
        completion: 75,
        task: {
          create: {
            id: taskId,
            title: '自动化测试闭环任务',
            ownerId: 'U_ENGINEER',
            startDate: new Date(),
            deadline: new Date(Date.now() + 86_400_000),
            progress: 75,
            status: 'IN_PROGRESS',
          },
        },
      },
    })
  })

  afterEach(cleanup)

  it('进度达到 100% 时自动完成措施并闭环风险', async () => {
    const task = await updateTaskProgress({
      taskId,
      progress: 100,
      description: '所有验收项已经完成。',
      authorId: 'U_ENGINEER',
    })
    const [action, risk] = await Promise.all([
      prisma.action.findUniqueOrThrow({ where: { id: actionId } }),
      prisma.risk.findUniqueOrThrow({ where: { id: riskId } }),
    ])
    expect(task.status).toBe('COMPLETED')
    expect(action.status).toBe('COMPLETED')
    expect(risk.status).toBe('CLOSED')
    expect(risk.closedAt).not.toBeNull()
  })
})
