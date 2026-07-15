import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

mkdirSync('/tmp/fastapi-shots', { recursive: true })

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' }).catch(async () => chromium.launch())
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`) })
page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()} - ${r.failure()?.errorText}`))

// 1. Root should redirect to /login (no auth)
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
console.log('After root →', page.url())
await page.screenshot({ path: '/tmp/fastapi-shots/01-login.png', fullPage: true })

// 2. Login with admin
await page.fill('input[autocomplete="username"]', 'admin')
await page.fill('input[autocomplete="current-password"]', 'admin123456')
await page.click('button[type="submit"]')
await page.waitForURL(/\/board\/expansion/, { timeout: 5000 })
await page.waitForTimeout(1500)
const title = await page.locator('h1').first().textContent()
console.log('After login →', page.url(), '| title=', title)
await page.screenshot({ path: '/tmp/fastapi-shots/02-overview.png', fullPage: true })
console.log('  errors:', errors.length)
errors.slice(0, 3).forEach((e) => console.log('   ', e))

// 3. Walk 4 expansion views
errors.length = 0
const views = ['timeline', 'benchmark', 'evidence']
for (const v of views) {
  await page.goto(`http://localhost:5173/board/expansion/view/${v}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const t = await page.locator('h1').first().textContent()
  await page.screenshot({ path: `/tmp/fastapi-shots/03-${v}.png`, fullPage: true })
  console.log(`${v} → title="${t}" errors=${errors.length}`)
}

await browser.close()
