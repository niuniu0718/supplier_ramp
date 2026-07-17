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

// 1. 截初始状态 — 看是否有「+ 新增扩产计划」按钮 + 每个 plan group 的删除按钮
await page.screenshot({ path: '/tmp/iter6/timeline_initial.png', fullPage: true })

// 2. 打开新增 modal
await page.click('button:has-text("新增扩产计划")')
await page.waitForTimeout(700)
await page.screenshot({ path: '/tmp/iter6/create_modal_empty.png', fullPage: false })

// 3. 填写表单
await page.fill('input[placeholder*="二期"]', '三期 5 万吨人造石墨负极扩产')
// 选物料 - 找非空选项
const materialSelect = page.locator('select').first()
await materialSelect.selectOption({ index: 4 })  // 跳过 "请选择"
await page.waitForTimeout(200)
// 供应商已自动选中物料的默认供应商
const today = new Date()
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const start = new Date(today); start.setMonth(start.getMonth() - 1)
const end = new Date(today); end.setMonth(end.getMonth() + 10)
const startStr = fmt(start)
const endStr = fmt(end)
// 设置起止日期 — 第一个 date input 是开始日期
const startInput = page.locator('input[type="date"]').first()
await startInput.fill(startStr)
const endInput = page.locator('input[type="date"]').nth(1)
await endInput.fill(endStr)
await page.waitForTimeout(200)
await page.screenshot({ path: '/tmp/iter6/create_modal_filled.png', fullPage: false })

// 4. 提交
await page.click('button:has-text("创建并生成")')
await page.waitForTimeout(2000)

// 5. 截图创建后的时间轴（应包含新计划）
await page.screenshot({ path: '/tmp/iter6/timeline_after_create.png', fullPage: true })

// 6. 打开新计划的删除确认
const lastPlanGroup = page.locator('.timeline-plan-group').last()
await lastPlanGroup.locator('button:has-text("删除")').click()
await page.waitForTimeout(500)
await page.screenshot({ path: '/tmp/iter6/delete_confirm.png', fullPage: false })

// 7. 确认删除
await page.click('button:has-text("确认删除")')
await page.waitForTimeout(1500)
await page.screenshot({ path: '/tmp/iter6/timeline_after_delete.png', fullPage: true })

console.log('done')
await browser.close()