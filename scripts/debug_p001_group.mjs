import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' }).catch(async () => chromium.launch())
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' })
await page.fill('input[autocomplete="username"]', 'admin')
await page.fill('input[autocomplete="current-password"]', 'admin123456')
await page.click('button[type="submit"]')
await page.waitForURL(/\/board/, { timeout: 5000 })

await page.goto('http://localhost:5173/board/expansion/view/timeline', { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

// 滚到 P001 整组
await page.locator('#plan-group-P001').scrollIntoViewIfNeeded()
await page.waitForTimeout(500)
await page.locator('#plan-group-P001').screenshot({ path: '/tmp/p001_full.png' })

// P002 整组
await page.locator('#plan-group-P002').scrollIntoViewIfNeeded()
await page.waitForTimeout(500)
await page.locator('#plan-group-P002').screenshot({ path: '/tmp/p002_full.png' })

await browser.close()
console.log('done')
