import { randomUUID } from 'node:crypto'
import { basename, join } from 'node:path'
import {
  app,
  BaseWindow,
  dialog,
  nativeTheme,
  session,
  shell,
  WebContentsView,
  type Input,
  type Session,
  type WebContents,
} from 'electron'
import {
  IpcEvent,
  PRELOAD_ROLE_ARG,
  type ViewerCommand,
  type ViewerNotice,
  type ViewerState,
} from '@shared/ipc/channels'
import { assessUrl, isPopupAllowed, isViewerNavigable } from '@shared/url-safety'
import { APP_ORIGIN } from '../app-protocol'
import { t } from '../i18n'
import { getSettings } from '../settings'
import { markAsDownloaded } from '../download-mark'
import { setNavigationPolicy } from '../security'
import { loadBounds, saveBounds, type SavedBounds } from './window-state'

const TOOLBAR_HEIGHT = 52
const ZOOM_STEPS = [25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400, 500]
const CASCADE_OFFSET = 28

/** Permissions a portal may get. Everything else (camera, location, …) stays denied. */
const VIEWER_PERMISSIONS: ReadonlySet<string> = new Set(['fullscreen', 'clipboard-sanitized-write'])

interface PartitionRef {
  session: Session
  windows: number
}

/** In-memory partitions shared by a viewer and the same-site popups it opened. */
const partitions = new Map<string, PartitionRef>()
/** Lookup by toolbar web contents id, for IPC routing. */
const viewersByToolbar = new Map<number, Viewer>()
/** Lookup by content web contents id, for downloads. */
const viewersByContent = new Map<number, Viewer>()

function stripAppFromUserAgent(ses: Session): void {
  // Some portals refuse unknown browsers; present as plain Chrome.
  ses.setUserAgent(ses.getUserAgent().replace(/ (?:Arztool|Electron)\/\S+/g, ''))
}

const FORBIDDEN_FILENAME_CHARS = new Set('\\/:*?"<>|')

/** Strip path parts, control and reserved characters from a portal-suggested file name. */
function safeFilename(name: string): string {
  const cleaned = Array.from(basename(name)) // code points, so emoji/umlauts survive
    .map((char) => (char.charCodeAt(0) < 0x20 || FORBIDDEN_FILENAME_CHARS.has(char) ? '_' : char))
    .join('')
    .trim()
  return cleaned === '' || cleaned === '.' || cleaned === '..' ? 'download' : cleaned
}

function prepareSession(partition: string): Session {
  const existing = partitions.get(partition)
  if (existing) {
    existing.windows += 1
    return existing.session
  }

  // No "persist:" prefix → the partition lives in memory only, never on disk.
  const ses = session.fromPartition(partition, { cache: false })
  stripAppFromUserAgent(ses)
  ses.setPermissionRequestHandler((contents, permission, callback, details) => {
    const allowed = VIEWER_PERMISSIONS.has(permission)
    // mailto:, tel:, custom app schemes… arrive as an openExternal request, not a navigation.
    if (!allowed && permission === 'openExternal' && 'externalURL' in details) {
      viewersByContent
        .get(contents.id)
        ?.notify({ kind: 'navigation-blocked', scheme: schemeOf(details.externalURL ?? '') })
    }
    callback(allowed)
  })
  ses.setPermissionCheckHandler((_contents, permission) => VIEWER_PERMISSIONS.has(permission))
  ses.setDevicePermissionHandler(() => false)

  // Downloads always go through a save dialog — never written silently.
  ses.on('will-download', (_event, item, contents) => {
    const viewer = viewersByContent.get(contents.id)
    const filename = safeFilename(item.getFilename())
    const options = {
      title: t('dialog.saveDownload.title'),
      defaultPath: join(app.getPath('downloads'), filename),
    }
    const target = viewer
      ? dialog.showSaveDialogSync(viewer.window, options)
      : dialog.showSaveDialogSync(options)
    if (!target) {
      item.cancel()
      return
    }
    item.setSavePath(target)
    item.once('done', (_e, state) => {
      if (state !== 'completed') {
        viewer?.notify({ kind: 'download-failed', filename: basename(target) })
        return
      }
      // Mark before telling the user it is ready, so it is never opened unmarked.
      void markAsDownloaded(target).then(() => {
        viewer?.notify({ kind: 'download-done', filename: basename(target) })
      })
    })
  })

  partitions.set(partition, { session: ses, windows: 1 })
  return ses
}

/** Drop the last reference to a partition and wipe everything the portal stored. */
async function releaseSession(partition: string): Promise<void> {
  const ref = partitions.get(partition)
  if (!ref) return
  ref.windows -= 1
  if (ref.windows > 0) return
  partitions.delete(partition)
  const ses = ref.session
  await Promise.allSettled([
    ses.clearStorageData(),
    ses.clearCache(),
    ses.clearAuthCache(),
    ses.clearHostResolverCache(),
    ses.closeAllConnections(),
  ])
}

