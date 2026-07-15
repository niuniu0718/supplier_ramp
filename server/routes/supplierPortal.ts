import { fileURLToPath } from 'node:url'
import { Router } from 'express'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { calculateExpectedProgress, calculateExpansionRisk } from '../services/riskEngine.js'
import { createNotification } from '../services/notifications.js'

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

export const supplierPortalRouter = Router()

function ensureSupplier(user?: { role: string; supplierId: string | null; id: string }) {
  if (!user) return { ok: false as const, status: 401, message: '请先选择身份。' }
  if (user.role !== 'SUPPLIER' || !user.supplierId) {
    return { ok: false as const, status: 403, message: '需要供应商身份。' }
  }
  return { ok: true as const, supplierId: user.supplierId, userId: user.id }
}

supplierPortalRouter.get('/me', async (req, res) => {
  const auth = ensureSupplier(req.currentUser)
  if (!auth.ok) {
    res.status(auth.status).json({ message: auth.message })
    return
  }
  const supplier = await prisma.supplier.findUnique({ where: { id: auth.supplierId } })
  res.json({ supplier })
})

supplierPortalRouter.get('/plans', async (req, res, next) => {
  try {
    const auth = ensureSupplier(req.currentUser)
    if (!auth.ok) {
      res.status(auth.status).json({ message: auth.message })
      return
    }
    const plans = await prisma.expansionPlan.findMany({
      where: { supplierId: auth.supplierId },
      include: {
        material: true,
        items: true,
        evidence: { orderBy: { uploadedAt: 'desc' } },
      },
      orderBy: { updatedAt: 'desc' },
    })
    const enriched = plans.map((p) => {
      const { expectedProgress, status, lag } = calculateExpansionRisk({
        startDate: p.startDate,
        endDate: p.endDate,
        progress: p.progress,
        now: new Date(),
      })
      return { ...p, expectedProgress, computedStatus: status, lag }
    })
    res.json({ plans: enriched })
  } catch (error) {
    next(error)
  }
})

supplierPortalRouter.patch('/plans/:id', async (req, res, next) => {
  try {
    const auth = ensureSupplier(req.currentUser)
    if (!auth.ok) {
      res.status(auth.status).json({ message: auth.message })
      return
    }
    const id = String(req.params.id)
    const existing = await prisma.expansionPlan.findUnique({ where: { id } })
    if (!existing || existing.supplierId !== auth.supplierId) {
      res.status(404).json({ message: '计划不存在或无权访问。' })
      return
    }
    const schema = z.object({
      progress: z.number().min(0).max(100).optional(),
      stage: z.string().optional(),
      riskDescription: z.string().optional(),
    })
    const data = schema.parse(req.body)
    const merged = { ...existing, ...data }
    const expectedProgress = calculateExpectedProgress(merged.startDate, merged.endDate)
    const { status } = calculateExpansionRisk({
      startDate: merged.startDate,
      endDate: merged.endDate,
      progress: merged.progress,
    })
    const plan = await prisma.expansionPlan.update({
      where: { id },
      data: { ...data, expectedProgress, status },
    })

    if (data.progress !== undefined && data.progress !== existing.progress) {
      const managers = await prisma.user.findMany({ where: { role: 'PROCUREMENT_MANAGER' } })
      for (const m of managers) {
        await createNotification({
          userId: m.id,
          type: 'EVIDENCE_UPDATE',
          level: status === 'RED' ? 'RED' : status === 'ORANGE' ? 'ORANGE' : 'GREEN',
          title: `供应商更新：${plan.name}`,
          message: `${plan.name} 进度更新至 ${plan.progress}% · 状态 ${status}`,
          link: `/board/expansion/view/overview?plan=${plan.id}`,
        })
      }
    }

    res.json({ plan: { ...plan, expectedProgress, computedStatus: status } })
  } catch (error) {
    next(error)
  }
})

supplierPortalRouter.post('/plans/:id/evidence', upload.single('file'), async (req, res, next) => {
  try {
    const auth = ensureSupplier(req.currentUser)
    if (!auth.ok) {
      res.status(auth.status).json({ message: auth.message })
      return
    }
    const id = String(req.params.id)
    const plan = await prisma.expansionPlan.findUnique({ where: { id } })
    if (!plan || plan.supplierId !== auth.supplierId) {
      res.status(404).json({ message: '计划不存在或无权访问。' })
      return
    }
    if (!req.file) {
      res.status(400).json({ message: '请上传文件。' })
      return
    }
    const schema = z.object({
      category: z.enum(['DEVICE_PHOTO', 'CONTRACT', 'PAYMENT', 'TEST_REPORT', 'SITE_PHOTO', 'OTHER']).default('OTHER'),
      note: z.string().optional(),
    })
    const { category, note } = schema.parse(req.body)
    const evidence = await prisma.evidenceChain.create({
      data: {
        planId: id,
        category,
        fileName: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/${req.file.filename}`,
        note: note ?? '',
        uploadedById: auth.userId,
      },
    })
    const managers = await prisma.user.findMany({ where: { role: 'PROCUREMENT_MANAGER' } })
    for (const m of managers) {
      await createNotification({
        userId: m.id,
        type: 'EVIDENCE_UPDATE',
        level: 'GREEN',
        title: `新证据：${plan.name}`,
        message: `供应商上传了 ${category} 类证据：${req.file.originalname}`,
        link: `/board/expansion/view/evidence?plan=${plan.id}`,
      })
    }
    res.json({ evidence })
  } catch (error) {
    next(error)
  }
})

supplierPortalRouter.get('/evidence', async (req, res, next) => {
  try {
    const auth = ensureSupplier(req.currentUser)
    if (!auth.ok) {
      res.status(auth.status).json({ message: auth.message })
      return
    }
    const evidence = await prisma.evidenceChain.findMany({
      where: { plan: { supplierId: auth.supplierId } },
      include: { plan: true },
      orderBy: { uploadedAt: 'desc' },
    })
    res.json({ evidence })
  } catch (error) {
    next(error)
  }
})