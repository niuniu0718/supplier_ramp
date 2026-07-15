import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

mkdirSync('/tmp/fastapi-final', { recursive: true })

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' }).catch(async () => chromium.launch())
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`) })

// Login
await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' })
await page.fill('input[autocomplete="username"]', 'admin')
await page.fill('input[autocomplete="current-password"]', 'admin123456')
await page.click('button[type="submit"]')
await page.waitForURL(/\/board/, { timeout: 5000 })
await page.waitForTimeout(1200)

const views = [
  '/board/expansion/view/overview',
  '/board/expansion/view/timeline',
  '/board/expansion/view/benchmark',
  '/board/expansion/view/evidence',
  '/board/risks/view/overview',
  '/board/risks/view/by-type',
  '/board/risks/view/escalation',
  '/board/risks/view/closure',
  '/board/tasks/view/my-todo',
  '/board/tasks/view/overdue',
  '/board/tasks/view/escalation',
  '/board/tasks/view/closure',
]

const summary = []
for (const url of views) {
  errors.length = 0
  await page.goto(`http://localhost:5173${url}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const title = await page.locator('h1').first().textContent().catch(() => null)
  const fname = url.replaceAll('/', '_')
  await page.screenshot({ path: `/tmp/fastapi-final/${fname}.png`, fullPage: true })
  summary.push({ url, title, errors: errors.length })
}

console.log('\n=== Summary ===')
for (const s of summary) console.log(`  ${s.url.padEnd(36)}  ${s.title ?? 'NULL'}  errors=${s.errors}`)
const failed = summary.filter((s) => s.errors > 0)
console.log(`\nTotal: ${summary.length}, with errors: ${failed.length}`)

await browser.close()
