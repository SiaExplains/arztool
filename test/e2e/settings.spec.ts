import { readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp, resetToIdle, root } from './launch'

const fixtures = resolve(root, 'test/fixtures')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version: string }

let app: ElectronApplication
let page: Page
let userData: string
let cleanup: () => Promise<void>

test.beforeAll(async () => {
  ;({ app, userData, cleanup } = await launchApp())
  page = await app.firstWindow()
  await expect(page.getByTestId('qr-idle')).toBeVisible()
})

test.afterAll(async () => {
  await cleanup()
})

async function dropFixture(name: string): Promise<void> {
  const b64 = readFileSync(resolve(fixtures, name)).toString('base64')
  await page.evaluate(
    ({ b64, name }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const dt = new DataTransfer()
      dt.items.add(new File([bytes], name))
      window.dispatchEvent(
        new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }),
      )
    },
    { b64, name },
  )
}

/** Stand-in for a real viewer: count viewer:open calls instead of loading the internet. */
async function stubViewerOpen(): Promise<void> {
  await app.evaluate(({ webContents }) => {
    const g = globalThis as Record<string, unknown>
    g['__viewerOpens'] = 0
    for (const wc of webContents.getAllWebContents()) {
      wc.session.webRequest.onBeforeRequest(
        { urls: ['https://*/*', 'http://*/*'] },
        (details, done) => {
          if (details.resourceType === 'mainFrame')
            g['__viewerOpens'] = (g['__viewerOpens'] as number) + 1
          done({ cancel: true })
        },
      )
    }
  })
}

async function openSettings(): Promise<void> {
  await page.getByRole('button', { name: /^(Einstellungen|Settings)$/ }).click()
  await expect(page.getByTestId('settings-trusted')).toBeVisible()
}

function viewerToolbarCount(): number {
  return app.windows().filter((p) => p.url().includes('viewer-toolbar.html')).length
}

async function closeViewers(): Promise<void> {
  await app.evaluate(({ BaseWindow, BrowserWindow }) => {
    const shellIds = new Set(BrowserWindow.getAllWindows().map((w) => w.id))
    for (const win of BaseWindow.getAllWindows()) if (!shellIds.has(win.id)) win.close()
  })
  await expect.poll(viewerToolbarCount).toBe(0)
}

test('privacy defaults: history off, no trusted domains, confirmation on', async () => {
  await openSettings()
  await expect(page.getByRole('switch', { name: 'Geöffnete Domains merken' })).not.toBeChecked()
  await expect(page.getByRole('switch', { name: /ohne Rückfrage öffnen/ })).not.toBeChecked()
  await expect(page.getByTestId('settings-trusted')).toContainText('Noch keine Domains hinterlegt.')
})

test('trusted domains: normalised on add, invalid input explained, removable', async () => {
  await openSettings()
  const field = page.getByRole('textbox', { name: 'Vertrauenswürdige Domains' })

  await field.fill('https://www.Radiologie-Example.de/login')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
  await expect(page.getByTestId('trusted-list')).toHaveText('radiologie-example.de✕')

  for (const bad of [
    '192.168.1.10',
    'co.uk',
    'pacs.klinikum.local',
    'radiologie-example.de@evil.com',
  ]) {
    await field.fill(bad)
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    await expect(page.getByRole('alert')).toContainText('keine öffentliche Domain')
  }

  await field.fill('befund.radiologie-example.de')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
  await expect(page.getByRole('alert')).toContainText('steht schon auf der Liste')

  await field.fill('labor-example.de')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
  await page.getByRole('button', { name: 'labor-example.de entfernen' }).click()
  await expect(page.getByTestId('trusted-list').getByRole('listitem')).toHaveCount(1)
})

test('trusted + skip: clean https opens directly; http on the same domain still asks', async () => {
  await stubViewerOpen()
  await openSettings()
  await page.getByRole('switch', { name: /ohne Rückfrage öffnen/ }).check()

  await dropFixture('single-https.png')
  await expect(page.getByTestId('trusted-badge')).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Automatisch im Viewer geöffnet')
  await expect.poll(viewerToolbarCount).toBe(1) // exactly one, despite StrictMode
  await closeViewers()

  await resetToIdle(page)
  await dropFixture('http.png')
  await expect(page.getByRole('button', { name: 'Trotzdem öffnen' })).toBeVisible()
  expect(viewerToolbarCount()).toBe(0)

  await openSettings()
  await page.getByRole('switch', { name: /ohne Rückfrage öffnen/ }).uncheck()
})

