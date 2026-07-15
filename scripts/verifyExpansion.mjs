// Quick browser smoke check: load the 4 expansion views and dump any
// console errors + first network failure per page.

import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const VIEWS = [
  { url: '/board/expansion/view/overview', name: 'overview' },
  { url: '/board/expansion/view/timeline', name: 'timeline' },
  { url: '/board/expansion/view/benchmark', name: 'benchmark' },
  { url: '/board/expansion/view/evidence', name: 'evidence' },
]

mkdirSync('/tmp/expansion-shots', { recursive: true })

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' }).catch(async () =>
  chromium.launch(),
)
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
})
const page = await ctx.newPage()

const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`)
})
page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()} - ${r.failure()?.errorText}`))

// Set the user id before navigation so initial API calls are authenticated
await page.addInitScript(() => {
  localStorage.setItem('supplierRamp.userId', 'U_MANAGER')
})

for (const v of VIEWS) {
  errors.length = 0
  await page.goto(`http://localhost:5173${v.url}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const title = await page.locator('h1').first().textContent().catch(() => null)
  await page.screenshot({ path: `/tmp/expansion-shots/${v.name}.png`, fullPage: true })
  console.log(`[${v.name}] title=${title} errors=${errors.length}`)
  if (errors.length) console.log(errors.slice(0, 5).join('\n'))
}

await browser.close()