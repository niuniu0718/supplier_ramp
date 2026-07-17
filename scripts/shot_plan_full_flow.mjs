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

// 0. 初始截图
await page.screenshot({ path: '/tmp/iter7/00_initial.png', fullPage: true })

// 1. 打开「新增扩产计划」 — 应只剩 5 项字段（计划名/物料/供应商/起止日期）+ 4 模块开关
await page.click('button:has-text("新增扩产计划")')
await page.waitForTimeout(600)
await page.screenshot({ path: '/tmp/iter7/01_create_empty.png', fullPage: false })

// 确认「当前阶段」字段已移除（不应再看到「初始阶段」label）
const hasStageField = await page.locator('label:has-text("当前阶段")').count()
console.log('stage field removed?', hasStageField === 0)

// 2. 填写表单
await page.fill('input[placeholder*="二期"]', '七期 8 万吨硅碳负极扩产')

// 选物料（选第 4 个，跳过 "请选择"）
const materialSelect = page.locator('select').first()
await materialSelect.selectOption({ index: 4 })
await page.waitForTimeout(200)

const today = new Date()
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const start = new Date(today); start.setMonth(start.getMonth() - 1)
const end = new Date(today); end.setMonth(end.getMonth() + 10)
const startStr = fmt(start)
const endStr = fmt(end)

const startInput = page.locator('input[type="date"]').first()
await startInput.fill(startStr)
const endInput = page.locator('input[type="date"]').nth(1)
await endInput.fill(endStr)
await page.waitForTimeout(200)
await page.screenshot({ path: '/tmp/iter7/02_create_filled.png', fullPage: false })

// 3. 提交 → 应自动打开 PlanEditModal
await page.click('button:has-text("创建并编辑子节点")')
await page.waitForTimeout(2000)
await page.screenshot({ path: '/tmp/iter7/03_edit_auto_open.png', fullPage: false })

// 4. 在 PlanEditModal 中：调整两个子节点的日期
// 找到第二个 milestone 的 expected arrival date picker（第 2 个 .date-picker-field-simple 在打开的 milestone 表里）
const allDatePickers = await page.locator('.plan-edit-children input[type="date"]').all()
console.log('date pickers in edit modal:', allDatePickers.length)
// 调整第 3 个阀点的日期
if (allDatePickers.length > 2) {
  const newDate = new Date(today); newDate.setDate(newDate.getDate() + 60)
  await allDatePickers[2].fill(fmt(newDate))
}
// 调整第 1 个审批的预计批复日期
if (allDatePickers.length > 8) {
  const newDate = new Date(today); newDate.setDate(newDate.getDate() + 30)
  await allDatePickers[8].fill(fmt(newDate))
}
await page.waitForTimeout(500)
await page.screenshot({ path: '/tmp/iter7/04_edit_modified.png', fullPage: false })

// 5. 保存全部
await page.click('button:has-text("保存全部")')
await page.waitForTimeout(3000)
await page.screenshot({ path: '/tmp/iter7/05_after_save.png', fullPage: true })

// 6. 时间轴应包含新计划，阀点位置已调整
const planGroupCount = await page.locator('.timeline-plan-group').count()
console.log('plan groups after create:', planGroupCount)

// 7. 打开删除确认
const lastPlanGroup = page.locator('.timeline-plan-group').last()
await lastPlanGroup.locator('button:has-text("删除")').click()
await page.waitForTimeout(500)
await page.screenshot({ path: '/tmp/iter7/06_delete_confirm.png', fullPage: false })

// 8. 确认删除（软删除 / 归档）
await page.click('button:has-text("确认删除")')
await page.waitForTimeout(2000)
await page.screenshot({ path: '/tmp/iter7/07_after_soft_delete.png', fullPage: true })

const planGroupCountAfter = await page.locator('.timeline-plan-group').count()
console.log('plan groups after soft delete:', planGroupCountAfter)

console.log('done')
await browser.close()