import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const ROUTES = [
  '/board/risks/view/overview',
  '/board/risks/view/by-type',
  '/board/risks/view/escalation',
  '/board/risks/view/closure',
  '/board/tasks/view/my-todo',
  '/board/tasks/view/overdue',
  '/board/tasks/view/escalation',
  '/board/tasks/view/closure',
  '/supplier',
]

mkdirSync('/tmp/all-shots', { recursive: true })
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' }).catch(async () => chromium.launch())
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`) })

await page.addInitScript(() => {
  localStorage.setItem('supplierRamp.userId', 'U_MANAGER')
})

for (const url of ROUTES) {
  errors.length = 0
  await page.goto(`http://localhost:5173${url}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const title = await page.locator('h1').first().textContent().catch(() => null)
  await page.screenshot({ path: `/tmp/all-shots/${url.replaceAll('/', '_')}.png`, fullPage: true })
  console.log(`${url}  title="${title}"  errors=${errors.length}`)
  if (errors.length) console.log('  ', errors.slice(0, 3).join(' | '))
}
await browser.close()
