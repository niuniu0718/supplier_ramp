import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { asyncHandler } from '../lib/asyncHandler.js'
import { prisma } from '../lib/prisma.js'
import { updateTaskProgress } from '../services/workflow.js'

export const tasksRouter = Router()

const uploadDirectory = fileURLToPath(new URL('../../uploads/', import.meta.url))
const mimeExtensions: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
}
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (_req, file, callback) => callback(null, `${randomUUID()}${mimeExtensions[file.mimetype]}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    callback(null, Boolean(mimeExtensions[file.mimetype]))
  },
})

function withLiveStatus<T extends { progress: number; deadline: Date; status: string }>(task: T) {
  if (task.progress < 100 && task.deadline < new Date()) return { ...task, status: 'OVERDUE' }
  return task
}

tasksRouter.get('/', asyncHandler(async (req, res) => {
  if (req.currentUser?.role === 'SUPPLIER') {
    res.json([])
    return
  }
  const mine = req.query.scope === 'mine'
  const tasks = await prisma.followTask.findMany({
    where: mine ? { ownerId: req.currentUser!.id } : {},
    include: {
      owner: { select: { id: true, name: true, title: true, avatarColor: true } },
      action: {
        include: {
          risk: { include: { material: { include: { supplier: true } } } },
        },
      },
      updates: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
      attachments: { include: { uploadedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
    },
    orderBy: [{ deadline: 'asc' }],
  })
  res.json(tasks.map(withLiveStatus))
}))

tasksRouter.get('/:id', asyncHandler(async (req, res) => {
  if (req.currentUser?.role === 'SUPPLIER') {
    res.status(403).json({ message: '供应商身份无权查看内部跟进任务。' })
    return
  }
  const task = await prisma.followTask.findUnique({
    where: { id: String(req.params.id) },
    include: {
      owner: true,
      action: { include: { risk: { include: { material: { include: { supplier: true } } } } } },
      updates: { include: { author: true }, orderBy: { createdAt: 'desc' } },
      attachments: { include: { uploadedBy: true }, orderBy: { createdAt: 'desc' } },
    },
  })
  if (!task) {
    res.status(404).json({ message: '跟进任务不存在。' })
    return
  }
  res.json(withLiveStatus(task))
}))

tasksRouter.patch('/:id/progress', asyncHandler(async (req, res) => {
  if (req.currentUser?.role === 'SUPPLIER' || req.currentUser?.role === 'DEPARTMENT_LEADER') {
    res.status(403).json({ message: '当前身份无权更新任务。' })
    return
  }
  const input = z.object({
    progress: z.coerce.number().int().min(0).max(100),
    description: z.string().min(2),
  }).parse(req.body)
  const task = await prisma.followTask.findUniqueOrThrow({ where: { id: String(req.params.id) } })
  if (req.currentUser?.role === 'PROCUREMENT_ENGINEER' && task.ownerId !== req.currentUser.id) {
    res.status(403).json({ message: '只能更新自己负责的任务。' })
    return
  }
  res.json(await updateTaskProgress({
    taskId: task.id,
    progress: input.progress,
    description: input.description,
    authorId: req.currentUser!.id,
  }))
}))

const authorizeAttachment = asyncHandler(async (req, res, next) => {
  const task = await prisma.followTask.findUniqueOrThrow({ where: { id: String(req.params.id) } })
  if (req.currentUser?.role === 'SUPPLIER' || req.currentUser?.role === 'DEPARTMENT_LEADER') {
    res.status(403).json({ message: '当前身份无权上传任务附件。' })
    return
  }
  if (req.currentUser?.role === 'PROCUREMENT_ENGINEER' && task.ownerId !== req.currentUser.id) {
    res.status(403).json({ message: '无权为该任务上传附件。' })
    return
  }
  next()
})

tasksRouter.post('/:id/attachments', authorizeAttachment, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: '请选择 JPG、PNG、WebP 或 PDF 文件，大小不超过 8MB。' })
    return
  }
  const task = await prisma.followTask.findUniqueOrThrow({ where: { id: String(req.params.id) } })
  const attachment = await prisma.attachment.create({
    data: {
      taskId: task.id,
      fileName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/${req.file.filename}`,
      uploadedById: req.currentUser!.id,
    },
  })
  res.status(201).json(attachment)
}))
