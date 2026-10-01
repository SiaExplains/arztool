import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'
import { classifyPayload } from '@shared/qr/payload'
import { QR_READER_OPTIONS } from '@shared/qr/reader-options'

const fixtures = resolve(__dirname, '../fixtures')
const manifest = JSON.parse(readFileSync(resolve(fixtures, 'manifest.json'), 'utf8')) as Record<
  string,
  string
>

async function decode(name: string): Promise<string[]> {
  const bytes = new Uint8Array(readFileSync(resolve(fixtures, name)))
  const results = await readBarcodes(bytes, QR_READER_OPTIONS)
  return results.filter((r) => r.isValid).map((r) => r.text)
}

beforeAll(async () => {
  // Feed the bundled binary directly — the library default is a CDN fetch.
  const wasmPath = createRequire(import.meta.url).resolve('zxing-wasm/reader/zxing_reader.wasm')
  const wasm = readFileSync(wasmPath)
  await prepareZXingModule({
    overrides: {
      wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength),
    },
    fireImmediately: true,
  })
})

describe('QR decoding against fixtures', () => {
  it.each([
    ['single-https.png', 'https'],
    ['single-https.bmp', 'https'],
    ['rotated.png', 'https'],
    ['small-lowcontrast.jpg', 'https'],
    ['http.png', 'http'],
    ['javascript.png', 'javascript'],
    ['data-url.png', 'data'],
    ['idn-homograph.png', 'idn'],
    ['non-url.png', 'text'],
  ])('%s decodes to the %s payload', async (file, key) => {
    expect(await decode(file)).toEqual([manifest[key]])
  })

  it('finds both codes on a printout with two codes', async () => {
    expect((await decode('multiple.png')).sort()).toEqual(
      [manifest['https'], manifest['httpsSecond']].sort(),
    )
  })

  it('finds nothing in an image without a code', async () => {
    expect(await decode('no-qr.png')).toEqual([])
  })

  it('classifies decoded fixture payloads correctly', async () => {
    const [url] = await decode('single-https.png')
    const [text] = await decode('non-url.png')
    const [script] = await decode('javascript.png')
    expect(classifyPayload(url ?? '').kind).toBe('url')
    expect(classifyPayload(text ?? '').kind).toBe('text')
    expect(classifyPayload(script ?? '').kind).toBe('url') // kept as a link so M3 can block it
  })
})
