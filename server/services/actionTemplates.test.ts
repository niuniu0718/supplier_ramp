import { describe, expect, it } from 'vitest'
import { templatesFor, actionTemplates } from './actionTemplates.js'

const REQUIRED_TYPES = ['SINGLE_SOURCE', 'LOW_INVENTORY', 'PRICE', 'POLICY', 'QUALITY']

describe('actionTemplates coverage', () => {
  it.each(REQUIRED_TYPES)('provides >= 3 templates for %s', (type) => {
    const list = actionTemplates[type] ?? []
    expect(list.length).toBeGreaterThanOrEqual(3)
  })

  it('every template has type / title / description', () => {
    for (const list of Object.values(actionTemplates)) {
      for (const t of list) {
        expect(t.type).toBeTruthy()
        expect(t.title.length).toBeGreaterThan(0)
        expect(t.description.length).toBeGreaterThan(0)
      }
    }
  })

  it('templatesFor returns a fallback for unknown types', () => {
    const list = templatesFor('UNKNOWN_TYPE_X')
    expect(list.length).toBeGreaterThan(0)
    expect(list[0].type).toBe('OTHER')
  })

  it('templatesFor returns the same list for known types', () => {
    expect(templatesFor('SINGLE_SOURCE')).toBe(actionTemplates.SINGLE_SOURCE)
  })

  it('SINGLE_SOURCE includes CONTRACT and INSURANCE per PRD', () => {
    const types = actionTemplates.SINGLE_SOURCE.map((t) => t.type)
    expect(types).toContain('CONTRACT')
    expect(types).toContain('INSURANCE')
  })

  it('QUALITY includes SOURCING (supplier downgrade) per PRD', () => {
    const types = actionTemplates.QUALITY.map((t) => t.type)
    expect(types).toContain('SOURCING')
  })

  it('PRICE includes CONTRACT (price clause revision)', () => {
    const types = actionTemplates.PRICE.map((t) => t.type)
    expect(types).toContain('CONTRACT')
  })
})