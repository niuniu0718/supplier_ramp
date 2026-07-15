import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' }).catch(async () => chromium.launch())
const ctx = await browser.newContext()
const page = await ctx.newPage()

page.on('request', (r) => {
  if (r.url().includes('/api/')) console.log('REQ', r.method(), r.url(), 'X-User-Id=', r.headers()['x-user-id'])
})
page.on('response', async (r) => {
  if (r.url().includes('/api/supplier')) console.log('  RES', r.status(), r.url())
})

await page.addInitScript(() => {
  localStorage.setItem('supplier-ramp-user-id', 'U_SUPPLIER_DFD')
})
await page.goto('http://localhost:5173/supplier', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await browser.close()
