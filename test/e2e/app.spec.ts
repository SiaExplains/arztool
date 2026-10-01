import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp, root } from './launch'

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version: string }

let app: ElectronApplication
let cleanup: () => Promise<void>
let page: Page

test.beforeAll(async () => {
  ;({ app, cleanup } = await launchApp())
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  await cleanup()
})

test('shell boots on app:// with the German UI and the QR tool', async () => {
  expect(page.url()).toBe('app://arztool/index.html')
  await expect(page).toHaveTitle('Arztool')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.getByRole('button', { name: 'QR-Befund öffnen' })).toBeVisible()
  await expect(page.getByTestId('qr-idle')).toBeVisible()
})

test('renderer is isolated from Node and only sees the typed bridge', async () => {
  const globals = await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>
    return {
      require: typeof w['require'],
      process: typeof w['process'],
      bridgeKeys: Object.keys(window.arztool),
    }
  })
  expect(globals).toEqual({
    require: 'undefined',
    process: 'undefined',
    bridgeKeys: ['app', 'files', 'clipboard', 'menu'],
  })
})

test('strict CSP is present', async () => {
  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content')
  expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'")
  expect(csp).not.toContain('unsafe-inline')
})

test('IPC round-trip shows the package version', async () => {
  await expect(page.getByTestId('app-version')).toHaveText(`Version ${pkg.version}`)
})

test('console is clean on a fresh load', async () => {
  const problems: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') problems.push(msg.text())
  })
  page.on('pageerror', (err) => problems.push(err.message))
  await page.reload()
  await expect(page.getByTestId('app-version')).toHaveText(`Version ${pkg.version}`)
  expect(problems).toEqual([])
})

test('window.open and navigation away are blocked', async () => {
  const opened = await page.evaluate(() => window.open('https://example.com') === null)
  expect(opened).toBe(true)
  expect(app.windows()).toHaveLength(1)

  await page.evaluate(() => {
    window.location.href = 'https://example.com'
  })
  await page.waitForTimeout(300)
  expect(page.url()).toBe('app://arztool/index.html')
})
