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

// 滚到 P001
const p001 = page.locator('#plan-group-P001')
await p001.scrollIntoViewIfNeeded()
await page.waitForTimeout(500)

// 找 P001 里所有 milestone-card
const cards = page.locator('#plan-group-P001 .milestone-card')
const count = await cards.count()
console.log('P001 cards:', count)

for (let i = 0; i < count; i++) {
  const card = cards.nth(i)
  const title = await card.locator('.milestone-card-title strong').textContent().catch(() => '?')
  const overdueTag = await card.locator('.overdue-badge').count()
  const upgradeBtn = await card.locator('button:has-text("升级风险")').count()
  const sigDot = await card.locator('.risk-signal-dot').count()
  const cls = await card.getAttribute('class')
  console.log(`  [${i}] ${title}  overdue=${overdueTag}  upgradeBtn=${upgradeBtn}  sig=${sigDot}  class="${cls}"`)
}

await p001.screenshot({ path: '/tmp/p001_check.png' })
await browser.close()
console.log('done')
