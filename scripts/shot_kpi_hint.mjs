import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' }).catch(async () => chromium.launch())
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' })
await page.fill('input[autocomplete="username"]', 'admin')
await page.fill('input[autocomplete="current-password"]', 'admin123456')
await page.click('button[type="submit"]')
await page.waitForURL(/\/board/, { timeout: 5000 })
await page.waitForTimeout(800)

await page.goto('http://localhost:5173/board/expansion/view/timeline', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

await page.screenshot({ path: '/tmp/iter7/08_kpi_quarter_hint.png', fullPage: false })

// 抓 KPI hint 文字
const kpiText = await page.locator('.kpi-card').nth(1).innerText()
console.log('里程碑跨度 KPI:', kpiText.replace(/\n/g, ' | '))

console.log('done')
await browser.close()