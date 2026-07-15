import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'

declare module 'express-serve-static-core' {
  interface Request {
    currentUser?: {
      id: string
      name: string
      role: string
      title: string
      avatarColor: string
      supplierId: string | null
    }
  }
}

export async function currentUser(req: Request, _res: Response, next: NextFunction) {
  const userId = req.header('X-User-Id') ?? req.header('x-user-id')
  if (!userId) {
    next()
    return
  }
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (user) {
    req.currentUser = {
      id: user.id,
      name: user.name,
      role: user.role,
      title: user.title,
      avatarColor: user.avatarColor,
      supplierId: user.supplierId,
    }
  }
  next()
}