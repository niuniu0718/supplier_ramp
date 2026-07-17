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

// 找到「施工建设与安装」卡片
const card = page.locator('#plan-group-P001 .milestone-card.is-overdue').first()
await card.scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await card.screenshot({ path: '/tmp/overdue_card_zoom.png' })
await browser.close()
console.log('done')
