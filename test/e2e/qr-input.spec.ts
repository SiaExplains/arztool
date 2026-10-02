import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp, resetToIdle, root } from './launch'

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
  await resetToIdle(page)
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
    await expect(page.getByTestId('confirm-url')).toHaveText(url('https'))
  })

  test('two codes: list both, then the picked one', async () => {
    await dropFixture('multiple.png')
    const list = page.getByTestId('qr-multiple')
    await expect(list.getByRole('heading')).toHaveText('2 QR-Codes gefunden')
    await expect(list.locator('img')).toHaveCount(2)
    await list.getByRole('button', { name: url('httpsSecond') }).click()
    await expect(page.getByTestId('confirm-url')).toHaveText(url('httpsSecond'))
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
      await expect(page.getByTestId('confirm-url')).toHaveText(url(key))
    })
  }

  test('single-page PDF is rendered and decoded', async () => {
    await dropFixture('single-https.pdf')
    await expect(page.getByTestId('confirm-url')).toHaveText(url('https'))
    await expect(page.getByTestId('pdf-page-note')).toHaveCount(0)
  })

  test('format is sniffed from bytes, not the file name', async () => {
    await dropFixture('single-https.png', 'befund.jpg')
    await expect(page.getByTestId('confirm-url')).toHaveText(url('https'))
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
    await expect(page.getByTestId('confirm-url')).toHaveText(url('https'))
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
    await expect(page.getByTestId('confirm-url')).toHaveText(url('http'))
  })

  test('"From clipboard" button reads the same image via main', async () => {
    const png = readFileSync(resolve(fixtures, 'single-https.png'))
    await app.evaluate(async ({ clipboard, ClipboardItem }, b64) => {
      const blob = new Blob([Buffer.from(b64, 'base64')], { type: 'image/png' })
      await clipboard.write([new ClipboardItem({ 'image/png': blob })])
    }, png.toString('base64'))

    await page.getByRole('button', { name: 'Aus Zwischenablage' }).click()
    await expect(page.getByTestId('confirm-url')).toHaveText(url('https'))
  })

  test('paste with text only on the clipboard → "no image" message', async () => {
    await app.evaluate(async ({ clipboard }) => {
      await clipboard.writeText('nur Text')
    })
    await pasteViaEditMenu()
    await expect(page.getByRole('alert')).toHaveText('In der Zwischenablage ist kein Bild.')
  })
})

