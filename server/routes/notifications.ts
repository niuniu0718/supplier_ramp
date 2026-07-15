import { Router } from 'express'
import { prisma } from '../lib/prisma.js'

export const notificationsRouter = Router()

notificationsRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.currentUser?.id
    if (!userId) {
      res.json({ notifications: [] })
      return
    }
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    res.json({ notifications })
  } catch (error) {
    next(error)
  }
})

notificationsRouter.patch('/:id/read', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const notification = await prisma.notification.update({ where: { id }, data: { isRead: true } })
    res.json({ notification })
  } catch (error) {
    next(error)
  }
})

notificationsRouter.post('/read-all', async (req, res, next) => {
  try {
    const userId = req.currentUser?.id
    if (!userId) {
      res.json({ count: 0 })
      return
    }
    const result = await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } })
    res.json({ count: result.count })
  } catch (error) {
    next(error)
  }
})