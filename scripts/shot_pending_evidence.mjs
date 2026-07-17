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

// 统计待认证 chip 数量（按模块分类）
const chips = await page.locator('.evidence-chip.verification-pending').all()
console.log('PENDING chips on timeline:', chips.length)

// 检查「关键审批事项进度」模块里的待认证 chip
const approvalSection = page.locator('.approval-progress')
const approvalPending = await approvalSection.locator('.evidence-chip.verification-pending').count()
console.log('  approval section:', approvalPending)

// 「试车验证记录」
const commissioningSection = page.locator('.commissioning-progress')
const commissioningPending = await commissioningSection.locator('.evidence-chip.verification-pending').count()
console.log('  commissioning section:', commissioningPending)

// 「量产爬坡计划跟踪」
const rampSection = page.locator('.ramp-progress')
const rampPending = await rampSection.locator('.evidence-chip.verification-pending').count()
console.log('  ramp section:', rampPending)

// 「全部阀点明细」(milestone card)
const valvePending = await page.locator('.milestone-card .evidence-chip.verification-pending').count()
console.log('  valve (milestone) section:', valvePending)

await page.screenshot({ path: '/tmp/iter7/12_pending_chips_overview.png', fullPage: true })

console.log('done')
await browser.close()