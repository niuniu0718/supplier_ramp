import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium-browser' }).catch(async () => chromium.launch())
const ctx = await browser.newContext({ viewport: { width: 1800, height: 1100 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' })
await page.fill('input[autocomplete="username"]', 'admin')
await page.fill('input[autocomplete="current-password"]', 'admin123456')
await page.click('button[type="submit"]')
await page.waitForURL(/\/board/, { timeout: 5000 })
await page.goto('http://localhost:5173/board/expansion/view/timeline', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

const info = await page.evaluate(() => {
  const dots = Array.from(document.querySelectorAll('.milestone-dot')).slice(0, 5)
  return dots.map((d) => {
    const cs = getComputedStyle(d)
    return {
      cls: d.className,
      width: cs.width,
      height: cs.height,
      bg: cs.backgroundColor,
      radius: cs.borderRadius,
      rect: d.getBoundingClientRect().toJSON(),
    }
  })
})
console.log(JSON.stringify(info, null, 2))

// Zoom in on first row dots
const firstDot = page.locator('.milestone-dot').first()
await firstDot.screenshot({ path: '/tmp/dot-single.png' })

await browser.close()