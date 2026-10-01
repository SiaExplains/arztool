import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp, root } from './launch'

const fixtures = resolve(root, 'test/fixtures')
const manifest = JSON.parse(readFileSync(resolve(fixtures, 'manifest.json'), 'utf8')) as Record<
  string,
  string
>
const url = (key: string) => manifest[key] ?? ''

let app: ElectronApplication
let cleanup: () => Promise<void>
let page: Page
let consoleProblems: string[] = []

test.beforeAll(async () => {
  ;({ app, cleanup } = await launchApp())
  page = await app.firstWindow()
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') consoleProblems.push(msg.text())
  })
  page.on('pageerror', (err) => consoleProblems.push(err.message))
  await expect(page.getByTestId('qr-idle')).toBeVisible()
})

test.afterAll(async () => {
  await cleanup()
})

/**
 * Every test starts from the idle screen. Without this, an assertion like
 * "shows URL X" could pass on the previous test's output before the new
 * decode has even finished.
 */
test.beforeEach(async () => {
  consoleProblems = []
  const reset = page.getByRole('button', { name: 'Anderes Bild laden' })
  if ((await reset.count()) > 0) await reset.click()
  await expect(page.getByTestId('qr-idle')).toBeVisible()
})

test.afterEach(() => {
  expect(consoleProblems, 'renderer console must stay clean').toEqual([])
})

/** Simulate dropping a file anywhere on the window (Playwright cannot do an OS drag). */
async function dropFixture(name: string, asName = name): Promise<void> {
  const b64 = readFileSync(resolve(fixtures, name)).toString('base64')
  await page.evaluate(
    ({ b64, asName }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const dt = new DataTransfer()
      dt.items.add(new File([bytes], asName))
      window.dispatchEvent(
        new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }),
      )
    },
    { b64, asName },
  )
}

/** Replace the native open dialog so it "picks" a fixture. */
async function stubOpenDialog(path: string | null): Promise<void> {
  await app.evaluate(({ dialog }, picked) => {
    dialog.showOpenDialog = () =>
      Promise.resolve({ canceled: picked === null, filePaths: picked ? [picked] : [] })
  }, path)
}

async function pasteViaEditMenu(): Promise<void> {
  // Exactly what the Edit → Paste menu role (Cmd/Ctrl+V) does.
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.webContents.paste()
  })
}

test.describe('drag & drop', () => {
  test('single https code shows the decoded link', async () => {
    await dropFixture('single-https.png')
    await expect(page.getByTestId('decoded-url')).toHaveText(url('https'))
  })

  test('two codes: list both, then the picked one', async () => {
    await dropFixture('multiple.png')
    const list = page.getByTestId('qr-multiple')
    await expect(list.getByRole('heading')).toHaveText('2 QR-Codes gefunden')
    await expect(list.locator('img')).toHaveCount(2)
    await list.getByRole('button', { name: url('httpsSecond') }).click()
    await expect(page.getByTestId('decoded-url')).toHaveText(url('httpsSecond'))
  })

  for (const [file, key] of [
    ['rotated.png', 'https'],
    ['small-lowcontrast.jpg', 'https'],
    ['screenshot.webp', 'https'],
    ['single-https.bmp', 'https'],
    ['http.png', 'http'],
    ['javascript.png', 'javascript'],
  ] as const) {
    test(`${file} → link`, async () => {
      await dropFixture(file)
      await expect(page.getByTestId('decoded-url')).toHaveText(url(key))
    })
  }

  test('single-page PDF is rendered and decoded', async () => {
    await dropFixture('single-https.pdf')
    await expect(page.getByTestId('decoded-url')).toHaveText(url('https'))
    await expect(page.getByTestId('pdf-page-note')).toHaveCount(0)
  })

  test('format is sniffed from bytes, not the file name', async () => {
    await dropFixture('single-https.png', 'befund.jpg')
    await expect(page.getByTestId('decoded-url')).toHaveText(url('https'))
  })

  test('non-URL payload shows text with a working copy button', async () => {
    await dropFixture('non-url.png')
    await expect(page.getByTestId('decoded-text')).toHaveText(url('text'))
    await page.getByRole('button', { name: 'Text kopieren' }).click()
    await expect(page.getByRole('button', { name: 'Kopiert' })).toBeVisible()
    const copied = await app.evaluate(({ clipboard }) => clipboard.readText())
    expect(copied).toBe(url('text'))
  })

  test('no code → tips', async () => {
    await dropFixture('no-qr.png')
    const none = page.getByTestId('qr-none')
    await expect(none.getByRole('heading')).toHaveText('Kein QR-Code gefunden')
    await expect(none.getByRole('listitem')).toHaveCount(4)
  })

  test('unsupported file → clear error, reset returns to start', async () => {
    await dropFixture('manifest.json')
    await expect(page.getByRole('alert')).toHaveText('Dieses Dateiformat wird nicht unterstützt.')
    await page.getByRole('button', { name: 'Anderes Bild laden' }).click()
    await expect(page.getByTestId('qr-idle')).toBeVisible()
  })

  test('HEIC is converted and decoded (macOS)', async () => {
    test.skip(process.platform !== 'darwin', 'HEIC is macOS-only')
    await dropFixture('single-https.heic')
    await expect(page.getByTestId('decoded-url')).toHaveText(url('https'))
  })

  test('HEIC shows a convert hint (Windows)', async () => {
    test.skip(process.platform !== 'win32', 'Windows-only message')
    await dropFixture('single-https.heic')
    await expect(page.getByRole('alert')).toContainText('HEIC')
  })
})

