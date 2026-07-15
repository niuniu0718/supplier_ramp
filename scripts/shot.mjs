import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' }).catch(async () => chromium.launch())
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
await page.addInitScript(() => {
  localStorage.setItem('supplier-ramp-user-id', 'U_SUPPLIER_DFD')
})
await page.goto('http://localhost:5173/supplier', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.screenshot({ path: '/tmp/supplier-fresh.png', fullPage: true })
await browser.close()
console.log('done')
