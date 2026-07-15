import { describe, expect, it } from 'vitest'
import {
  calculateExpectedProgress,
  calculateExpansionRisk,
  calculateMaterialRisk,
} from './riskEngine.js'

describe('calculateMaterialRisk', () => {
  it('RED: single-source + safety stock < 3 months', () => {
    expect(
      calculateMaterialRisk({
        demandMonthly: 100,
        supplyMonthly: 100,
        inventory: 50,
        safetyStockMonths: 2,
        singleSource: true,
      }),
    ).toBe('RED')
  })

  it('ORANGE: single-source + safety stock < 6 months', () => {
    expect(
      calculateMaterialRisk({
        demandMonthly: 100,
        supplyMonthly: 100,
        inventory: 50,
        safetyStockMonths: 5,
        singleSource: true,
      }),
    ).toBe('ORANGE')
  })

  it('ORANGE: inventory covers < 1 month of demand', () => {
    expect(
      calculateMaterialRisk({
        demandMonthly: 100,
        supplyMonthly: 100,
        inventory: 50,
        safetyStockMonths: 6,
        singleSource: false,
      }),
    ).toBe('ORANGE')
  })

  it('ORANGE: gap > 30%', () => {
    expect(
      calculateMaterialRisk({
        demandMonthly: 100,
        supplyMonthly: 50,
        inventory: 200,
        safetyStockMonths: 6,
        singleSource: false,
      }),
    ).toBe('ORANGE')
  })

  it('YELLOW: expansion delayed > 60 days, no other triggers', () => {
    expect(
      calculateMaterialRisk({
        demandMonthly: 100,
        supplyMonthly: 100,
        inventory: 200,
        safetyStockMonths: 6,
        singleSource: false,
        expansionDelayedDays: 75,
      }),
    ).toBe('YELLOW')
  })

  it('GREEN: well-covered material', () => {
    expect(
      calculateMaterialRisk({
        demandMonthly: 100,
        supplyMonthly: 100,
        inventory: 300,
        safetyStockMonths: 6,
        singleSource: false,
      }),
    ).toBe('GREEN')
  })

  it('precedence: single-source RED beats inventory-coverage ORANGE', () => {
    expect(
      calculateMaterialRisk({
        demandMonthly: 100,
        supplyMonthly: 100,
        inventory: 50,
        safetyStockMonths: 1,
        singleSource: true,
      }),
    ).toBe('RED')
  })
})

describe('calculateExpectedProgress', () => {
  const start = new Date('2026-01-01')
  const end = new Date('2026-12-31')

  it('returns 0 before start', () => {
    expect(calculateExpectedProgress(start, end, new Date('2025-12-31'))).toBe(0)
  })

  it('returns 100 at/after end', () => {
    expect(calculateExpectedProgress(start, end, new Date('2027-01-01'))).toBe(100)
  })

  it('returns ~50 halfway through', () => {
    expect(calculateExpectedProgress(start, end, new Date('2026-07-02'))).toBeGreaterThanOrEqual(49)
    expect(calculateExpectedProgress(start, end, new Date('2026-07-02'))).toBeLessThanOrEqual(51)
  })
})

describe('calculateExpansionRisk', () => {
  const start = new Date('2026-01-01')
  const end = new Date('2026-06-30')
  const now = new Date('2026-04-01')

  it('GREEN: progress matches expected', () => {
    const expected = calculateExpectedProgress(start, end, now)
    expect(
      calculateExpansionRisk({ startDate: start, endDate: end, progress: expected, now }).status,
    ).toBe('GREEN')
  })

  it('YELLOW: lag 1-10%', () => {
    const expected = calculateExpectedProgress(start, end, now)
    expect(
      calculateExpansionRisk({
        startDate: start,
        endDate: end,
        progress: expected - 5,
        now,
      }).status,
    ).toBe('YELLOW')
  })

  it('ORANGE: lag 10-30%', () => {
    const expected = calculateExpectedProgress(start, end, now)
    expect(
      calculateExpansionRisk({
        startDate: start,
        endDate: end,
        progress: expected - 20,
        now,
      }).status,
    ).toBe('ORANGE')
  })

  it('RED: lag > 30%', () => {
    const expected = calculateExpectedProgress(start, end, now)
    expect(
      calculateExpansionRisk({
        startDate: start,
        endDate: end,
        progress: expected - 40,
        now,
      }).status,
    ).toBe('RED')
  })

  it('RED: overdue with incomplete progress', () => {
    expect(
      calculateExpansionRisk({
        startDate: start,
        endDate: end,
        progress: 80,
        now: new Date('2026-07-15'),
      }).status,
    ).toBe('RED')
  })

  it('GREEN: overdue with 100% progress', () => {
    expect(
      calculateExpansionRisk({
        startDate: start,
        endDate: end,
        progress: 100,
        now: new Date('2026-07-15'),
      }).status,
    ).toBe('GREEN')
  })

  it('lag is never negative', () => {
    const expected = calculateExpectedProgress(start, end, now)
    const { lag } = calculateExpansionRisk({
      startDate: start,
      endDate: end,
      progress: expected + 20,
      now,
    })
    expect(lag).toBe(0)
  })
})