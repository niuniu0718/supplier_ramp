import { fileURLToPath } from 'node:url'
import { Router } from 'express'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { applyDeadlineEscalations, updateTaskProgress, HttpError } from '../services/workflow.js'

const uploadsDirectory = fileURLToPath(new URL('../uploads/', import.meta.url))
if (!fs.existsSync(uploadsDirectory)) fs.mkdirSync(uploadsDirectory, { recursive: true })

const storage = multer.diskStorage({
  destination: uploadsDirectory,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ''
    cb(null, `${randomUUID()}${ext}`)
  },
})
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } })

export const tasksRouter = Router()

tasksRouter.get('/', async (_req, res, next) => {
  try {
    const tasks = await prisma.followTask.findMany({
      include: {
        owner: true,
        action: { include: { risk: { include: { material: { include: { supplier: true } } } } } },
        attachments: true,
      },
      orderBy: { deadline: 'asc' },
    })
    res.json({ tasks })
  } catch (error) {
    next(error)
  }
})

tasksRouter.get('/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id)
    const task = await prisma.followTask.findUnique({
      where: { id },
      include: {
        owner: true,
        collaborators: { include: { user: true } },
        action: { include: { risk: { include: { material: { include: { supplier: true } } } } } },
        attachments: true,
        updates: { include: { author: true }, orderBy: { createdAt: 'desc' } },
      },
    })
    if (!task) {
      res.status(404).json({ message: '任务不存在。' })
      return
    }
    res.json({ task })
  } catch (error) {
    next(error)
  }
})

tasksRouter.patch('/:id/progress', async (req, res, next) => {
  try {
    const id = String(req.params.id)
    const schema = z.object({
      progress: z.number().min(0).max(100),
      description: z.string().min(1),
    })
    const data = schema.parse(req.body)
    const authorId = req.currentUser?.id ?? 'U_ENGINEER1'
    const result = await updateTaskProgress({ taskId: id, progress: data.progress, description: data.description, authorId })
    await applyDeadlineEscalations()
    res.json(result)
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message })
      return
    }
    next(error)
  }
})

tasksRouter.post('/:id/attachments', upload.single('file'), async (req, res, next) => {
  try {
    const id = String(req.params.id)
    const task = await prisma.followTask.findUnique({ where: { id } })
    if (!task) {
      res.status(404).json({ message: '任务不存在。' })
      return
    }
    if (!req.file) {
      res.status(400).json({ message: '请上传文件。' })
      return
    }
    const schema = z.object({
      category: z.enum(['DEVICE_PHOTO', 'CONTRACT', 'PAYMENT', 'TEST_REPORT', 'SITE_PHOTO', 'OTHER']).default('OTHER'),
    })
    const { category } = schema.parse(req.body)
    const uploadedById = req.currentUser?.id ?? 'U_ENGINEER1'
    const attachment = await prisma.attachment.create({
      data: {
        taskId: id,
        category,
        fileName: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/${req.file.filename}`,
        uploadedById,
      },
    })
    res.json({ attachment, uploadedById })
  } catch (error) {
    next(error)
  }
})