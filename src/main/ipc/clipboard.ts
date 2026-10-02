import { fileURLToPath } from 'node:url'
import { clipboard, type ClipboardItem } from 'electron'
import { IpcChannel, type ReadClipboardImageResult } from '@shared/ipc/channels'
import { findImageInHtml, MAX_CLIPBOARD_HTML } from '@shared/qr/html-image'
import { MAX_INPUT_BYTES } from '@shared/qr/input-format'
import { readInputFile } from '../input-file'
import { handle } from './handle'

/** Enough for any realistic multi-selection; we only need the first usable one. */
const MAX_COPIED_FILES = 20

/** Files copied in Finder / Explorer arrive as `text/uri-list`. */
async function copiedFilePaths(item: ClipboardItem): Promise<string[] | null> {
  if (!item.types.includes('text/uri-list')) return null
  const list = await (await item.getType('text/uri-list')).text()
  return list
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('file:'))
    .slice(0, MAX_COPIED_FILES)
    .map((url) => fileURLToPath(url))
}

/**
 * Order matters:
 *  1. Copied files — every path we are given is tried. (On macOS Electron 44
 *     exposes only the *first* copied file, so "notes.txt" + "qr.png" cannot
 *     be helped there; the user is told to copy just the image.) If files were
 *     copied but none is usable, stop: Finder also offers the files' *icon* as
 *     an image, which must never be decoded instead.
 *  2. Image data — Chromium already converts TIFF/JPEG/HEIC/PDF data to PNG.
 *  3. HTML — a selection from webmail/Office may carry the picture inline as
 *     a data: URL; a mere link to an image is reported, never fetched.
 */
async function readClipboardImage(): Promise<ReadClipboardImageResult> {
  const [item] = await clipboard.read()
  if (!item) return { status: 'empty' }

  const paths = await copiedFilePaths(item)
  if (paths && paths.length > 0) {
    for (const path of paths) {
      const result = await readInputFile(path)
      if (result.status === 'ok') return result
    }
    return { status: 'no-image-file' }
  }

  if (item.types.includes('image/png')) {
    const blob = await item.getType('image/png')
    if (blob.size > 0 && blob.size <= MAX_INPUT_BYTES) {
      return {
        status: 'ok',
        file: { name: 'clipboard.png', bytes: new Uint8Array(await blob.arrayBuffer()) },
      }
    }
  }

  if (item.types.includes('text/html')) {
    const blob = await item.getType('text/html')
    if (blob.size <= MAX_CLIPBOARD_HTML) {
      const found = findImageInHtml(await blob.text())
      if (found.kind === 'image')
        return { status: 'ok', file: { name: 'clipboard', bytes: found.bytes } }
      if (found.kind === 'reference-only') return { status: 'reference-only' }
    }
  }

  return { status: 'empty' }
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
