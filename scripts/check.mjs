import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' }).catch(async () => chromium.launch())
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`) })

await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' })
await page.fill('input[autocomplete="username"]', 'admin')
await page.fill('input[autocomplete="current-password"]', 'admin123456')
await page.click('button[type="submit"]')
await page.waitForURL(/\/board/, { timeout: 5000 })
await page.waitForTimeout(1000)

for (const url of ['/board/risks/view/by-type', '/board/risks/view/escalation', '/board/tasks/view/closure']) {
  errors.length = 0
  await page.goto(`http://localhost:5173${url}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  console.log(`--- ${url} ---`)
  errors.slice(0, 3).forEach((e) => console.log(e))
}
await browser.close()
