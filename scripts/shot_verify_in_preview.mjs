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

// 找第一个待认证 chip
const pendingChip = page.locator('.evidence-chip.verification-pending').first()
const hasPending = await pendingChip.count()
console.log('pending chip count:', hasPending)

if (hasPending === 0) {
  console.log('no pending chip — 跳过')
} else {
  await pendingChip.click()
  await page.waitForTimeout(700)
  await page.screenshot({ path: '/tmp/iter7/09_preview_with_actions.png', fullPage: false })

  // 弹窗中应有「通过认证」「退回供应商」按钮
  console.log('通过认证 btn:', await page.locator('button:has-text("通过认证")').count())
  console.log('退回供应商 btn:', await page.locator('button:has-text("退回供应商")').count())

  // 点击「退回供应商」
  await page.locator('button:has-text("退回供应商")').click()
  await page.waitForTimeout(700)
  await page.screenshot({ path: '/tmp/iter7/10_reject_modal.png', fullPage: false })

  // 填写退回原因并提交（在子 modal 中定位 textarea）
  const textareas = page.locator('.modal textarea')
  await textareas.last().fill('材料不清晰，请重新上传并保留原始时间戳。')
  await page.waitForTimeout(200)
  // 子 modal 的「退回」按钮（文字精确为「退回」）
  await page.locator('.modal-footer button.button-danger').filter({ hasText: /^退回$/ }).click()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: '/tmp/iter7/11_after_reject.png', fullPage: true })

  // 验证 chip 是否变成已退回（红）
  const rejectedCount = await page.locator('.evidence-chip.verification-rejected').count()
  console.log('rejected chips after:', rejectedCount)
}

console.log('done')
await browser.close()