test('"Domain vertrauen" adds it to the list but never opens the link on screen', async () => {
  await stubViewerOpen()
  await openSettings()
  // Self-contained: start from "not trusted" whatever earlier tests left behind.
  const remove = page.getByRole('button', { name: 'radiologie-example.de entfernen' })
  if ((await remove.count()) > 0) await remove.click()
  await expect(remove).toHaveCount(0)
  await page.getByRole('switch', { name: /ohne Rückfrage öffnen/ }).check()
  await page.getByRole('button', { name: 'QR-Befund öffnen' }).click()
  await resetToIdle(page)
  await dropFixture('single-https.png')
  await page.getByRole('button', { name: 'Domain vertrauen' }).click()
  await expect(page.getByTestId('trusted-badge')).toBeVisible()
  await page.waitForTimeout(300)
  expect(viewerToolbarCount()).toBe(0)
  await openSettings()
  await page.getByRole('switch', { name: /ohne Rückfrage öffnen/ }).uncheck()
  await openSettings()
  await expect(page.getByTestId('trusted-list')).toContainText('radiologie-example.de')
})

test('history: records domain + time only, and turning it off deletes it', async () => {
  await stubViewerOpen()
  await openSettings()
  await page.getByRole('switch', { name: 'Geöffnete Domains merken' }).check()
  await expect(page.getByTestId('settings-history')).toContainText('Der Verlauf ist leer.')

  await page.getByRole('button', { name: 'QR-Befund öffnen' }).click()
  await resetToIdle(page)
  await dropFixture('single-https.png')
  await page.getByRole('button', { name: 'Im Viewer öffnen' }).click()
  await expect(page.getByRole('status')).toHaveText('Im Viewer geöffnet.')
  await closeViewers()

  await openSettings()
  await expect(page.getByTestId('history-table')).toContainText('radiologie-example.de')

  const stored = readFileSync(join(userData, 'history.json'), 'utf8')
  expect(JSON.parse(stored)).toEqual([
    { domain: 'radiologie-example.de', openedAt: expect.any(String) as unknown as string },
  ])
  expect(stored).not.toContain('token')
  expect(stored).not.toContain('/r/')

  await page.getByRole('switch', { name: 'Geöffnete Domains merken' }).uncheck()
  await expect(page.getByTestId('settings-history')).toContainText('Der Verlauf ist ausgeschaltet.')
  await expect
    .poll(() => {
      try {
        readFileSync(join(userData, 'history.json'))
        return 'exists'
      } catch {
        return 'deleted'
      }
    })
    .toBe('deleted')
})

test('About dialog shows the version and closes with Escape', async () => {
  await page.getByRole('button', { name: 'Über Arztool' }).click()
  await expect(page.getByTestId('about-version')).toHaveText(`Version ${pkg.version}`)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('about-dialog')).toHaveCount(0)

  await app.evaluate(({ Menu }) => {
    Menu.getApplicationMenu()?.getMenuItemById('about')?.click()
  })
  await expect(page.getByTestId('about-dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Schließen' }).click()
})

test('language switch: UI, html lang, menu and viewer toolbar follow; it persists', async () => {
  await openSettings()
  await page.getByRole('radio', { name: 'English' }).click()
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  const fileMenu = await app.evaluate(
    ({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById('open-image')?.label,
  )
  expect(fileMenu).toBe('Open Image …')

  await stubViewerOpen()
  await page.evaluate(() => window.arztool.viewer.open('https://befund.radiologie-example.de/'))
  await expect.poll(viewerToolbarCount).toBe(1)
  const toolbar = app.windows().find((p) => p.url().includes('viewer-toolbar.html'))
  await expect(
    toolbar?.getByRole('button', { name: 'Zoom in' }) ?? page.locator('missing'),
  ).toBeVisible()
  await closeViewers()

  // Relaunch on the same profile: still English.
  await app.close()
  const relaunched = await launchApp({ userData })
  app = relaunched.app
  page = await app.firstWindow()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: 'Load a QR code' })).toBeVisible()
  cleanup = async () => {
    await relaunched.cleanup()
    rmSync(userData, { recursive: true, force: true })
  }
})

test('settings cannot be changed from the viewer toolbar', async () => {
  await stubViewerOpen()
  await page.evaluate(() => window.arztool.viewer.open('https://befund.radiologie-example.de/'))
  await expect.poll(viewerToolbarCount).toBe(1)
  const toolbar = app.windows().find((p) => p.url().includes('viewer-toolbar.html'))
  const hasSettings = await toolbar?.evaluate(() => 'arztool' in window)
  expect(hasSettings).toBe(false)
  await closeViewers()
})

test('a decoded result survives a visit to Settings', async () => {
  await page.getByRole('button', { name: /^(QR-Befund öffnen|Open QR result)$/ }).click()
  await resetToIdle(page)
  await dropFixture('non-url.png')
  await expect(page.getByTestId('qr-text')).toBeVisible()
  await openSettings()
  await expect(page.getByTestId('qr-text')).toBeHidden()
  await page.getByRole('button', { name: /^(QR-Befund öffnen|Open QR result)$/ }).click()
  await expect(page.getByTestId('qr-text')).toBeVisible()
})
