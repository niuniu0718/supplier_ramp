import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' }).catch(async () => chromium.launch())
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`) })

await page.addInitScript(() => {
  localStorage.setItem('supplier-ramp-user-id', 'U_SUPPLIER_DFD')
})

const urls = ['/supplier', '/supplier/history']
for (const url of urls) {
  errors.length = 0
  await page.goto(`http://localhost:5173${url}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const title = await page.locator('h1').first().textContent().catch(() => null)
  await page.screenshot({ path: `/tmp/all-shots${url.replaceAll('/', '_')}.png`, fullPage: true })
  console.log(`${url}  title="${title}"  errors=${errors.length}`)
  if (errors.length) console.log('  ', errors.slice(0, 3).join(' | '))
}
await browser.close()
