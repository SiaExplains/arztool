import type { IpcMainInvokeEvent } from 'electron'
import { IpcChannel } from '@shared/ipc/channels'
import { clearHistory, getSettings, listHistory, updateSettings } from '../settings'
import { getShellWindow } from '../windows/shell'
import { handle } from './handle'

/** Settings and history belong to the shell; the viewer toolbar may not touch them. */
function requireShell(event: IpcMainInvokeEvent): void {
  if (event.sender.id !== getShellWindow()?.webContents.id) {
    throw new Error('Rejected: settings/history from a non-shell sender')
  }
}

export function registerSettingsIpc(): void {
  handle(IpcChannel.SettingsGet, (_payload, event) => {
    requireShell(event)
    return getSettings()
  })

  handle(IpcChannel.SettingsUpdate, async (patch, event) => {
    requireShell(event)
    const result = await updateSettings(patch)
    return result.ok
      ? { status: 'ok', settings: result.settings }
      : { status: 'invalid-domains', invalidDomains: result.invalidDomains }
  })

  handle(IpcChannel.HistoryList, (_payload, event) => {
    requireShell(event)
    return listHistory()
  })

  handle(IpcChannel.HistoryClear, async (_payload, event) => {
    requireShell(event)
    await clearHistory()
    return undefined
  })
}
