import { app, ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { IpcContract } from '@shared/ipc/channels'
import { IpcRequestSchemas } from '@shared/ipc/schemas'
import { isAppUrl } from '../app-protocol'

type Handler<C extends keyof IpcContract> = (
  payload: IpcContract[C]['request'],
  event: IpcMainInvokeEvent,
) => IpcContract[C]['response'] | Promise<IpcContract[C]['response']>

// The dev server origin is trusted only in unpackaged runs; a packaged app must
// not let an environment variable widen the set of trusted senders.
const devServerUrl = app.isPackaged ? undefined : process.env['ELECTRON_RENDERER_URL']

function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url
  return url !== undefined && isAppUrl(url, devServerUrl)
}

/**
 * Register an IPC handler that only answers Arztool's own renderer and only
 * after the payload has passed its zod schema.
 */
export function handle<C extends keyof IpcContract>(channel: C, handler: Handler<C>): void {
  const schema = IpcRequestSchemas[channel]
  ipcMain.handle(channel, async (event, raw: unknown) => {
    if (!isTrustedSender(event)) throw new Error(`Rejected ${channel}: untrusted sender`)
    const parsed = schema.safeParse(raw)
    if (!parsed.success) throw new Error(`Rejected ${channel}: invalid payload`)
    return handler(parsed.data, event)
  })
}