let lastBounds: SavedBounds | null = null

function nextBounds(): SavedBounds {
  const saved = loadBounds('viewer')
  // Cascade additional viewers so they don't stack exactly on top of each other.
  if (viewersByToolbar.size === 0 || !lastBounds) return saved
  return { ...lastBounds, x: lastBounds.x + CASCADE_OFFSET, y: lastBounds.y + CASCADE_OFFSET }
}

export class Viewer {
  readonly window: BaseWindow
  private readonly toolbar: WebContentsView
  private readonly content: WebContentsView
  private readonly partition: string
  private notice: ViewerNotice | null = null
  private closed = false

  constructor(url: string, partition: string) {
    this.partition = partition
    const ses = prepareSession(partition)
    const bounds = nextBounds()
    lastBounds = bounds

    this.window = new BaseWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      minWidth: 640,
      minHeight: 480,
      show: false,
      title: t('viewer.windowTitle'),
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f172a' : '#ffffff',
    })

    this.toolbar = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, '../preload/shell.js'),
        additionalArguments: [`${PRELOAD_ROLE_ARG}viewer-toolbar`],
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        spellcheck: false,
        devTools: !app.isPackaged,
      },
    })

    // Third-party portal: own in-memory session, no preload, no Node, no app:// access.
    this.content = new WebContentsView({
      webPreferences: {
        session: ses,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        nodeIntegrationInSubFrames: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
        spellcheck: false,
        navigateOnDragDrop: false,
        safeDialogs: true,
        devTools: !app.isPackaged,
      },
    })

    this.window.contentView.addChildView(this.content)
    this.window.contentView.addChildView(this.toolbar)
    this.layout()
    if (bounds.maximized) this.window.maximize()

    viewersByToolbar.set(this.toolbar.webContents.id, this)
    viewersByContent.set(this.content.webContents.id, this)

    this.wireWindow()
    this.wireContent()
    this.wireShortcuts(this.toolbar.webContents)
    this.wireShortcuts(this.content.webContents)

    const devServerUrl = process.env['ELECTRON_RENDERER_URL']
    void this.toolbar.webContents.loadURL(
      !app.isPackaged && devServerUrl
        ? `${devServerUrl}/viewer-toolbar.html`
        : `${APP_ORIGIN}/viewer-toolbar.html`,
    )
    void this.content.webContents.loadURL(url).catch(() => {
      // did-fail-load reports the reason to the toolbar.
    })
    this.window.show()
  }

  private layout(): void {
    const { width, height } = this.window.getContentBounds()
    this.toolbar.setBounds({ x: 0, y: 0, width, height: TOOLBAR_HEIGHT })
    this.content.setBounds({
      x: 0,
      y: TOOLBAR_HEIGHT,
      width,
      height: Math.max(0, height - TOOLBAR_HEIGHT),
    })
  }

  private wireWindow(): void {
    const win = this.window
    win.on('resize', () => {
      this.layout()
    })
    win.on('enter-full-screen', () => {
      this.layout()
      this.pushState()
    })
    win.on('leave-full-screen', () => {
      this.layout()
      this.pushState()
    })
    win.on('close', () => {
      const { x, y, width, height } = win.getNormalBounds()
      void saveBounds('viewer', { x, y, width, height, maximized: win.isMaximized() })
    })
    win.on('closed', () => {
      this.closed = true
      viewersByToolbar.delete(this.toolbar.webContents.id)
      viewersByContent.delete(this.content.webContents.id)
      // WebContentsView contents are not destroyed with the window.
      this.toolbar.webContents.close()
      this.content.webContents.close()
      void releaseSession(this.partition)
    })
  }

  private wireContent(): void {
    const contents = this.content.webContents

    setNavigationPolicy(contents, isViewerNavigable)
    contents.on('will-navigate', (_event, target) => {
      // The global guard already cancelled it; tell the user why nothing happened.
      if (!isViewerNavigable(target))
        this.notify({ kind: 'navigation-blocked', scheme: schemeOf(target) })
    })

    contents.setWindowOpenHandler(({ url, referrer }) => {
      const allowed = isPopupAllowed({
        topUrl: contents.getURL(),
        targetUrl: url,
        referrerUrl: referrer.url,
        frameOrigins: contents.mainFrame.framesInSubtree.map((frame) => frame.origin),
      })
      if (allowed) {
        openViewerWindow(url, this.partition)
      } else {
        this.notify({ kind: 'popup-blocked', host: hostOf(url) })
      }
      return { action: 'deny' }
    })

    const push = () => {
      this.pushState()
    }
    contents.on('did-start-loading', push)
    contents.on('did-stop-loading', push)
    contents.on('did-navigate', () => {
      this.notice = null
      push()
    })
    contents.on('did-navigate-in-page', push)
    contents.on('zoom-changed', push)
    contents.on('page-title-updated', (_e, title) => {
      this.window.setTitle(title ? `${title} – Arztool` : t('viewer.windowTitle'))
      push()
    })
    contents.on('did-fail-load', (_e, code, description, _url, isMainFrame) => {
      // -3 = ERR_ABORTED (navigation replaced or cancelled by our own guard).
      if (isMainFrame && code !== -3) this.notify({ kind: 'load-failed', description })
    })
    contents.on('render-process-gone', () => {
      this.notify({ kind: 'crashed' })
    })

    this.toolbar.webContents.on('did-finish-load', push)
  }

  private wireShortcuts(contents: WebContents): void {
    contents.on('before-input-event', (event, input) => {
      const command = shortcutCommand(input)
      if (command === 'close') {
        event.preventDefault()
        this.window.close()
      } else if (command) {
        event.preventDefault()
        this.run(command)
      }
    })
  }

  run(command: ViewerCommand): void {
    const contents = this.content.webContents
    switch (command) {
      case 'back':
        if (contents.navigationHistory.canGoBack()) contents.navigationHistory.goBack()
        break
      case 'forward':
        if (contents.navigationHistory.canGoForward()) contents.navigationHistory.goForward()
        break
      case 'reload':
        contents.reload()
        break
      case 'stop':
        contents.stop()
        break
      case 'zoom-in':
      case 'zoom-out':
      case 'zoom-reset':
        contents.setZoomFactor(nextZoom(contents.getZoomFactor(), command) / 100)
        break
      case 'toggle-fullscreen':
        this.window.setFullScreen(!this.window.isFullScreen())
        break
      case 'open-external': {
        const current = contents.getURL()
        if (isViewerNavigable(current)) void shell.openExternal(current)
        break
      }
      case 'dismiss-notice':
        this.notice = null
        break
    }
    this.pushState()
  }

  notify(notice: ViewerNotice): void {
    this.notice = notice
    this.pushState()
  }

  state(): ViewerState {
    const contents = this.content.webContents
    const url = contents.getURL()
    const assessment = assessUrl(url)
    return {
      url,
      title: contents.getTitle(),
      scheme:
        assessment.scheme === 'https' || assessment.scheme === 'http' ? assessment.scheme : 'other',
      registrableDomain: assessment.registrableDomain,
      canGoBack: contents.navigationHistory.canGoBack(),
      canGoForward: contents.navigationHistory.canGoForward(),
      loading: contents.isLoading(),
      zoomPercent: Math.round(contents.getZoomFactor() * 100),
      fullscreen: this.window.isFullScreen(),
      notice: this.notice,
      language: getSettings().language,
    }
  }

  pushState(): void {
    if (this.closed || this.toolbar.webContents.isDestroyed()) return
    this.toolbar.webContents.send(IpcEvent.ViewerState, this.state())
  }
}

