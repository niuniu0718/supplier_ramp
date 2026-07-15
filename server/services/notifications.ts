import { prisma } from '../lib/prisma.js'

export async function createNotification(input: {
  userId: string
  type: string
  level: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED'
  title: string
  message: string
  link: string
}) {
  return prisma.notification.create({ data: input })
}

export async function notifyInternalRoles(input: {
  role: 'PROCUREMENT_MANAGER' | 'DEPARTMENT_LEADER'
  type: string
  level: 'YELLOW' | 'ORANGE' | 'RED'
  title: string
  message: string
  link: string
}) {
  const users = await prisma.user.findMany({ where: { role: input.role } })
  if (users.length === 0) return []
  return prisma.$transaction(
    users.map((u) =>
      prisma.notification.create({
        data: {
          userId: u.id,
          type: input.type,
          level: input.level,
          title: input.title,
          message: input.message,
          link: input.link,
        },
      }),
    ),
  )
}