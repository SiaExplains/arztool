import type { IpcMainInvokeEvent } from 'electron'
import { IpcChannel } from '@shared/ipc/channels'
import { getUpdates } from '../updater'
import { getShellWindow } from '../windows/shell'
import { handle } from './handle'

function requireShell(event: IpcMainInvokeEvent): void {
  if (event.sender.id !== getShellWindow()?.webContents.id) {
    throw new Error('Rejected: updates from a non-shell sender')
  }
}

export function registerUpdatesIpc(): void {
  handle(IpcChannel.UpdatesGetState, async (_payload, event) => {
    requireShell(event)
    return (await getUpdates()).getState()
  })
  handle(IpcChannel.UpdatesCheck, async (_payload, event) => {
    requireShell(event)
    return (await getUpdates()).check()
  })
  handle(IpcChannel.UpdatesDownload, async (_payload, event) => {
    requireShell(event)
    return (await getUpdates()).download()
  })
  handle(IpcChannel.UpdatesInstall, async (_payload, event) => {
    requireShell(event)
    return (await getUpdates()).install()
  })
}
