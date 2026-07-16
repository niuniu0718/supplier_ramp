import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' }).catch(async () => chromium.launch())
const ctx = await browser.newContext({ viewport: { width: 1800, height: 1100 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`) })

await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' })
await page.fill('input[autocomplete="username"]', 'admin')
await page.fill('input[autocomplete="current-password"]', 'admin123456')
await page.click('button[type="submit"]')
await page.waitForURL(/\/board/, { timeout: 5000 })
await page.goto('http://localhost:5173/board/expansion/view/timeline', { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)

// Hover state on row name
await page.locator('.gantt-row-name').first().hover()
await page.waitForTimeout(200)
await page.locator('.timeline-gantt').screenshot({ path: '/tmp/gantt-hover.png' })

// Click first row name (P004 云南石墨化 4th — but list is sorted by start_date asc)
// Actually click the 4th gantt row (P004 = 投产期)
await page.locator('.gantt-row-name').nth(3).click()
await page.waitForTimeout(800)
await page.screenshot({ path: '/tmp/after-click.png', fullPage: false })

console.log('errors:', errors.length)
errors.slice(0, 5).forEach((e) => console.log(' ', e))
await browser.close()