function schemeOf(url: string): string {
  return /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1]?.toLowerCase() ?? '?'
}

function hostOf(url: string): string {
  try {
    return new URL(url).host || schemeOf(url)
  } catch {
    return '?'
  }
}

function nextZoom(factor: number, command: 'zoom-in' | 'zoom-out' | 'zoom-reset'): number {
  if (command === 'zoom-reset') return 100
  const current = Math.round(factor * 100)
  if (command === 'zoom-in') return ZOOM_STEPS.find((step) => step > current) ?? current
  return [...ZOOM_STEPS].reverse().find((step) => step < current) ?? current
}

function shortcutCommand(input: Input): ViewerCommand | 'close' | null {
  if (input.type !== 'keyDown') return null
  const isMac = process.platform === 'darwin'
  const mod = isMac ? input.meta : input.control
  const key = input.key

  if (key === 'F5' || (mod && key.toLowerCase() === 'r')) return 'reload'
  if (key === 'F11' || (isMac && input.meta && input.control && key.toLowerCase() === 'f')) {
    return 'toggle-fullscreen'
  }
  if (!mod && input.alt && key === 'ArrowLeft') return 'back'
  if (!mod && input.alt && key === 'ArrowRight') return 'forward'
  if (!mod) return null
  switch (key) {
    case '+':
    case '=':
      return 'zoom-in'
    case '-':
      return 'zoom-out'
    case '0':
      return 'zoom-reset'
    case '[':
      return 'back'
    case ']':
      return 'forward'
    case 'w':
    case 'W':
      return 'close'
    default:
      return null
  }
}

/** Open a viewer window. `partition` is shared only with same-site popups of an existing viewer. */
export function openViewerWindow(url: string, partition = `viewer-${randomUUID()}`): Viewer {
  return new Viewer(url, partition)
}

/** Re-render every open viewer toolbar, e.g. after the language changed. */
export function refreshAllViewers(): void {
  for (const viewer of viewersByToolbar.values()) viewer.pushState()
}

export function viewerForToolbar(contents: WebContents): Viewer | undefined {
  return viewersByToolbar.get(contents.id)
}
