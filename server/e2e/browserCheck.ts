import { chromium } from 'playwright-core'

const baseUrl = 'http://localhost:5173'
const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({ executablePath, headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
const errors: string[] = []

page.on('pageerror', (error) => errors.push(`PAGE: ${error.message}`))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`CONSOLE: ${message.text()}`)
})
page.on('response', (response) => {
  if (response.status() >= 500) errors.push(`HTTP ${response.status()}: ${response.url()}`)
})

try {
  // 1. 默认身份直接进入驾驶舱
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: '供需全景驾驶舱' }).waitFor({ timeout: 10000 })

  // 2. 点击红色物料 → 自动跳转到风险页并打开对应风险详情
  await page.locator('.data-table tbody tr').filter({ hasText: '电池级碳酸锂' }).click()
  await page.waitForURL(/\/risks\?risk=R001/, { timeout: 10000 })
  await page.locator('.risk-detail').waitFor({ timeout: 5000 })

  // 3. 制定措施 → 提交后跳转到任务详情
  await page.getByRole('button', { name: '制定措施' }).click()
  await page.getByRole('heading', { name: /为 R001 制定应对措施/ }).waitFor({ timeout: 5000 })
  await page.locator('select[name="ownerId"]').selectOption('U_ENGINEER')
  await page.locator('select[name="priority"]').selectOption('P0')
  const createResponsePromise = page.waitForResponse((response) => response.url().includes('/api/risks/R001/actions') && response.request().method() === 'POST')
  await page.getByRole('button', { name: '创建措施并发起任务' }).click()
  const createResponse = await createResponsePromise
  if (createResponse.status() !== 201) throw new Error('创建措施接口未返回 201')

  // 4. 验证跳转到任务页并自动打开任务详情
  await page.waitForURL(/\/tasks\?task=T/, { timeout: 10000 })
  await page.locator('.task-detail').waitFor({ timeout: 5000 })

  // 5. 任务进度推进到 100% 自动闭环
  await page.locator('.progress-preset-row').getByRole('button', { name: '100%' }).click()
  await page.locator('.progress-update-card textarea').fill('备份供应商初审、送样计划与商务确认均已完成，提交闭环。')
  const progressResponsePromise = page.waitForResponse((response) => response.url().includes('/progress') && response.request().method() === 'PATCH')
  await page.getByRole('button', { name: '提交并完成闭环' }).click()
  const progressResponse = await progressResponsePromise
  if (progressResponse.status() !== 200) throw new Error('任务闭环接口未返回 200')

  // 6. 关闭抽屉 → 打开扩产跟踪页
  await page.waitForSelector('.drawer', { state: 'detached', timeout: 5000 }).catch(async () => {
    await page.keyboard.press('Escape')
    await page.waitForSelector('.drawer', { state: 'detached', timeout: 5000 })
  })
  await page.goto(`${baseUrl}/expansion`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: '供应商扩产跟踪' }).waitFor({ timeout: 5000 })
  await page.locator('.plan-card').filter({ hasText: '锂盐二期 5 万吨扩产' }).click()
  await page.locator('.plan-detail').waitFor({ timeout: 5000 })

  // 7. 深链打开新建扩产计划（materialId + planName → 自动弹出表单 → 创建后跳详情）
  await page.goto(`${baseUrl}/expansion?materialId=M002&planName=${encodeURIComponent('LFP 五期扩产')}`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: '为供应商发起扩产跟踪' }).waitFor({ timeout: 10000 })
  const createPlanResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/expansion-plans') && response.request().method() === 'POST')
  await page.getByRole('button', { name: '创建并打开计划详情' }).click()
  const createPlanResponse = await createPlanResponsePromise
  if (createPlanResponse.status() !== 201) throw new Error('扩产创建接口未返回 201')
  await page.waitForURL(/\/expansion\?plan=P/, { timeout: 10000 })
  await page.locator('.plan-detail').waitFor({ timeout: 5000 })

  // 8. 移动端布局
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  const mobileLayout = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    menuVisible: Boolean(document.querySelector('.mobile-menu-button')),
  }))
  if (mobileLayout.documentWidth > mobileLayout.viewport + 1) {
    throw new Error(`移动端出现横向溢出：${mobileLayout.documentWidth}px > ${mobileLayout.viewport}px`)
  }
  if (!mobileLayout.menuVisible) throw new Error('移动端菜单按钮未显示')
  await page.screenshot({ path: '/tmp/supplier-ramp-demo.png', fullPage: true })

  if (errors.length > 0) throw new Error(errors.join('\n'))
  console.log(JSON.stringify({
    result: 'passed',
    checked: ['默认身份进入', '红色物料跳转风险详情', '制定措施后跳转任务详情', '任务100%自动闭环', '深链新建扩产计划', '移动端布局'],
    screenshot: '/tmp/supplier-ramp-demo.png',
  }, null, 2))
} catch (error) {
  console.error('FAILURE:', error instanceof Error ? error.message : String(error))
  console.error('Errors collected:', errors)
  await page.screenshot({ path: '/tmp/supplier-ramp-failure.png', fullPage: true }).catch(() => undefined)
  process.exit(1)
} finally {
  await browser.close()
}