import { fileURLToPath } from 'node:url'
import { clipboard, type ClipboardItem } from 'electron'
import { IpcChannel, type ReadClipboardImageResult } from '@shared/ipc/channels'
import { MAX_INPUT_BYTES } from '@shared/qr/input-format'
import { readInputFile } from '../input-file'
import { handle } from './handle'

/**
 * A file copied in Finder / Explorer arrives as `text/uri-list`. It must win
 * over `image/png`: Finder also offers the file's *icon* as an image, which
 * would otherwise be decoded instead of the file.
 */
async function copiedFilePath(item: ClipboardItem): Promise<string | null> {
  if (!item.types.includes('text/uri-list')) return null
  const list = await (await item.getType('text/uri-list')).text()
  const first = list
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line !== '' && !line.startsWith('#'))
  return first?.startsWith('file:') ? fileURLToPath(first) : null
}

async function readClipboardImage(): Promise<ReadClipboardImageResult> {
  const [item] = await clipboard.read()
  if (!item) return { status: 'empty' }

  const path = await copiedFilePath(item)
  if (path) {
    const result = await readInputFile(path)
    // A copied non-image file is "nothing to paste", not an app error.
    return result.status === 'ok' ? result : { status: 'empty' }
  }

  if (!item.types.includes('image/png')) return { status: 'empty' }
  const blob = await item.getType('image/png')
  if (blob.size === 0 || blob.size > MAX_INPUT_BYTES) return { status: 'empty' }
  return {
    status: 'ok',
    file: { name: 'clipboard.png', bytes: new Uint8Array(await blob.arrayBuffer()) },
  }
}

export function registerClipboardIpc(): void {
  handle(IpcChannel.ClipboardReadImage, async () => {
    try {
      return await readClipboardImage()
    } catch {
      return { status: 'empty' }
    }
  })

  handle(IpcChannel.ClipboardWriteText, async ({ text }) => {
    await clipboard.writeText(text)
    return undefined
  })
}
