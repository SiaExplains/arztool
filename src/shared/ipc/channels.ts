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
} as const

export type IpcChannel = (typeof IpcChannel)[keyof typeof IpcChannel]

/** Main → renderer notifications (no response). */
export const IpcEvent = {
  MenuOpenImage: 'menu:open-image',
} as const

export type Platform = 'darwin' | 'win32' | 'linux'

export interface AppInfo {
  name: string
  version: string
  platform: Platform
}

/** Image bytes handed to the renderer. Format is sniffed there, never trusted from the name. */
export interface InputFile {
  name: string
  bytes: Uint8Array
}

export type InputError = 'too-large' | 'read-failed' | 'heic-unsupported' | 'heic-failed'

export type OpenImageResult =
  | { status: 'ok'; file: InputFile }
  | { status: 'cancelled' }
  | { status: 'error'; error: InputError }

export type ConvertHeicResult =
  { status: 'ok'; bytes: Uint8Array } | { status: 'error'; error: InputError }

export type ReadClipboardImageResult = { status: 'ok'; file: InputFile } | { status: 'empty' }

/** Request and response types per channel. */
export interface IpcContract {
  [IpcChannel.AppGetInfo]: { request: undefined; response: AppInfo }
  [IpcChannel.FileOpenImage]: { request: undefined; response: OpenImageResult }
  [IpcChannel.ImageConvertHeic]: { request: { bytes: Uint8Array }; response: ConvertHeicResult }
  [IpcChannel.ClipboardReadImage]: { request: undefined; response: ReadClipboardImageResult }
  [IpcChannel.ClipboardWriteText]: { request: { text: string }; response: undefined }
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
    /** Returns an unsubscribe function. */
    onOpenImage(listener: () => void): () => void
  }
}
