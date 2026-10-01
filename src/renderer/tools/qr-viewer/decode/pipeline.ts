import type { InputError, InputFile } from '@shared/ipc/channels'
import { MAX_INPUT_BYTES, sniffInputFormat, type InputFormat } from '@shared/qr/input-format'
import { classifyPayload, type ClassifiedPayload } from '@shared/qr/payload'
import { cropThumbnail, rasterImage } from './rasterize'
import { readQrCodes } from './zxing'

export type DecodeError = InputError | 'decode-failed' | 'pdf-failed'

export interface SourceInfo {
  name: string
  format: InputFormat
  /** Set for PDFs; only page 1 is decoded. */
  pageCount?: number
}

export interface FoundCode {
  id: string
  raw: string
  payload: ClassifiedPayload
  thumbnail: string | null
}

export type DecodeOutcome =
  | { kind: 'error'; error: DecodeError }
  | { kind: 'none'; source: SourceInfo }
  | { kind: 'found'; source: SourceInfo; codes: FoundCode[] }

async function toImage(
  file: InputFile,
  format: InputFormat,
): Promise<{ image: ImageData; pageCount?: number } | { error: DecodeError }> {
  if (format === 'pdf') {
    try {
      const { renderFirstPdfPage } = await import('./pdf')
      return await renderFirstPdfPage(file.bytes)
    } catch {
      return { error: 'pdf-failed' }
    }
  }

  let bytes = file.bytes
  let rasterFormat: Exclude<InputFormat, 'pdf' | 'heic'>
  if (format === 'heic') {
    const converted = await window.arztool.files.convertHeic(bytes)
    if (converted.status === 'error') return { error: converted.error }
    bytes = converted.bytes
    rasterFormat = 'png'
  } else {
    rasterFormat = format
  }

  try {
    return { image: await rasterImage(bytes, rasterFormat) }
  } catch {
    return { error: 'decode-failed' }
  }
}

export async function decodeInput(file: InputFile): Promise<DecodeOutcome> {
  if (file.bytes.byteLength > MAX_INPUT_BYTES) return { kind: 'error', error: 'too-large' }

  const format = sniffInputFormat(file.bytes)
  if (!format) return { kind: 'error', error: 'unsupported-format' }

  const raster = await toImage(file, format)
  if ('error' in raster) return { kind: 'error', error: raster.error }

  const source: SourceInfo = {
    name: file.name,
    format,
    ...(raster.pageCount === undefined ? {} : { pageCount: raster.pageCount }),
  }

  let detected
  try {
    detected = await readQrCodes(raster.image)
  } catch {
    return { kind: 'error', error: 'decode-failed' }
  }
  if (detected.length === 0) return { kind: 'none', source }

  const codes = await Promise.all(
    detected.map(async (code, index) => ({
      id: `${String(index)}:${code.text}`,
      raw: code.text,
      payload: classifyPayload(code.text),
      thumbnail:
        detected.length > 1
          ? await cropThumbnail(raster.image, code.bounds).catch(() => null)
          : null,
    })),
  )
  return { kind: 'found', source, codes }
}
