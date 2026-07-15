// Workflow tests use a dedicated SQLite test DB seeded in-process so they
// don't touch dev.db. Each test creates fresh fixture data via Prisma.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { execSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const TEST_DB_FILE = resolve(process.cwd(), 'prisma/test-workflow.db')
process.env.DATABASE_URL = `file:./test-workflow.db`

// Reset DB before any test imports
if (existsSync(TEST_DB_FILE)) rmSync(TEST_DB_FILE)

const { PrismaClient } = await import('@prisma/client')
const prisma = new PrismaClient()

// Apply schema to test DB
execSync('npx prisma db push --skip-generate --accept-data-loss', {
  cwd: process.cwd(),
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  stdio: 'pipe',
})

const { applyDeadlineEscalations, HttpError, updateTaskProgress } = await import('./workflow.js')

const DAY_MS = 86_400_000
const now = new Date()

async function seedFixtures() {
  await prisma.user.createMany({
    data: [
      { id: 'U_M', name: '经理', role: 'PROCUREMENT_MANAGER', title: '采购经理' },
      { id: 'U_L', name: '领导', role: 'DEPARTMENT_LEADER', title: '部门领导' },
      { id: 'U_E', name: '工程', role: 'ENGINEER', title: '采购工程师' },
    ],
  })

  const supplier = await prisma.supplier.create({
    data: {
      id: 'S_TEST',
      code: 'TST',
      name: 'test supplier',
      shortName: 'TST',
      category: 'CATHODE',
      contact: 'test@test.com',
      location: 'CN',
    },
  })

  const material = await prisma.material.create({
    data: {
      id: 'M_TEST',
      name: 'test material',
      type: 'CATHODE',
      supplierId: supplier.id,
      demandMonthly: 100,
      supplyMonthly: 100,
      inventory: 100,
      safetyStockMonths: 3,
      singleSource: true,
      riskDescription: 'for tests',
      ownerId: 'U_E',
    },
  })

  const risk = await prisma.risk.create({
    data: {
      id: 'R_TEST',
      materialId: material.id,
      type: 'SINGLE_SOURCE',
      level: 'RED',
      impactScope: 'test',
      description: 'for tests',
      creatorId: 'U_M',
      status: 'OPEN',
    },
  })

  const action = await prisma.action.create({
    data: {
      id: 'A_TEST',
      riskId: risk.id,
      type: 'SOURCING',
      description: 'test action',
      recommenderId: 'U_M',
      ownerId: 'U_E',
      startDate: new Date(now.getTime() - 2 * DAY_MS),
      deadline: new Date(now.getTime() + 5 * DAY_MS),
      priority: 'P0',
      status: 'IN_PROGRESS',
    },
  })

  const task = await prisma.followTask.create({
    data: {
      id: 'T_TEST',
      actionId: action.id,
      title: 'test task',
      ownerId: 'U_E',
      startDate: new Date(now.getTime() - 2 * DAY_MS),
      deadline: new Date(now.getTime() + 5 * DAY_MS),
      progress: 30,
      status: 'IN_PROGRESS',
    },
  })

  return { risk, action, task }
}

beforeAll(async () => {
  await prisma.$connect()
})

afterAll(async () => {
  await prisma.$disconnect()
  if (existsSync(TEST_DB_FILE)) rmSync(TEST_DB_FILE)
})

beforeEach(async () => {
  // wipe the entire dependency chain so seedFixtures can re-insert fixtures
  await prisma.notification.deleteMany()
  await prisma.taskUpdate.deleteMany()
  await prisma.attachment.deleteMany()
  await prisma.taskCollaborator.deleteMany()
  await prisma.followTask.deleteMany()
  await prisma.evidenceChain.deleteMany()
  await prisma.expansionItem.deleteMany()
  await prisma.expansionPlan.deleteMany()
  await prisma.action.deleteMany()
  await prisma.risk.deleteMany()
  await prisma.material.deleteMany()
  await prisma.user.deleteMany()
  await prisma.supplier.deleteMany()
})

