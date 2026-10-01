import { readFile, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import type { InputError, InputFile } from '@shared/ipc/channels'
import { MAX_INPUT_BYTES, sniffInputFormat } from '@shared/qr/input-format'
import { convertHeicToPng } from './heic'

export type ReadInputResult =
  { status: 'ok'; file: InputFile } | { status: 'error'; error: InputError }

/**
 * Read a user-chosen file for decoding. HEIC is converted here so the renderer
 * only ever receives formats Chromium can decode.
 */
export async function readInputFile(path: string): Promise<ReadInputResult> {
  try {
    const info = await stat(path)
    if (!info.isFile()) return { status: 'error', error: 'read-failed' }
    if (info.size > MAX_INPUT_BYTES) return { status: 'error', error: 'too-large' }

    const bytes = new Uint8Array(await readFile(path))
    const name = basename(path)
    if (sniffInputFormat(bytes) !== 'heic') return { status: 'ok', file: { name, bytes } }

    const converted = await convertHeicToPng(bytes)
    return converted.status === 'ok'
      ? { status: 'ok', file: { name, bytes: converted.bytes } }
      : converted
  } catch {
    return { status: 'error', error: 'read-failed' }
  }
}
