import { prisma } from '../lib/prisma.js'

function incrementCode(value: string | undefined, prefix: string) {
  const current = value ? Number.parseInt(value.slice(prefix.length), 10) : 0
  return `${prefix}${String(current + 1).padStart(3, '0')}`
}

export async function nextMaterialId() {
  const row = await prisma.material.findFirst({ orderBy: { id: 'desc' }, select: { id: true } })
  return incrementCode(row?.id, 'M')
}

export async function nextRiskId() {
  const row = await prisma.risk.findFirst({ orderBy: { id: 'desc' }, select: { id: true } })
  return incrementCode(row?.id, 'R')
}

export async function nextActionId() {
  const row = await prisma.action.findFirst({ orderBy: { id: 'desc' }, select: { id: true } })
  return incrementCode(row?.id, 'A')
}

export async function nextTaskId() {
  const row = await prisma.followTask.findFirst({ orderBy: { id: 'desc' }, select: { id: true } })
  return incrementCode(row?.id, 'T')
}

export async function nextPlanId() {
  const row = await prisma.expansionPlan.findFirst({ orderBy: { id: 'desc' }, select: { id: true } })
  return incrementCode(row?.id, 'P')
}
