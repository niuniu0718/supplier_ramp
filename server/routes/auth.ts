import { Router } from 'express'
import { prisma } from '../lib/prisma.js'

export const authRouter = Router()

authRouter.get('/demo-users', async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, role: true, title: true, supplierId: true, avatarColor: true },
    orderBy: [{ role: 'asc' }, { id: 'asc' }],
  })
  res.json({ users })
})

authRouter.get('/me', async (req, res) => {
  if (!req.currentUser) {
    res.status(401).json({ message: '未指定身份。' })
    return
  }
  res.json(req.currentUser)
})

authRouter.get('/reference-data', async (_req, res) => {
  const [suppliers, owners] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { shortName: 'asc' } }),
    prisma.user.findMany({ where: { role: { in: ['PROCUREMENT_MANAGER', 'PROCUREMENT_ENGINEER', 'DEPARTMENT_LEADER'] } } }),
  ])
  res.json({ suppliers, owners })
})