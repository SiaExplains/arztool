import type { IpcMainInvokeEvent } from 'electron'
import { IpcChannel } from '@shared/ipc/channels'
import { assessUrl } from '@shared/url-safety'
import { getShellWindow } from '../windows/shell'
import { openViewerWindow, viewerForToolbar, type Viewer } from '../windows/viewer'
import { handle } from './handle'

function requireToolbar(event: IpcMainInvokeEvent): Viewer {
  const viewer = viewerForToolbar(event.sender)
  if (!viewer) throw new Error('Rejected: sender is not a viewer toolbar')
  return viewer
}

export function registerViewerIpc(): void {
  handle(IpcChannel.ViewerOpen, ({ url }, event) => {
    // Only the shell's confirmation flow may open viewers.
    if (event.sender.id !== getShellWindow()?.webContents.id) {
      throw new Error('Rejected: viewer:open from a non-shell sender')
    }
    // Re-assess in main: the renderer's verdict is never trusted.
    const assessment = assessUrl(url)
    if (assessment.verdict === 'block' || assessment.href === null) return { status: 'blocked' }
    openViewerWindow(assessment.href)
    return { status: 'opened' }
  })

  handle(IpcChannel.ViewerGetState, (_payload, event) => requireToolbar(event).state())

  handle(IpcChannel.ViewerCommand, ({ command }, event) => {
    requireToolbar(event).run(command)
    return undefined
  })
}
