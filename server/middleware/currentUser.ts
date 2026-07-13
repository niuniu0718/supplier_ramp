import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'

export interface CurrentUser {
  id: string
  name: string
  role: string
  title: string
  avatarColor: string
  supplierId: string | null
}

declare global {
  namespace Express {
    interface Request {
      currentUser?: CurrentUser
    }
  }
}

export async function currentUser(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/health' || req.path === '/demo-users') {
    next()
    return
  }

  const userId = req.header('X-User-Id')
  if (!userId) {
    res.status(401).json({ message: '请选择演示身份后继续。' })
    return
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      role: true,
      title: true,
      avatarColor: true,
      supplierId: true,
    },
  })

  if (!user) {
    res.status(401).json({ message: '演示身份无效。' })
    return
  }

  req.currentUser = user
  next()
}