test.describe('paste from other apps', () => {
  /** Put raw pasteboard data on the macOS clipboard exactly the way other apps do. */
  function macPasteboard(script: string): void {
    execFileSync('osascript', [
      '-l',
      'JavaScript',
      '-e',
      `ObjC.import('AppKit'); var pb = $.NSPasteboard.generalPasteboard; pb.clearContents; ${script}; 'ok'`,
    ])
  }

  async function writeHtml(html: string): Promise<void> {
    await app.evaluate(async ({ clipboard, ClipboardItem }, markup) => {
      await clipboard.write([new ClipboardItem({ 'text/html': markup })])
    }, html)
  }

  const pngB64 = () => readFileSync(resolve(fixtures, 'single-https.png')).toString('base64')

  test('HTML with the image inline (webmail / Office selection) via Cmd/Ctrl+V', async () => {
    await writeHtml(`<p>Ihr Befund</p><img src="data:image/png;base64,${pngB64()}">`)
    await pasteViaEditMenu()
    await expect(page.getByTestId('confirm-url')).toHaveText(url('https'))
  })

  test('HTML with the image inline via the clipboard button', async () => {
    await writeHtml(`<img src="data:image/png;base64,${pngB64()}">`)
    await page.getByRole('button', { name: 'Aus Zwischenablage' }).click()
    await expect(page.getByTestId('confirm-url')).toHaveText(url('https'))
  })

  test('HTML that only links to a web image: explained, nothing downloaded', async () => {
    const requests: string[] = []
    const onRequest = (req: { url(): string }) => {
      if (!/^(app|data|blob):/.test(req.url())) requests.push(req.url())
    }
    page.on('request', onRequest)
    await writeHtml('<img src="https://portal.example.de/qr.png">')
    await pasteViaEditMenu()
    await expect(page.getByRole('alert')).toContainText('nur ein Verweis')
    page.off('request', onRequest)
    expect(requests).toEqual([])
  })

  test('image + HTML together (Chrome "Copy image") uses the image', async () => {
    const png = readFileSync(resolve(fixtures, 'http.png'))
    await app.evaluate(async ({ clipboard, ClipboardItem }, b64) => {
      await clipboard.write([
        new ClipboardItem({
          'image/png': new Blob([Buffer.from(b64, 'base64')], { type: 'image/png' }),
          'text/html': '<img src="https://example.com/qr.png">',
        }),
      ])
    }, png.toString('base64'))
    await pasteViaEditMenu()
    await expect(page.getByTestId('confirm-url')).toHaveText(url('http'))
  })

  for (const [label, sipsFormat, uti] of [
    ['TIFF (Preview, Photos)', 'tiff', 'public.tiff'],
    ['JPEG', 'jpeg', 'public.jpeg'],
  ] as const) {
    test(`raw ${label} image data from another app (macOS)`, async () => {
      test.skip(process.platform !== 'darwin', 'macOS pasteboard types')
      const dir = mkdtempSync(join(tmpdir(), 'arztool-clip-'))
      const file = join(dir, `qr.${sipsFormat}`)
      execFileSync('sips', [
        '-s',
        'format',
        sipsFormat,
        resolve(fixtures, 'single-https.png'),
        '--out',
        file,
      ])
      macPasteboard(`pb.setDataForType($.NSData.dataWithContentsOfFile('${file}'), '${uti}')`)
      await pasteViaEditMenu()
      await expect(page.getByTestId('confirm-url')).toHaveText(url('https'))
      rmSync(dir, { recursive: true, force: true })
    })
  }

  test('a text file and an image copied together: image decoded, or a clear hint (macOS)', async () => {
    // Depends on the macOS version: some expose only the first copied file to Electron 44
    // (the image is invisible → hint), others expose all (the image is found). Both are
    // correct; "kein Bild" or a decoded Finder icon would not be.
    test.skip(process.platform !== 'darwin', 'macOS pasteboard types')
    const dir = mkdtempSync(join(tmpdir(), 'arztool-clip-'))
    const notes = join(dir, 'notes.txt')
    writeFileSync(notes, 'Notizen zum Befund')
    const png = resolve(fixtures, 'http.png')
    macPasteboard(
      `pb.writeObjects($([$.NSURL.fileURLWithPath('${notes}'), $.NSURL.fileURLWithPath('${png}')]))`,
    )
    await pasteViaEditMenu()
    const decoded = page.getByTestId('confirm-url')
    const hint = page.getByRole('alert').filter({ hasText: 'kopieren Sie bitte nur das Bild' })
    await expect(decoded.or(hint)).toBeVisible()
    if (await decoded.isVisible()) await expect(decoded).toHaveText(url('http'))
    rmSync(dir, { recursive: true, force: true })
  })

  test('only a non-image file copied: explained, never its Finder icon decoded (macOS)', async () => {
    test.skip(process.platform !== 'darwin', 'macOS pasteboard types')
    const dir = mkdtempSync(join(tmpdir(), 'arztool-clip-'))
    const notes = join(dir, 'notes.txt')
    writeFileSync(notes, 'Notizen')
    macPasteboard(`pb.writeObjects($([$.NSURL.fileURLWithPath('${notes}')]))`)
    await page.getByRole('button', { name: 'Aus Zwischenablage' }).click()
    await expect(page.getByRole('alert')).toContainText('Die kopierte Datei ist kein Bild')
    rmSync(dir, { recursive: true, force: true })
  })

  test('dropping several files picks the first image', async () => {
    const png = readFileSync(resolve(fixtures, 'single-https.png')).toString('base64')
    await page.evaluate((b64) => {
      const dt = new DataTransfer()
      dt.items.add(new File(['Notizen'], 'notes.txt', { type: 'text/plain' }))
      dt.items.add(
        new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], 'qr.png', {
          type: 'image/png',
        }),
      )
      window.dispatchEvent(
        new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }),
      )
    }, png)
    await expect(page.getByTestId('confirm-url')).toHaveText(url('https'))
  })
})

test.describe('file picker', () => {
  test('"Open image…" button decodes the chosen file', async () => {
    await stubOpenDialog(resolve(fixtures, 'single-https.png'))
    await page.getByRole('button', { name: 'Bild öffnen …' }).click()
    await expect(page.getByTestId('confirm-url')).toHaveText(url('https'))
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
    await expect(page.getByTestId('confirm-url')).toHaveText(url('https'))
  })

  test('picking a non-image file is refused in main', async () => {
    await stubOpenDialog(resolve(fixtures, 'manifest.json'))
    await page.getByRole('button', { name: 'Bild öffnen …' }).click()
    await expect(page.getByRole('alert')).toHaveText('Dieses Dateiformat wird nicht unterstützt.')
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
  await expect(page.getByTestId('confirm-url')).toHaveText(url('https'))
  await resetToIdle(page)
  await dropFixture('single-https.heic')
  await expect(page.getByTestId('qr-confirm').or(page.getByTestId('qr-error'))).toBeVisible()
  expect(requests).toEqual([])
})
