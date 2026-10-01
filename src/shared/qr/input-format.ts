/**
 * Input files are identified by their magic bytes, never by extension or the
 * MIME type a drag source claims: a screenshot pasted from another app often
 * arrives as "image.png" regardless of its real format.
 */
export type InputFormat = 'png' | 'jpeg' | 'webp' | 'bmp' | 'gif' | 'pdf' | 'heic'

/** 50 MB — far above any real scan or screenshot, low enough to keep memory sane. */
export const MAX_INPUT_BYTES = 50 * 1024 * 1024

/** Extensions offered in the file picker. */
export const PICKER_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'webp',
  'bmp',
  'gif',
  'pdf',
  'heic',
  'heif',
] as const

const HEIF_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1'])

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length))
}

export function sniffInputFormat(bytes: Uint8Array): InputFormat | null {
  if (bytes.length < 12) return null
  const b = (i: number) => bytes[i] ?? -1

  if (b(0) === 0x89 && ascii(bytes, 1, 3) === 'PNG') return 'png'
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return 'jpeg'
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'webp'
  if (ascii(bytes, 0, 2) === 'BM') return 'bmp'
  if (ascii(bytes, 0, 4) === 'GIF8') return 'gif'
  if (ascii(bytes, 0, 5) === '%PDF-') return 'pdf'
  if (ascii(bytes, 4, 4) === 'ftyp' && HEIF_BRANDS.has(ascii(bytes, 8, 4))) return 'heic'
  return null
}
