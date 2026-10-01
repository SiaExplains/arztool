/**
 * IPC channel names and the typed API surface. Deliberately free of runtime
 * dependencies: the sandboxed preload imports this file and nothing heavier.
 * Payload validation lives in ./schemas.ts and runs in main only.
 */
export const IpcChannel = {
  AppGetInfo: 'app:get-info',
} as const

export type IpcChannel = (typeof IpcChannel)[keyof typeof IpcChannel]

export type Platform = 'darwin' | 'win32' | 'linux'

export interface AppInfo {
  name: string
  version: string
  platform: Platform
}

/** Request and response types per channel. */
export interface IpcContract {
  [IpcChannel.AppGetInfo]: { request: undefined; response: AppInfo }
}

/** The API the shell preload exposes on `window.arztool`. */
export interface ArztoolApi {
  app: {
    getInfo(): Promise<AppInfo>
  }
}
