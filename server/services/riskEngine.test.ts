import { describe, expect, it } from 'vitest'
import { calculateExpansionRisk, calculateMaterialRisk } from './riskEngine.js'

describe('calculateMaterialRisk', () => {
  it('将单点依赖且安全库存不足三个月判为危险', () => {
    expect(calculateMaterialRisk({
      demandMonthly: 100,
      supplyMonthly: 100,
      inventory: 400,
      safetyStockMonths: 2.9,
      singleSource: true,
    })).toBe('RED')
  })

  it('将库存覆盖不足一个月判为警告', () => {
    expect(calculateMaterialRisk({
      demandMonthly: 100,
      supplyMonthly: 100,
      inventory: 99,
      safetyStockMonths: 3,
      singleSource: false,
    })).toBe('ORANGE')
  })

  it('供需和库存正常时返回健康', () => {
    expect(calculateMaterialRisk({
      demandMonthly: 100,
      supplyMonthly: 110,
      inventory: 300,
      safetyStockMonths: 3,
      singleSource: false,
    })).toBe('GREEN')
  })
})

describe('calculateExpansionRisk', () => {
  const now = new Date('2026-07-13T00:00:00.000Z')
  const startDate = new Date('2026-01-01T00:00:00.000Z')
  const endDate = new Date('2026-12-31T00:00:00.000Z')

  it('按计划周期计算预期进度与落后状态', () => {
    const result = calculateExpansionRisk({ startDate, endDate, progress: 30, now, updatedAt: now })
    expect(result.expectedProgress).toBeGreaterThan(50)
    expect(result.status).toBe('ORANGE')
  })

  it('超过计划结束时间且未完成时判为危险', () => {
    const result = calculateExpansionRisk({
      startDate: new Date('2025-01-01T00:00:00.000Z'),
      endDate: new Date('2026-06-01T00:00:00.000Z'),
      progress: 90,
      now,
      updatedAt: now,
    })
    expect(result.status).toBe('RED')
  })
})