describe('updateTaskProgress', () => {
  it('throws 422 when setting 100% without attachments', async () => {
    const { task } = await seedFixtures()
    await expect(
      updateTaskProgress({
        taskId: task.id,
        progress: 100,
        description: 'done',
        authorId: 'U_E',
      }),
    ).rejects.toMatchObject({ status: 422, message: expect.stringContaining('证据') })
  })

  it('allows 100% when an attachment exists, closes action + risk', async () => {
    const { task, action, risk } = await seedFixtures()
    await prisma.attachment.create({
      data: {
        taskId: task.id,
        fileName: 'evidence.pdf',
        storedName: 'evidence.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        url: '/uploads/evidence.pdf',
        uploadedById: 'U_E',
      },
    })

    const result = await updateTaskProgress({
      taskId: task.id,
      progress: 100,
      description: 'done',
      authorId: 'U_E',
    })

    expect(result.task.progress).toBe(100)
    expect(result.task.status).toBe('COMPLETED')
    expect(result.action?.status).toBe('COMPLETED')
    expect(result.risk?.status).toBe('CLOSED')
    expect(result.closed).toBe(true)
    const refreshedRisk = await prisma.risk.findUnique({ where: { id: risk.id } })
    expect(refreshedRisk?.status).toBe('CLOSED')
    expect(refreshedRisk?.closedAt).not.toBeNull()
  })

  it('partial progress does not require attachments', async () => {
    const { task } = await seedFixtures()
    const result = await updateTaskProgress({
      taskId: task.id,
      progress: 50,
      description: 'halfway',
      authorId: 'U_E',
    })
    expect(result.task.progress).toBe(50)
    expect(result.task.status).toBe('IN_PROGRESS')
  })
})

describe('applyDeadlineEscalations', () => {
  it('sends YELLOW reminder when deadline is within 3 days', async () => {
    const { task } = await seedFixtures()
    // task.deadline is now + 5 days, set to now + 2 to trigger reminder branch
    await prisma.followTask.update({
      where: { id: task.id },
      data: { deadline: new Date(now.getTime() + 2 * DAY_MS) },
    })

    const result = await applyDeadlineEscalations(now)
    expect(result.yellowed).toBe(1)
    expect(result.oranged).toBe(0)
    expect(result.reddened).toBe(0)

    const notif = await prisma.notification.findFirst({
      where: { type: 'TASK_REMINDER', userId: 'U_E' },
    })
    expect(notif).not.toBeNull()
    expect(notif?.level).toBe('YELLOW')
  })

  it('sends ORANGE overdue CC when 1-6 days overdue', async () => {
    const { task } = await seedFixtures()
    await prisma.followTask.update({
      where: { id: task.id },
      data: { deadline: new Date(now.getTime() - 3 * DAY_MS) },
    })

    const result = await applyDeadlineEscalations(now)
    expect(result.oranged).toBe(1)
    expect(result.reddened).toBe(0)

    const ownerNotif = await prisma.notification.findFirst({
      where: { type: 'TASK_OVERDUE', userId: 'U_E' },
    })
    const managerNotif = await prisma.notification.findFirst({
      where: { type: 'TASK_OVERDUE_CC', userId: 'U_M' },
    })
    expect(ownerNotif).not.toBeNull()
    expect(managerNotif).not.toBeNull()
    expect(ownerNotif?.level).toBe('ORANGE')
  })

  it('escalates to manager + leader and sets OVERDUE when 7+ days overdue', async () => {
    const { task } = await seedFixtures()
    await prisma.followTask.update({
      where: { id: task.id },
      data: { deadline: new Date(now.getTime() - 10 * DAY_MS) },
    })

    const result = await applyDeadlineEscalations(now)
    expect(result.reddened).toBe(1)

    const updated = await prisma.followTask.findUnique({ where: { id: task.id } })
    expect(updated?.status).toBe('OVERDUE')

    const managerNotif = await prisma.notification.findFirst({
      where: { type: 'TASK_RED_ESCALATION', userId: 'U_M' },
    })
    const leaderNotif = await prisma.notification.findFirst({
      where: { type: 'TASK_RED_ESCALATION', userId: 'U_L' },
    })
    expect(managerNotif).not.toBeNull()
    expect(leaderNotif).not.toBeNull()
    expect(managerNotif?.level).toBe('RED')
  })

  it('skips already-completed tasks', async () => {
    const { task } = await seedFixtures()
    await prisma.followTask.update({
      where: { id: task.id },
      data: { status: 'COMPLETED', deadline: new Date(now.getTime() - 10 * DAY_MS) },
    })
    const result = await applyDeadlineEscalations(now)
    expect(result.scanned).toBe(0)
  })
})