import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import QRCode from 'qrcode'
import { launchApp, resetToIdle, root } from './launch'

const fixtures = resolve(root, 'test/fixtures')
const manifest = JSON.parse(readFileSync(resolve(fixtures, 'manifest.json'), 'utf8')) as Record<
  string,
  string
>

let app: ElectronApplication
let cleanup: () => Promise<void>
let shell: Page
let server: Server
let portal = ''
let downloads = ''

const PORTAL_HTML = `<!doctype html><html><head><title>Testbefund</title></head><body>
<h1>Befundportal</h1>
<a id="next" href="/page2">Weiter</a>
<a id="mail" href="mailto:arzt@example.de">Mail</a>
<a id="download" href="/report.pdf">PDF</a>
<button id="popup" onclick="window.open('/popup')">Popup</button>
<script>localStorage.setItem('befund', 'geheim'); document.cookie = 'sid=abc; path=/'</script>
</body></html>`

test.beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/report.pdf') {
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="befund.pdf"',
      })
      res.end('%PDF-1.4 test')
      return
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(req.url === '/page2' ? '<title>Seite 2</title><p>Seite 2</p>' : PORTAL_HTML)
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  portal = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}/`
  downloads = mkdtempSync(join(tmpdir(), 'arztool-dl-'))
  ;({ app, cleanup } = await launchApp())
  shell = await app.firstWindow()
  await expect(shell.getByTestId('qr-idle')).toBeVisible()
})

test.afterAll(async () => {
  await cleanup()
  server.close()
  rmSync(downloads, { recursive: true, force: true })
})

test.beforeEach(async () => {
  await resetToIdle(shell)
})

async function dropBytes(bytes: Buffer, name: string): Promise<void> {
  await shell.evaluate(
    ({ b64, name }) => {
      const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const dt = new DataTransfer()
      dt.items.add(new File([data], name))
      window.dispatchEvent(
        new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }),
      )
    },
    { b64: bytes.toString('base64'), name },
  )
}

const dropFixture = (name: string) => dropBytes(readFileSync(resolve(fixtures, name)), name)

async function viewerPages(): Promise<{ toolbar: Page; content: Page }> {
  await expect
    .poll(() => app.windows().filter((p) => p.url().includes('viewer-toolbar.html')).length)
    .toBeGreaterThan(0)
  const toolbar = app.windows().find((p) => p.url().includes('viewer-toolbar.html'))
  await expect.poll(() => app.windows().some((p) => p.url().startsWith(portal))).toBe(true)
  const content = app.windows().find((p) => p.url().startsWith(portal))
  if (!toolbar || !content) throw new Error('viewer pages not found')
  return { toolbar, content }
}

async function closeAllViewers(): Promise<void> {
  await app.evaluate(({ BaseWindow, BrowserWindow }) => {
    const shellIds = new Set(BrowserWindow.getAllWindows().map((w) => w.id))
    for (const win of BaseWindow.getAllWindows()) if (!shellIds.has(win.id)) win.close()
  })
}

test.describe('confirmation card', () => {
  test('https: verdict ok, registrable domain highlighted, open offered', async () => {
    await dropFixture('single-https.png')
    await expect(shell.getByTestId('scheme-badge')).toHaveAttribute('data-verdict', 'ok')
    await expect(shell.getByTestId('registrable-domain')).toHaveText('radiologie-example.de')
    await expect(shell.getByTestId('confirm-url')).toHaveText(manifest['https'] ?? '')
    await expect(shell.getByTestId('confirm-url').locator('strong')).toHaveText(
      'radiologie-example.de',
    )
    await expect(shell.getByRole('button', { name: 'Im Viewer öffnen' })).toBeVisible()
  })

  test('http: warning, explicit "open anyway"', async () => {
    await dropFixture('http.png')
    await expect(shell.getByTestId('scheme-badge')).toHaveAttribute('data-verdict', 'warn')
    await expect(shell.locator('[data-reason="insecure-http"]')).toBeVisible()
    await expect(shell.getByRole('button', { name: 'Im Viewer öffnen' })).toHaveCount(0)
    await expect(shell.getByRole('button', { name: 'Trotzdem öffnen' })).toBeVisible()
  })

  for (const [file, scheme] of [
    ['javascript.png', 'javascript'],
    ['data-url.png', 'data'],
  ] as const) {
    test(`${file}: blocked, no way to open`, async () => {
      await dropFixture(file)
      await expect(shell.getByTestId('scheme-badge')).toHaveAttribute('data-verdict', 'block')
      await expect(shell.locator('[data-reason="blocked-scheme"]')).toContainText(`${scheme}:`)
      await expect(
        shell.getByTestId('qr-confirm').getByRole('button', { name: /öffnen/ }),
      ).toHaveCount(0)
    })
  }

  test('IDN homograph: warning, host shown as punycode', async () => {
    await dropFixture('idn-homograph.png')
    await expect(shell.getByTestId('scheme-badge')).toHaveAttribute('data-verdict', 'warn')
    await expect(shell.locator('[data-reason="idn"]')).toBeVisible()
    await expect(shell.getByTestId('confirm-url')).toContainText('xn--')
  })

  test('main refuses a blocked URL even if the renderer asks directly', async () => {
    const result = await shell.evaluate(() => window.arztool.viewer.open('javascript:alert(1)'))
    expect(result).toEqual({ status: 'blocked' })
    expect(app.windows().some((p) => p.url().includes('viewer-toolbar.html'))).toBe(false)
  })
})

test.describe('viewer window', () => {
  test.afterEach(async () => {
    await closeAllViewers()
  })

  test('opens in an isolated, in-memory session that is wiped on close', async () => {
    await dropBytes(await QRCode.toBuffer(portal, { width: 400 }), 'portal.png')
    await shell.getByRole('button', { name: 'Trotzdem öffnen' }).click()
    await expect(shell.getByRole('status')).toHaveText('Im Viewer geöffnet.')

    const { toolbar, content } = await viewerPages()
    await expect(content).toHaveTitle('Testbefund')
    await expect(toolbar.getByTestId('viewer-address')).toContainText(portal)
    await expect(toolbar.getByTestId('viewer-address')).toHaveAttribute('data-scheme', 'http')

    // The portal page gets no bridge and no Node.
    expect(
      await content.evaluate(() => {
        const w = window as unknown as Record<string, unknown>
        return [
          typeof w['arztool'],
          typeof w['arztoolViewer'],
          typeof w['require'],
          typeof w['process'],
        ]
      }),
    ).toEqual(['undefined', 'undefined', 'undefined', 'undefined'])
    // The toolbar gets only its own API.
    expect(
      await toolbar.evaluate(() => [
        typeof (window as unknown as Record<string, unknown>)['arztool'],
        Object.keys(window.arztoolViewer).sort(),
      ]),
    ).toEqual(['undefined', ['command', 'getState', 'onState']])

    const session = await app.evaluate(async ({ webContents, session }, origin) => {
      const wc = webContents.getAllWebContents().find((w) => w.getURL().startsWith(origin))
      if (!wc) throw new Error('content not found')
      ;(globalThis as Record<string, unknown>)['__viewerSession'] = wc.session
      return {
        isDefault: wc.session === session.defaultSession,
        storagePath: wc.session.storagePath,
        cookies: (await wc.session.cookies.get({})).map((c) => c.name),
        defaultCookies: (await session.defaultSession.cookies.get({})).map((c) => c.name),
      }
    }, portal)
    expect(session).toEqual({
      isDefault: false,
      storagePath: null,
      cookies: ['sid'],
      defaultCookies: [],
    })

    await closeAllViewers()
    await expect
      .poll(() =>
        app.evaluate(async () => {
          const ses = (globalThis as Record<string, unknown>)['__viewerSession'] as Electron.Session
          return (await ses.cookies.get({})).length
        }),
      )
      .toBe(0)
  })

  test('back/forward, zoom and fullscreen go through the toolbar', async () => {
    await shell.evaluate((url) => window.arztool.viewer.open(url), portal)
    const { toolbar, content } = await viewerPages()
    await expect(toolbar.getByRole('button', { name: 'Zurück' })).toBeDisabled()

    await content.locator('#next').click()
    await expect(content).toHaveTitle('Seite 2')
    await toolbar.getByRole('button', { name: 'Zurück' }).click()
    await expect(content).toHaveTitle('Testbefund')
    await expect(toolbar.getByRole('button', { name: 'Vorwärts' })).toBeEnabled()

    await toolbar.getByRole('button', { name: 'Vergrößern' }).click()
    await expect(toolbar.getByTestId('viewer-zoom')).toHaveText('110 %')
    await toolbar.getByRole('button', { name: 'Verkleinern' }).click()
    await toolbar.getByRole('button', { name: 'Verkleinern' }).click()
    await expect(toolbar.getByTestId('viewer-zoom')).toHaveText('90 %')
    await toolbar.getByTestId('viewer-zoom').click()
    await expect(toolbar.getByTestId('viewer-zoom')).toHaveText('100 %')
  })

  test('mailto links and cross-site/http popups are blocked with a notice', async () => {
    await shell.evaluate((url) => window.arztool.viewer.open(url), portal)
    const { toolbar, content } = await viewerPages()

    // Clicked in-page: Playwright's click() would wait forever for the navigation we cancel.
    await content.evaluate(() => {
      document.querySelector<HTMLElement>('#mail')?.click()
    })
    await expect(toolbar.getByTestId('viewer-notice')).toContainText('„mailto:“-Link blockiert')
    // Ask Electron, not Playwright: Playwright's frame tracking resets on the cancelled navigation.
    const page = await app.evaluate(({ webContents }, origin) => {
      const wc = webContents.getAllWebContents().find((w) => w.getURL().startsWith(origin))
      return { url: wc?.getURL(), title: wc?.getTitle() }
    }, portal)
    expect(page).toEqual({ url: portal, title: 'Testbefund' })

    // Clicked in-page: Playwright's click() would wait forever for the navigation we cancel.
    await content.evaluate(() => {
      document.querySelector<HTMLElement>('#popup')?.click()
    })
    await expect(toolbar.getByTestId('viewer-notice')).toContainText('blockiert')
    expect(app.windows().filter((p) => p.url().includes('viewer-toolbar.html'))).toHaveLength(1)
  })

  test('downloads always ask where to save, and cancel saves nothing', async () => {
    await shell.evaluate((url) => window.arztool.viewer.open(url), portal)
    const { toolbar, content } = await viewerPages()
    const target = join(downloads, 'gespeichert.pdf')

    await app.evaluate(({ dialog }, path) => {
      const calls = { count: 0 }
      ;(globalThis as Record<string, unknown>)['__saveDialogCalls'] = calls
      dialog.showSaveDialogSync = () => {
        calls.count += 1
        return path
      }
    }, target)
    await content.locator('#download').click()
    await expect(toolbar.getByTestId('viewer-notice')).toContainText(
      '„gespeichert.pdf“ gespeichert',
    )
    expect(readFileSync(target, 'utf8')).toBe('%PDF-1.4 test')
    // Marked as coming from the internet, without recording the (token-bearing) URL.
    if (process.platform === 'darwin') {
      const mark = execFileSync('xattr', ['-p', 'com.apple.quarantine', target]).toString()
      expect(mark).toMatch(/^0081;[0-9a-f]+;Arztool;/)
      expect(mark).not.toContain('127.0.0.1')
    } else if (process.platform === 'win32') {
      expect(readFileSync(`${target}:Zone.Identifier`, 'utf8')).toBe(
        '[ZoneTransfer]\r\nZoneId=3\r\n',
      )
    }

    await app.evaluate(({ dialog }) => {
      dialog.showSaveDialogSync = (() => undefined) as unknown as typeof dialog.showSaveDialogSync
    })
    rmSync(target)
    await content.locator('#download').click()
    await content.waitForTimeout(500)
    expect(existsSync(target)).toBe(false)
    expect(
      await app.evaluate(() => (globalThis as Record<string, unknown>)['__saveDialogCalls']),
    ).toEqual({ count: 1 }) // the first download asked exactly once
  })

  test('only the shell may open viewers', async () => {
    await shell.evaluate((url) => window.arztool.viewer.open(url), portal)
    const { toolbar } = await viewerPages()
    const outcome = await toolbar.evaluate(async () => {
      // The toolbar has no viewer.open — and even a raw command is routed only to its own viewer.
      await window.arztoolViewer.command('reload')
      return typeof (window as unknown as Record<string, unknown>)['arztool']
    })
    expect(outcome).toBe('undefined')
  })
})
