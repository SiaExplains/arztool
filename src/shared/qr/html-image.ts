import { MAX_INPUT_BYTES } from './input-format'

/**
 * Some apps put a copied picture on the clipboard as HTML only — a selection
 * from webmail, Outlook or a web page. Two shapes matter:
 *
 *  - `<img src="data:image/png;base64,…">`: the image is inside the HTML and can
 *    be decoded locally.
 *  - `<img src="https://…">` / `cid:` / `blob:`: only a reference. Fetching it
 *    would be a network call (never done for decoding), so the user is told how
 *    to copy the actual image instead.
 *
 * Only `src` attribute values are read; the HTML is never rendered.
 */
export type HtmlImageResult =
  { kind: 'image'; bytes: Uint8Array } | { kind: 'reference-only' } | { kind: 'none' }

const IMG_SRC_RE = /<img\b[^>]*?\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi
// Raster formats only: SVG can carry script and is not a photo of a QR code anyway.
const DATA_IMAGE_RE = /^data:image\/(png|jpeg|jpg|webp|gif|bmp);base64,([a-z0-9+/=\s]+)$/i

/** Longest HTML we look at; clipboard HTML with a 50 MB image is ~67 MB of base64. */
export const MAX_CLIPBOARD_HTML = Math.ceil((MAX_INPUT_BYTES * 4) / 3) + 64 * 1024

function decodeBase64(base64: string): Uint8Array | null {
  try {
    const binary = atob(base64.replace(/\s+/g, ''))
    if (binary.length === 0 || binary.length > MAX_INPUT_BYTES) return null
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

export function findImageInHtml(html: string): HtmlImageResult {
  if (html.length === 0 || html.length > MAX_CLIPBOARD_HTML) return { kind: 'none' }
  let sawReference = false
  for (const match of html.matchAll(IMG_SRC_RE)) {
    const src = (match[1] ?? match[2] ?? match[3] ?? '').trim()
    if (src === '') continue
    const data = DATA_IMAGE_RE.exec(src)
    if (data?.[2]) {
      const bytes = decodeBase64(data[2])
      if (bytes) return { kind: 'image', bytes }
    } else {
      sawReference = true
    }
  }
  return sawReference ? { kind: 'reference-only' } : { kind: 'none' }
}
