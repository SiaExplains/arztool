import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findImageInHtml, MAX_CLIPBOARD_HTML } from '@shared/qr/html-image'
import { sniffInputFormat } from '@shared/qr/input-format'

const png = readFileSync(resolve(__dirname, '../fixtures/single-https.png'))
const b64 = png.toString('base64')

describe('findImageInHtml', () => {
  it.each([
    ['double quotes', `<p>Befund</p><img src="data:image/png;base64,${b64}">`],
    ['single quotes', `<img alt='QR' src='data:image/png;base64,${b64}'/>`],
    ['unquoted', `<img src=data:image/png;base64,${b64}>`],
    ['upper-case tag and mime', `<IMG SRC="data:IMAGE/PNG;base64,${b64}">`],
    [
      'line-wrapped base64 (Outlook)',
      `<img src="data:image/png;base64,${b64.replace(/(.{76})/g, '$1\r\n')}">`,
    ],
    [
      'after a remote image',
      `<img src="https://x.de/logo.png"><img src="data:image/png;base64,${b64}">`,
    ],
  ])('extracts an inline image: %s', (_label, html) => {
    const result = findImageInHtml(html)
    expect(result.kind).toBe('image')
    if (result.kind === 'image') {
      expect(Buffer.from(result.bytes).equals(png)).toBe(true)
      expect(sniffInputFormat(result.bytes)).toBe('png')
    }
  })

  it.each([
    ['https', '<img src="https://portal.example.de/qr.png">'],
    ['email attachment', '<img src="cid:image001.png@01DB">'],
    ['blob', '<img src="blob:https://mail.example.de/1234">'],
  ])('reports a reference-only image (%s) without fetching it', (_label, html) => {
    expect(findImageInHtml(html)).toEqual({ kind: 'reference-only' })
  })

  it.each([
    ['plain text html', '<p>Befund-ID 4711</p>'],
    ['empty', ''],
    ['img without src', '<img alt="x">'],
    ['data-src lookalike attribute', `<img data-src="data:image/png;base64,${b64}">`],
  ])('finds nothing in %s', (_label, html) => {
    expect(findImageInHtml(html)).toEqual({ kind: 'none' })
  })

  it.each([
    [
      'SVG (can carry script)',
      `<img src="data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}">`,
    ],
    ['non-base64 data URL', '<img src="data:image/png,abc">'],
    ['broken base64', '<img src="data:image/png;base64,@@@@">'],
  ])('refuses %s', (_label, html) => {
    expect(findImageInHtml(html).kind).not.toBe('image')
  })

  it('ignores absurdly large HTML instead of scanning it', () => {
    expect(findImageInHtml('x'.repeat(MAX_CLIPBOARD_HTML + 1))).toEqual({ kind: 'none' })
  })
})
