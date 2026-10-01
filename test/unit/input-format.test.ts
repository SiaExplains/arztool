import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sniffInputFormat } from '@shared/qr/input-format'

const fixture = (name: string) =>
  new Uint8Array(readFileSync(resolve(__dirname, '../fixtures', name)))

describe('sniffInputFormat', () => {
  it.each([
    ['single-https.png', 'png'],
    ['small-lowcontrast.jpg', 'jpeg'],
    ['screenshot.webp', 'webp'],
    ['single-https.bmp', 'bmp'],
    ['single-https.pdf', 'pdf'],
    ['single-https.heic', 'heic'],
  ])('%s → %s', (name, format) => {
    expect(sniffInputFormat(fixture(name))).toBe(format)
  })

  it('detects GIF', () => {
    expect(sniffInputFormat(new TextEncoder().encode('GIF89a\x01\x00\x01\x00\x00\x00'))).toBe('gif')
  })

  it.each([
    ['empty', new Uint8Array()],
    ['too short', new Uint8Array([0x89, 0x50])],
    ['plain text', new TextEncoder().encode('just some text, not an image')],
    ['zip', new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0])],
    ['mp4 (ftyp but not HEIF)', new TextEncoder().encode('\0\0\0\x18ftypisom\0\0\0\0')],
  ])('rejects %s', (_label, bytes) => {
    expect(sniffInputFormat(bytes)).toBeNull()
  })
})
