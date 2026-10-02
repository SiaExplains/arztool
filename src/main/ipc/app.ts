import { app } from 'electron'
import { IpcChannel, type Platform } from '@shared/ipc/channels'
import { handle } from './handle'

export function registerAppIpc(): void {
  handle(IpcChannel.AppGetInfo, () => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform as Platform,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
  }))
}
