import { app, BrowserWindow } from 'electron'
import { IpcEvent } from '@shared/ipc/channels'
import { getSettings } from '../settings'
import { UpdateController, type UpdaterLike } from './controller'

let ready: Promise<UpdateController> | null = null

/**
 * Updates come from this repository's GitHub Releases (see the `publish`
 * block in electron-builder.cjs). The only request is GitHub's release
 * metadata; it happens only when the user enabled the check or clicks
 * "check now". Unpackaged/dev builds have no updater at all.
 */
export function initUpdates(): Promise<UpdateController> {
  ready ??= create()
  return ready
}

async function create(): Promise<UpdateController> {
  let updater: UpdaterLike | null = null
  if (app.isPackaged) {
    const { autoUpdater } = await import('electron-updater')
    autoUpdater.logger = null // no update logs on disk
    updater = autoUpdater // structurally checked against UpdaterLike
  }
  const controller = new UpdateController(updater)
  controller.onChange((state) => {
    for (const win of BrowserWindow.getAllWindows())
      win.webContents.send(IpcEvent.UpdatesState, state)
  })
  if (getSettings().updateCheck) void controller.check()
  return controller
}

/** Resolves once the updater exists; IPC may arrive before start-up finished. */
export function getUpdates(): Promise<UpdateController> {
  return initUpdates()
}