test.describe('paste', () => {
  test('Cmd/Ctrl+V with a screenshot on the clipboard', async () => {
    const png = readFileSync(resolve(fixtures, 'http.png'))
    await app.evaluate(async ({ clipboard, ClipboardItem }, b64) => {
      const blob = new Blob([Buffer.from(b64, 'base64')], { type: 'image/png' })
      await clipboard.write([new ClipboardItem({ 'image/png': blob })])
    }, png.toString('base64'))

    await pasteViaEditMenu()
    await expect(page.getByTestId('decoded-url')).toHaveText(url('http'))
  })

  test('"From clipboard" button reads the same image via main', async () => {
    const png = readFileSync(resolve(fixtures, 'single-https.png'))
    await app.evaluate(async ({ clipboard, ClipboardItem }, b64) => {
      const blob = new Blob([Buffer.from(b64, 'base64')], { type: 'image/png' })
      await clipboard.write([new ClipboardItem({ 'image/png': blob })])
    }, png.toString('base64'))

    await page.getByRole('button', { name: 'Aus Zwischenablage' }).click()
    await expect(page.getByTestId('decoded-url')).toHaveText(url('https'))
  })

  test('paste with text only on the clipboard → "no image" message', async () => {
    await app.evaluate(async ({ clipboard }) => {
      await clipboard.writeText('nur Text')
    })
    await pasteViaEditMenu()
    await expect(page.getByRole('alert')).toHaveText('In der Zwischenablage ist kein Bild.')
  })
})

test.describe('file picker', () => {
  test('"Open image…" button decodes the chosen file', async () => {
    await stubOpenDialog(resolve(fixtures, 'single-https.png'))
    await page.getByRole('button', { name: 'Bild öffnen …' }).click()
    await expect(page.getByTestId('decoded-url')).toHaveText(url('https'))
  })

  test('File → Open image (Cmd/Ctrl+O) uses the same flow', async () => {
    await stubOpenDialog(resolve(fixtures, 'multiple.png'))
    await app.evaluate(({ Menu }) => {
      Menu.getApplicationMenu()?.getMenuItemById('open-image')?.click()
    })
    await expect(page.getByTestId('qr-multiple')).toBeVisible()
  })

  test('picker HEIC is converted in main (macOS)', async () => {
    test.skip(process.platform !== 'darwin', 'HEIC is macOS-only')
    await stubOpenDialog(resolve(fixtures, 'single-https.heic'))
    await app.evaluate(({ Menu }) => {
      Menu.getApplicationMenu()?.getMenuItemById('open-image')?.click()
    })
    await expect(page.getByTestId('decoded-url')).toHaveText(url('https'))
  })

  test('cancelling the dialog changes nothing', async () => {
    await stubOpenDialog(null)
    await app.evaluate(({ Menu }) => {
      Menu.getApplicationMenu()?.getMenuItemById('open-image')?.click()
    })
    await page.waitForTimeout(200)
    await expect(page.getByTestId('qr-idle')).toBeVisible()
  })
})

test('decoding makes no network requests', async () => {
  const requests: string[] = []
  page.on('request', (req) => {
    if (!req.url().startsWith('app://') && !req.url().startsWith('data:')) requests.push(req.url())
  })
  await dropFixture('single-https.pdf')
  await expect(page.getByTestId('decoded-url')).toHaveText(url('https'))
  await page.getByRole('button', { name: 'Anderes Bild laden' }).click()
  await dropFixture('single-https.heic')
  await expect(page.getByTestId('qr-url').or(page.getByTestId('qr-error'))).toBeVisible()
  expect(requests).toEqual([])
})
