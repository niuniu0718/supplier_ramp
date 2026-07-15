import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' }).catch(async () => chromium.launch())
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await ctx.newPage()

const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`) })

await page.addInitScript(() => {
  localStorage.setItem('supplier-ramp-user-id', 'U_MANAGER')
})
await page.goto('http://localhost:5173/board/expansion/view/timeline', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.screenshot({ path: '/tmp/timeline-v2.png', fullPage: true })
console.log('errors:', errors.length)
errors.slice(0, 5).forEach((e) => console.log(' ', e))

// click P002 to verify milestone panel updates
await page.locator('button.gantt-row').nth(1).click()
await page.waitForTimeout(300)
await page.screenshot({ path: '/tmp/timeline-p002.png', fullPage: true })

await browser.close()
