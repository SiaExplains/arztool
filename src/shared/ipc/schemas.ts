import { z } from 'zod'
import { MAX_INPUT_BYTES } from '../qr/input-format'
import { SettingsPatchSchema } from '../settings'
import { IpcChannel, VIEWER_COMMANDS, type IpcContract } from './channels'

/** Longest URL accepted for the viewer (a QR code holds < 8 KB). */
export const MAX_URL_LENGTH = 8192

/** Longest text the renderer may put on the clipboard (a QR code holds < 8 KB). */
export const MAX_CLIPBOARD_TEXT = 16 * 1024

const bytes = z
  .custom<Uint8Array>((value) => value instanceof Uint8Array, 'Expected Uint8Array')
  .refine((value) => value.byteLength > 0 && value.byteLength <= MAX_INPUT_BYTES, 'Bad size')

/**
 * Runtime validation for every inbound IPC payload. The `satisfies` clause
 * makes the build fail if a channel is added to the contract without a schema,
 * or if a schema drifts from its declared request type.
 */
export const IpcRequestSchemas = {
  [IpcChannel.AppGetInfo]: z.undefined(),
  [IpcChannel.FileOpenImage]: z.undefined(),
  [IpcChannel.ImageConvertHeic]: z.strictObject({ bytes }),
  [IpcChannel.ClipboardReadImage]: z.undefined(),
  [IpcChannel.ClipboardWriteText]: z.strictObject({
    text: z.string().max(MAX_CLIPBOARD_TEXT),
  }),
  [IpcChannel.ViewerOpen]: z.strictObject({ url: z.string().min(1).max(MAX_URL_LENGTH) }),
  [IpcChannel.ViewerGetState]: z.undefined(),
  [IpcChannel.ViewerCommand]: z.strictObject({ command: z.enum(VIEWER_COMMANDS) }),
  [IpcChannel.SettingsGet]: z.undefined(),
  [IpcChannel.SettingsUpdate]: SettingsPatchSchema,
  [IpcChannel.HistoryList]: z.undefined(),
  [IpcChannel.HistoryClear]: z.undefined(),
} as const satisfies { [C in keyof IpcContract]: z.ZodType<IpcContract[C]['request']> }
