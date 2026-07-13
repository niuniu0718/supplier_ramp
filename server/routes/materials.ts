import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../lib/asyncHandler.js'
import { prisma } from '../lib/prisma.js'
import { nextMaterialId } from '../services/idGenerator.js'
import { recalculateMaterialRisk } from '../services/materialService.js'

export const materialsRouter = Router()

const materialSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['正极', '负极', '电解液', '隔膜', '辅材']),
  supplierId: z.string().min(1),
  demandMonthly: z.coerce.number().nonnegative(),
  supplyMonthly: z.coerce.number().nonnegative(),
  inventory: z.coerce.number().nonnegative(),
  safetyStockMonths: z.coerce.number().nonnegative(),
  singleSource: z.boolean(),
  dependenceLevel: z.string().nullable().optional(),
  riskDescription: z.string().min(2),
  ownerId: z.string().min(1),
})

materialsRouter.get('/', asyncHandler(async (req, res) => {
  const rows = await prisma.material.findMany({
    where: req.currentUser?.role === 'SUPPLIER' && req.currentUser.supplierId
      ? { supplierId: req.currentUser.supplierId }
      : {},
    include: { supplier: true, owner: true },
    orderBy: { updatedAt: 'desc' },
  })
  res.json(rows)
}))

materialsRouter.get('/:id', asyncHandler(async (req, res) => {
  const material = await prisma.material.findUnique({
    where: { id: String(req.params.id) },
    include: {
      supplier: true,
      owner: { select: { id: true, name: true, title: true } },
      healthSnapshots: { orderBy: { weekDate: 'asc' } },
      risks: {
        include: {
          actions: {
            include: {
              owner: { select: { id: true, name: true } },
              task: true,
            },
          },
        },
        orderBy: { discoveredAt: 'desc' },
      },
      expansionPlans: { include: { supplier: true, items: true } },
    },
  })
  if (!material) {
    res.status(404).json({ message: '物料不存在。' })
    return
  }
  if (req.currentUser?.role === 'SUPPLIER' && material.supplierId !== req.currentUser.supplierId) {
    res.status(403).json({ message: '无权查看其他供应商数据。' })
    return
  }
  res.json({
    ...material,
    supplyGap: material.demandMonthly - material.supplyMonthly,
    inventoryCoverage: material.demandMonthly > 0 ? material.inventory / material.demandMonthly : 0,
  })
}))

materialsRouter.post('/', asyncHandler(async (req, res) => {
  if (req.currentUser?.role === 'SUPPLIER') {
    res.status(403).json({ message: '供应商身份不可新增物料。' })
    return
  }
  const data = materialSchema.parse(req.body)
  const id = await nextMaterialId()
  const material = await prisma.material.create({
    data: { ...data, id, riskLevel: 'GREEN' },
  })
  await recalculateMaterialRisk(id)
  res.status(201).json(await prisma.material.findUnique({ where: { id: material.id }, include: { supplier: true } }))
}))

materialsRouter.put('/:id', asyncHandler(async (req, res) => {
  if (req.currentUser?.role === 'SUPPLIER') {
    res.status(403).json({ message: '供应商身份不可编辑供需主数据。' })
    return
  }
  const data = materialSchema.partial().parse(req.body)
  await prisma.material.update({ where: { id: String(req.params.id) }, data })
  await recalculateMaterialRisk(String(req.params.id))
  res.json(await prisma.material.findUnique({ where: { id: String(req.params.id) }, include: { supplier: true } }))
}))
