import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../lib/asyncHandler.js'

export const authRouter = Router()

authRouter.get('/demo-users', asyncHandler(async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { id: { in: ['U_MANAGER', 'U_ENGINEER', 'U_LEADER', 'U_SUPPLIER'] } },
    select: {
      id: true,
      name: true,
      role: true,
      title: true,
      avatarColor: true,
      supplierId: true,
      supplier: { select: { shortName: true } },
    },
    orderBy: { id: 'asc' },
  })
  res.json(users)
}))

authRouter.get('/me', asyncHandler(async (req, res) => {
  res.json(req.currentUser)
}))

authRouter.get('/reference-data', asyncHandler(async (_req, res) => {
  const [suppliers, owners] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { shortName: 'asc' } }),
    prisma.user.findMany({
      where: { role: { in: ['PROCUREMENT_ENGINEER', 'PROCUREMENT_MANAGER'] } },
      select: { id: true, name: true, title: true },
      orderBy: { name: 'asc' },
    }),
  ])
  res.json({ suppliers, owners })
}))
