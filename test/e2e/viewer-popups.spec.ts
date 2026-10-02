import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:https'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp } from './launch'

/**
 * Popups are only ever routed between https pages, so this suite runs a local
 * https server with a throwaway self-signed certificate. 127.0.0.1 is the
 * "portal"; localhost is a different site standing in for a third-party iframe.
 */
let app: ElectronApplication
let cleanup: () => Promise<void>
let shell: Page
let server: Server
let certDir = ''
let portal = '' // https://127.0.0.1:P
let thirdParty = '' // https://localhost:P

const html = (body: string, referrerPolicy = '') =>
  `<!doctype html><title>Portal</title>${referrerPolicy ? `<meta name="referrer" content="${referrerPolicy}">` : ''}${body}`

test.beforeAll(async () => {
  try {
    execFileSync('openssl', ['version'])
  } catch {
    test.skip(true, 'openssl not available to create a test certificate')
  }
  certDir = mkdtempSync(join(tmpdir(), 'arztool-tls-'))
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '1',
      '-keyout',
      join(certDir, 'key.pem'),
      '-out',
      join(certDir, 'cert.pem'),
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost,IP:127.0.0.1',
    ],
    { stdio: 'ignore' },
  )

  server = createServer(
    { key: readFileSync(join(certDir, 'key.pem')), cert: readFileSync(join(certDir, 'cert.pem')) },
    (req, res) => {
      const url = new URL(req.url ?? '/', 'https://x')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      const frame = url.searchParams.get('frame') // referrer policy of the embedded third-party frame
      const top = url.searchParams.get('top') ?? ''
      if (url.pathname === '/portal') {
        const iframe =
          frame === null
            ? ''
            : `<iframe src="${thirdParty}/ad?policy=${encodeURIComponent(frame)}"></iframe>`
        res.end(html(`<h1>Befundportal</h1>${iframe}`, top))
      } else if (url.pathname === '/ad') {
        res.end(html('<p>Werbung</p>', url.searchParams.get('policy') ?? ''))
      } else {
        res.end(html('<p>Bericht</p>'))
      }
    },
  )
  // Dual-stack: on CI runners "localhost" resolves to ::1 first, so an IPv4-only
  // server would leave the third-party iframe unloaded.
  await new Promise<void>((done) => server.listen({ port: 0, host: '::', ipv6Only: false }, done))
  const port = String((server.address() as AddressInfo).port)
  portal = `https://127.0.0.1:${port}`
  thirdParty = `https://localhost:${port}`

  ;({ app, cleanup } = await launchApp())
  shell = await app.firstWindow()
  // Test-only: trust the throwaway certificate. The app itself never does this.
  await app.evaluate(({ app: electronApp }) => {
    electronApp.on('certificate-error', (event, _wc, _url, _error, _cert, callback) => {
      event.preventDefault()
      callback(true)
    })
  })
  await expect(shell.getByTestId('qr-idle')).toBeVisible()
})

test.afterAll(async () => {
  await cleanup()
  server.close()
  rmSync(certDir, { recursive: true, force: true })
})

test.afterEach(async () => {
  await app.evaluate(({ BaseWindow, BrowserWindow }) => {
    const shellIds = new Set(BrowserWindow.getAllWindows().map((w) => w.id))
    for (const win of BaseWindow.getAllWindows()) if (!shellIds.has(win.id)) win.close()
  })
  await expect.poll(toolbarCount).toBe(0)
})

function toolbarCount(): number {
  return app.windows().filter((p) => p.url().includes('viewer-toolbar.html')).length
}

/** Open the portal in a viewer, then call window.open from the top frame or its iframe. */
async function openPopup(portalPath: string, from: 'top' | 'iframe'): Promise<void> {
  await shell.evaluate((url) => window.arztool.viewer.open(url), `${portal}${portalPath}`)
  await expect.poll(toolbarCount).toBe(1)
  // Every frame must have really loaded — a failed iframe is an error page that
  // never calls window.open, which would make "blocked" tests pass or fail for the wrong reason.
  const expectedOrigins = portalPath.includes('frame=') ? [portal, thirdParty] : [portal]
  await expect
    .poll(() =>
      app.evaluate(({ webContents }, origin) => {
        const wc = webContents.getAllWebContents().find((w) => w.getURL().startsWith(origin))
        return wc ? wc.mainFrame.framesInSubtree.map((f) => f.origin).sort() : []
      }, portal),
    )
    .toEqual(expectedOrigins.sort())

  await app.evaluate(
    async ({ webContents }, { origin, target, from }) => {
      const wc = webContents.getAllWebContents().find((w) => w.getURL().startsWith(origin))
      if (!wc) throw new Error('portal not loaded')
      const frame = from === 'top' ? wc.mainFrame : wc.mainFrame.frames[0]
      if (!frame) throw new Error('iframe not loaded')
      await frame.executeJavaScript(`window.open(${JSON.stringify(target)}); true`, true)
    },
    { origin: portal, target: `${portal}/report`, from },
  )
}

async function expectBlocked(): Promise<void> {
  const toolbar = app.windows().find((p) => p.url().includes('viewer-toolbar.html'))
  await expect(toolbar?.getByTestId('viewer-notice') ?? shell.locator('missing')).toContainText(
    'blockiert',
  )
  expect(toolbarCount()).toBe(1)
}

test('the portal page itself may open a same-site popup', async () => {
  await openPopup('/portal?frame=', 'top')
  await expect.poll(toolbarCount).toBe(2)
})

test('a third-party iframe on the portal may not, even for a portal URL', async () => {
  await openPopup('/portal?frame=', 'iframe')
  await expectBlocked()
})

test('a third-party iframe hiding its referrer may not either', async () => {
  await openPopup('/portal?frame=no-referrer', 'iframe')
  await expectBlocked()
})

test('a no-referrer portal without foreign frames still gets its popups', async () => {
  await openPopup('/portal?top=no-referrer', 'top')
  await expect.poll(toolbarCount).toBe(2)
})

test('a no-referrer portal *with* a foreign frame: ambiguous caller, blocked', async () => {
  await openPopup('/portal?top=no-referrer&frame=', 'top')
  await expectBlocked()
})
