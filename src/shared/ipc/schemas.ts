import { z } from 'zod'
import { MAX_INPUT_BYTES } from '../qr/input-format'
import { IpcChannel, type IpcContract } from './channels'

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
} as const satisfies { [C in keyof IpcContract]: z.ZodType<IpcContract[C]['request']> }
