import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  _electron as electron,
  expect,
  type ElectronApplication,
  type Page,
} from '@playwright/test'

export const root = resolve(__dirname, '../..')

/**
 * Launch the built app with a throwaway profile, so tests never collide with
 * an Arztool the developer has open (single-instance lock) or leave data behind.
 * Pass `userData` to relaunch on an existing profile (persistence tests); the
 * caller then owns that directory.
 */
export async function launchApp(options: { userData?: string } = {}): Promise<{
  app: ElectronApplication
  userData: string
  cleanup: () => Promise<void>
}> {
  const userData = options.userData ?? mkdtempSync(join(tmpdir(), 'arztool-e2e-'))
  const app = await electron.launch({
    args: [root],
    cwd: root,
    env: { ...process.env, ARZTOOL_USER_DATA_DIR: userData },
  })
  return {
    app,
    userData,
    cleanup: async () => {
      // A slow CI runner must not turn teardown into a failed run: give Electron time to quit
      // cleanly, then kill it. (Windows CI once hung here for 30 s after a flaky test.)
      const closed = await Promise.race([
        app.close().then(() => true),
        new Promise<false>((resolve) => {
          setTimeout(() => {
            resolve(false)
          }, 15_000)
        }),
      ])
      if (!closed) app.process().kill()
      if (!options.userData) rmSync(userData, { recursive: true, force: true })
    },
  }
}

/** Return the QR tool to its start screen, whatever result is showing. */
export async function resetToIdle(page: Page): Promise<void> {
  const reset = page.getByRole('button', {
    name: /^(Anderes Bild laden|Abbrechen|Load another image|Cancel)$/,
  })
  if ((await reset.count()) > 0) await reset.first().click()
  await expect(page.getByTestId('qr-idle')).toBeVisible()
}
