import type { UpdateErrorKind, UpdateState } from '@shared/ipc/channels'

/** The slice of electron-updater's AppUpdater we use — injectable for tests. */
export interface UpdaterLike {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  allowPrerelease: boolean
  checkForUpdates(): Promise<unknown>
  downloadUpdate(): Promise<unknown>
  quitAndInstall(): void
  on(event: string, listener: (...args: unknown[]) => void): unknown
}

function versionOf(info: unknown): string {
  const version = (info as { version?: unknown } | undefined)?.version
  return typeof version === 'string' ? version : '?'
}

export function classifyUpdateError(error: unknown): UpdateErrorKind {
  const message = error instanceof Error ? error.message : String(error)
  if (/code ?signature|not signed|signature verification|publisherName/i.test(message))
    return 'signature'
  if (
    /net::|ENOTFOUND|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|status code 5\d\d/i.test(message)
  ) {
    return 'network'
  }
  return 'other'
}

/**
 * Update flow with the user in charge of every step: check → (user) download →
 * (user) restart & install. Nothing downloads or installs on its own.
 * `updater` is null where updates cannot work (development, unpackaged).
 */
export class UpdateController {
  private state: UpdateState
  private readonly listeners = new Set<(state: UpdateState) => void>()

  constructor(
    private readonly updater: UpdaterLike | null,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.state = updater ? { status: 'idle' } : { status: 'unsupported' }
    if (!updater) return

    updater.autoDownload = false
    updater.autoInstallOnAppQuit = false
    updater.allowPrerelease = false

    updater.on('checking-for-update', () => {
      this.set({ status: 'checking' })
    })
    updater.on('update-not-available', () => {
      this.set({ status: 'up-to-date', checkedAt: this.now().toISOString() })
    })
    updater.on('update-available', (info) => {
      this.set({ status: 'available', version: versionOf(info) })
    })
    updater.on('download-progress', (progress) => {
      const percent = (progress as { percent?: unknown } | undefined)?.percent
      this.set({
        status: 'downloading',
        percent: typeof percent === 'number' ? Math.round(percent) : 0,
      })
    })
    updater.on('update-downloaded', (info) => {
      this.set({ status: 'downloaded', version: versionOf(info) })
    })
    updater.on('error', (error) => {
      this.set({ status: 'error', kind: classifyUpdateError(error) })
    })
  }

  getState(): UpdateState {
    return this.state
  }

  onChange(listener: (state: UpdateState) => void): void {
    this.listeners.add(listener)
  }

  async check(): Promise<UpdateState> {
    if (!this.updater) return this.state
    if (this.state.status === 'checking' || this.state.status === 'downloading') return this.state
    this.set({ status: 'checking' })
    try {
      await this.updater.checkForUpdates()
    } catch (error) {
      this.set({ status: 'error', kind: classifyUpdateError(error) })
    }
    return this.state
  }

  async download(): Promise<UpdateState> {
    if (!this.updater || this.state.status !== 'available') return this.state
    this.set({ status: 'downloading', percent: 0 })
    try {
      await this.updater.downloadUpdate()
    } catch (error) {
      this.set({ status: 'error', kind: classifyUpdateError(error) })
    }
    return this.state
  }

  install(): UpdateState {
    if (this.updater && this.state.status === 'downloaded') this.updater.quitAndInstall()
    return this.state
  }

  private set(next: UpdateState): void {
    this.state = next
    for (const listener of this.listeners) listener(next)
  }
}
