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
await page.waitForTimeout(2000)

const beforeCount = await page.locator('button:has-text("升级风险")').count()
console.log('升级按钮 before:', beforeCount)

await page.locator('button:has-text("升级风险")').first().click()
await page.waitForTimeout(800)
await page.screenshot({ path: '/tmp/upgrade_submit_01.png', fullPage: false })

// 改 level 为 RED
await page.locator('label:has(input[value="RED"])').click()
await page.waitForTimeout(200)

// 修改描述
const desc = page.locator('textarea').first()
await desc.fill('集成测试：自动升级为 RED 风险')

await page.screenshot({ path: '/tmp/upgrade_submit_02_filled.png', fullPage: false })

// 提交
await page.locator('button:has-text("升级为风险")').click()
await page.waitForTimeout(1500)
await page.screenshot({ path: '/tmp/upgrade_submit_03_after.png', fullPage: false })

const afterCount = await page.locator('button:has-text("升级风险")').count()
const upgradedCount = await page.locator('.upgraded-tag').count()
console.log('升级按钮 after:', afterCount, '/ 已升级标签:', upgradedCount)

await browser.close()
console.log('done')
