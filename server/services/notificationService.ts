import { prisma } from '../lib/prisma.js'

interface NotificationInput {
  userId: string
  type: string
  level: string
  title: string
  message: string
  link: string
}

export async function createNotification(input: NotificationInput) {
  return prisma.notification.create({ data: input })
}

export async function notifyInternalRoles(input: Omit<NotificationInput, 'userId'>, roles: string[]) {
  const users = await prisma.user.findMany({
    where: { role: { in: roles } },
    select: { id: true },
  })
  if (users.length === 0) return
  await prisma.notification.createMany({
    data: users.map((user) => ({ ...input, userId: user.id })),
  })
}
