import { Router } from 'express'
import { asyncHandler } from '../lib/asyncHandler.js'
import { prisma } from '../lib/prisma.js'

export const notificationsRouter = Router()

notificationsRouter.get('/', asyncHandler(async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.currentUser!.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  res.json({
    unreadCount: notifications.filter((item) => !item.isRead).length,
    items: notifications,
  })
}))

notificationsRouter.patch('/:id/read', asyncHandler(async (req, res) => {
  const id = Number.parseInt(String(req.params.id), 10)
  const notification = await prisma.notification.findFirst({
    where: { id, userId: req.currentUser!.id },
  })
  if (!notification) {
    res.status(404).json({ message: '通知不存在。' })
    return
  }
  res.json(await prisma.notification.update({ where: { id }, data: { isRead: true } }))
}))

notificationsRouter.post('/read-all', asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.currentUser!.id, isRead: false },
    data: { isRead: true },
  })
  res.status(204).end()
}))
