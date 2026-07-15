export type RiskLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED'

export interface MaterialRiskInput {
  demandMonthly: number
  supplyMonthly: number
  inventory: number
  safetyStockMonths: number
  singleSource: boolean
  expansionDelayedDays?: number
}

export interface ExpansionRiskInput {
  startDate: Date
  endDate: Date
  progress: number
  now?: Date
}

export function calculateMaterialRisk(input: MaterialRiskInput): RiskLevel {
  const gapRatio = input.demandMonthly > 0
    ? Math.max(0, input.demandMonthly - input.supplyMonthly) / input.demandMonthly
    : 0
  const inventoryCoverage = input.demandMonthly > 0
    ? input.inventory / input.demandMonthly
    : Number.POSITIVE_INFINITY

  if (input.singleSource && input.safetyStockMonths < 3) return 'RED'
  if (input.singleSource && input.safetyStockMonths < 6) return 'ORANGE'
  if (inventoryCoverage < 1) return 'ORANGE'
  if (gapRatio > 0.3) return 'ORANGE'
  if ((input.expansionDelayedDays ?? 0) > 60) return 'YELLOW'
  return 'GREEN'
}

export function calculateExpectedProgress(startDate: Date, endDate: Date, now = new Date()): number {
  if (now <= startDate) return 0
  if (now >= endDate) return 100
  const total = endDate.getTime() - startDate.getTime()
  if (total <= 0) return 100
  const elapsed = now.getTime() - startDate.getTime()
  return Math.min(100, Math.round((elapsed / total) * 100))
}

export function calculateExpansionRisk(input: ExpansionRiskInput): {
  expectedProgress: number
  status: RiskLevel
  lag: number
} {
  const now = input.now ?? new Date()
  const expectedProgress = calculateExpectedProgress(input.startDate, input.endDate, now)
  const lag = Math.max(0, expectedProgress - input.progress)
  const overdue = now > input.endDate && input.progress < 100

  if (overdue) return { expectedProgress, status: 'RED', lag }
  if (lag > 30) return { expectedProgress, status: 'RED', lag }
  if (lag > 10) return { expectedProgress, status: 'ORANGE', lag }
  if (lag > 0) return { expectedProgress, status: 'YELLOW', lag }
  return { expectedProgress, status: 'GREEN', lag }
}

export const riskRank: Record<RiskLevel, number> = {
  RED: 4,
  ORANGE: 3,
  YELLOW: 2,
  GREEN: 1,
}