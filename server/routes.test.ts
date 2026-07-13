import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from './index.js'

describe('demo API', () => {
  it('拒绝未选择演示身份的业务请求', async () => {
    const response = await request(app).get('/api/dashboard')
    expect(response.status).toBe(401)
  })

  it('采购经理可以读取供需驾驶舱', async () => {
    const response = await request(app).get('/api/dashboard').set('X-User-Id', 'U_MANAGER')
    expect(response.status).toBe(200)
    expect(response.body.materials.length).toBeGreaterThan(0)
    expect(response.body.summary.openRiskCount).toBeGreaterThan(0)
  })

  it('供应商只能读取本企业扩产计划', async () => {
    const response = await request(app).get('/api/expansion-plans').set('X-User-Id', 'U_SUPPLIER')
    expect(response.status).toBe(200)
    expect(response.body.length).toBeGreaterThan(0)
    expect(response.body.every((plan: { supplierId: string }) => plan.supplierId === 'S001')).toBe(true)
  })
})
