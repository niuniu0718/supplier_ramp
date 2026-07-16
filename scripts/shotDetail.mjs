import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' }).catch(async () => chromium.launch())
const ctx = await browser.newContext({ viewport: { width: 1800, height: 1100 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' })
await page.fill('input[autocomplete="username"]', 'admin')
await page.fill('input[autocomplete="current-password"]', 'admin123456')
await page.click('button[type="submit"]')
await page.waitForURL(/\/board/, { timeout: 5000 })
await page.goto('http://localhost:5173/board/expansion/view/timeline', { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)

// Scroll to fourth plan group (P004 with all 4 ramp phases) and screenshot
await page.locator('.timeline-plan-group').nth(3).scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await page.locator('.timeline-plan-group').nth(3).screenshot({ path: '/tmp/plan-group.png' })

// Single milestone card
await page.locator('.milestone-card').first().screenshot({ path: '/tmp/milestone-card.png' })

await browser.close()
console.log('done')