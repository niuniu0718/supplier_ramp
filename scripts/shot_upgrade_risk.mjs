import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' }).catch(async () => chromium.launch())
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' })
await page.fill('input[autocomplete="username"]', 'admin')
await page.fill('input[autocomplete="current-password"]', 'admin123456')
await page.click('button[type="submit"]')
await page.waitForURL(/\/board/, { timeout: 5000 })

// 1. timeline 页面验证升级按钮
await page.goto('http://localhost:5173/board/expansion/view/timeline', { waitUntil: 'networkidle' })
await page.waitForTimeout(2000)

const upgradeBtnCount = await page.locator('button:has-text("升级风险")').count()
console.log('升级风险按钮数量:', upgradeBtnCount)
await page.screenshot({ path: '/tmp/upgrade_01_timeline.png', fullPage: true })

// 2. 风险总览 — 检查 9 类 + source 列
await page.goto('http://localhost:5173/board/risks/view/overview', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.screenshot({ path: '/tmp/upgrade_02_risks_overview.png', fullPage: true })

// 3. 风险按类型分布
await page.goto('http://localhost:5173/board/risks/view/by-type', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.screenshot({ path: '/tmp/upgrade_03_risks_by_type.png', fullPage: true })

// 4. 升级路径
await page.goto('http://localhost:5173/board/risks/view/escalation', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.screenshot({ path: '/tmp/upgrade_04_risks_escalation.png', fullPage: true })

// 5. 打开升级弹窗
await page.goto('http://localhost:5173/board/expansion/view/timeline', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const firstUpgradeBtn = page.locator('button:has-text("升级风险")').first()
if (await firstUpgradeBtn.count() > 0) {
  await firstUpgradeBtn.click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: '/tmp/upgrade_05_modal.png', fullPage: false })

  // 关闭弹窗
  await page.locator('button:has-text("取消")').first().click()
  await page.waitForTimeout(300)
}

await browser.close()
console.log('done')
