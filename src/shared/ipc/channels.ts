/**
 * IPC channel names and the typed API surface. Deliberately free of runtime
 * dependencies: the sandboxed preload imports this file and nothing heavier.
 * Payload validation lives in ./schemas.ts and runs in main only.
 */
export const IpcChannel = {
  AppGetInfo: 'app:get-info',
  FileOpenImage: 'file:open-image',
  ImageConvertHeic: 'image:convert-heic',
  ClipboardReadImage: 'clipboard:read-image',
  ClipboardWriteText: 'clipboard:write-text',
  ViewerOpen: 'viewer:open',
  ViewerGetState: 'viewer:get-state',
  ViewerCommand: 'viewer:command',
  SettingsGet: 'settings:get',
  SettingsUpdate: 'settings:update',
  HistoryList: 'history:list',
  HistoryClear: 'history:clear',
} as const

export type IpcChannel = (typeof IpcChannel)[keyof typeof IpcChannel]

/** Main → renderer notifications (no response). */
export const IpcEvent = {
  MenuOpenImage: 'menu:open-image',
  ViewerState: 'viewer:state',
  MenuOpenSettings: 'menu:open-settings',
  MenuOpenAbout: 'menu:open-about',
} as const

/** Which preload API a window gets; passed via `additionalArguments`. */
export const PRELOAD_ROLE_ARG = '--arztool-role='
export type PreloadRole = 'shell' | 'viewer-toolbar'

export type Platform = 'darwin' | 'win32' | 'linux'

export interface AppInfo {
  name: string
  version: string
  platform: Platform
  electronVersion: string
  chromeVersion: string
}

/** Mirrors shared/settings.ts (kept here as plain types so the preload stays dependency-free). */
export type Language = 'de' | 'en'
export interface SettingsData {
  language: Language
  trustedDomains: string[]
  skipConfirmForTrusted: boolean
  historyEnabled: boolean
}
export type SettingsPatchData = { [K in keyof SettingsData]?: SettingsData[K] | undefined }
export type SettingsUpdateResult =
  { status: 'ok'; settings: SettingsData } | { status: 'invalid-domains'; invalidDomains: string[] }
export interface HistoryEntryData {
  domain: string
  openedAt: string
}

/** Image bytes handed to the renderer. Format is sniffed there, never trusted from the name. */
export interface InputFile {
  name: string
  bytes: Uint8Array
}

export type InputError =
  'too-large' | 'read-failed' | 'unsupported-format' | 'heic-unsupported' | 'heic-failed'

export type OpenImageResult =
  | { status: 'ok'; file: InputFile }
  | { status: 'cancelled' }
  | { status: 'error'; error: InputError }

export type ConvertHeicResult =
  { status: 'ok'; bytes: Uint8Array } | { status: 'error'; error: InputError }

export type ReadClipboardImageResult =
  | { status: 'ok'; file: InputFile }
  | { status: 'empty' }
  /** HTML only linked to an image on the web; fetching it would be a network call. */
  | { status: 'reference-only' }
  /** Files were copied, but none of the ones we can see is an image or PDF. */
  | { status: 'no-image-file' }

export type ViewerOpenResult = { status: 'opened' } | { status: 'blocked' }

export const VIEWER_COMMANDS = [
  'back',
  'forward',
  'reload',
  'stop',
  'zoom-in',
  'zoom-out',
  'zoom-reset',
  'toggle-fullscreen',
  'open-external',
  'dismiss-notice',
] as const
export type ViewerCommand = (typeof VIEWER_COMMANDS)[number]

export type ViewerNotice =
  | { kind: 'popup-blocked'; host: string }
  | { kind: 'navigation-blocked'; scheme: string }
  | { kind: 'load-failed'; description: string }
  | { kind: 'download-done'; filename: string }
  | { kind: 'download-failed'; filename: string }
  | { kind: 'crashed' }

/** Everything the viewer toolbar renders. The URL is display-only. */
export interface ViewerState {
  url: string
  title: string
  scheme: 'https' | 'http' | 'other'
  registrableDomain: string | null
  canGoBack: boolean
  canGoForward: boolean
  loading: boolean
  zoomPercent: number
  fullscreen: boolean
  notice: ViewerNotice | null
  /** UI language, so the toolbar follows the settings. */
  language: Language
}

/** Request and response types per channel. */
export interface IpcContract {
  [IpcChannel.AppGetInfo]: { request: undefined; response: AppInfo }
  [IpcChannel.FileOpenImage]: { request: undefined; response: OpenImageResult }
  [IpcChannel.ImageConvertHeic]: { request: { bytes: Uint8Array }; response: ConvertHeicResult }
  [IpcChannel.ClipboardReadImage]: { request: undefined; response: ReadClipboardImageResult }
  [IpcChannel.ClipboardWriteText]: { request: { text: string }; response: undefined }
  [IpcChannel.ViewerOpen]: { request: { url: string }; response: ViewerOpenResult }
  [IpcChannel.ViewerGetState]: { request: undefined; response: ViewerState }
  [IpcChannel.ViewerCommand]: { request: { command: ViewerCommand }; response: undefined }
  [IpcChannel.SettingsGet]: { request: undefined; response: SettingsData }
  [IpcChannel.SettingsUpdate]: { request: SettingsPatchData; response: SettingsUpdateResult }
  [IpcChannel.HistoryList]: { request: undefined; response: HistoryEntryData[] }
  [IpcChannel.HistoryClear]: { request: undefined; response: undefined }
}

/** The API the shell preload exposes on `window.arztool`. */
export interface ArztoolApi {
  app: {
    getInfo(): Promise<AppInfo>
  }
  files: {
    openImage(): Promise<OpenImageResult>
    convertHeic(bytes: Uint8Array): Promise<ConvertHeicResult>
  }
  clipboard: {
    readImage(): Promise<ReadClipboardImageResult>
    writeText(text: string): Promise<void>
  }
  menu: {
    /** Each returns an unsubscribe function. */
    onOpenImage(listener: () => void): () => void
    onOpenSettings(listener: () => void): () => void
    onOpenAbout(listener: () => void): () => void
  }
  settings: {
    get(): Promise<SettingsData>
    update(patch: SettingsPatchData): Promise<SettingsUpdateResult>
  }
  history: {
    list(): Promise<HistoryEntryData[]>
    clear(): Promise<void>
  }
  viewer: {
    open(url: string): Promise<ViewerOpenResult>
  }
}

/** The API the viewer-toolbar preload exposes on `window.arztoolViewer`. */
export interface ViewerToolbarApi {
  getState(): Promise<ViewerState>
  command(command: ViewerCommand): Promise<void>
  /** Returns an unsubscribe function. */
  onState(listener: (state: ViewerState) => void): () => void
}
