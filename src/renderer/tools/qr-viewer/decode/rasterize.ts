import type { InputFormat } from '@shared/qr/input-format'
import type { Bounds } from './zxing'

/** Larger images are scaled down before decoding; zxing gains nothing above this. */
const MAX_DIMENSION = 4096

const MIME: Record<Exclude<InputFormat, 'pdf' | 'heic'>, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  bmp: 'image/bmp',
  gif: 'image/gif',
}

function context2d(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('2D canvas unavailable')
  return ctx
}

export async function rasterImage(
  bytes: Uint8Array,
  format: Exclude<InputFormat, 'pdf' | 'heic'>,
): Promise<ImageData> {
  const blob = new Blob([bytes as BlobPart], { type: MIME[format] })
  const probe = await createImageBitmap(blob)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(probe.width, probe.height))
  const width = Math.max(1, Math.round(probe.width * scale))
  const height = Math.max(1, Math.round(probe.height * scale))

  const canvas = new OffscreenCanvas(width, height)
  const ctx = context2d(canvas)
  // Transparent screenshots would otherwise decode as black-on-black.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(probe, 0, 0, width, height)
  probe.close()
  return ctx.getImageData(0, 0, width, height)
}

/** A small preview of one detected code, for the "pick a code" list. */
export async function cropThumbnail(image: ImageData, bounds: Bounds, size = 96): Promise<string> {
  const pad = Math.max(bounds.width, bounds.height) * 0.12
  const sx = Math.max(0, bounds.x - pad)
  const sy = Math.max(0, bounds.y - pad)
  const sw = Math.min(image.width - sx, bounds.width + pad * 2)
  const sh = Math.min(image.height - sy, bounds.height + pad * 2)

  const source = new OffscreenCanvas(image.width, image.height)
  context2d(source).putImageData(image, 0, 0)

  const thumb = new OffscreenCanvas(size, size)
  const ctx = context2d(thumb)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
  const fit = Math.min(size / sw, size / sh)
  const dw = sw * fit
  const dh = sh * fit
  ctx.drawImage(source, sx, sy, sw, sh, (size - dw) / 2, (size - dh) / 2, dw, dh)

  const blob = await thumb.convertToBlob({ type: 'image/png' })
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Thumbnail failed'))
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('Thumbnail failed'))
    }
    reader.readAsDataURL(blob)
  })
}
