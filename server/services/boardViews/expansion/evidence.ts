import { prisma } from '../../../lib/prisma.js'

const CATEGORY_LABELS: Record<string, string> = {
  DEVICE_PHOTO: '设备到货照',
  CONTRACT: '合同扫描件',
  PAYMENT: '付款凭证',
  TEST_REPORT: '检测报告',
  SITE_PHOTO: '现场照片',
  OTHER: '其他',
}

export async function getExpansionEvidence() {
  const plans = await prisma.expansionPlan.findMany({
    include: {
      supplier: true,
      material: true,
      evidence: { include: { uploadedBy: true }, orderBy: { uploadedAt: 'desc' } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const planGroups = plans.map((p) => ({
    planId: p.id,
    planName: p.name,
    supplierName: p.supplier.shortName,
    materialName: p.material.name,
    progress: p.progress,
    status: p.status,
    evidenceCount: p.evidence.length,
    evidence: p.evidence.map((e) => ({
      id: e.id,
      category: e.category,
      categoryLabel: CATEGORY_LABELS[e.category] ?? e.category,
      fileName: e.fileName,
      url: e.url,
      mimeType: e.mimeType,
      size: e.size,
      note: e.note,
      uploaderName: e.uploadedBy.name,
      uploadedAt: e.uploadedAt.toISOString(),
    })),
  }))

  const categoryCounts: Record<string, number> = {}
  let totalEvidence = 0
  for (const g of planGroups) {
    for (const e of g.evidence) {
      categoryCounts[e.category] = (categoryCounts[e.category] ?? 0) + 1
      totalEvidence++
    }
  }

  return {
    board: 'expansion',
    view: 'evidence',
    generatedAt: new Date().toISOString(),
    kpis: [
      { label: '证据总数', value: totalEvidence, unit: '份', tone: 'blue' },
      { label: '覆盖计划', value: planGroups.filter((g) => g.evidenceCount > 0).length, unit: '项', hint: `共 ${planGroups.length} 项`, tone: 'green' },
      { label: '设备到货照', value: categoryCounts.DEVICE_PHOTO ?? 0, unit: '份', tone: 'orange' },
      { label: '合同/凭证', value: (categoryCounts.CONTRACT ?? 0) + (categoryCounts.PAYMENT ?? 0), unit: '份', tone: 'purple' },
    ],
    planGroups,
    categoryCounts,
  }
}