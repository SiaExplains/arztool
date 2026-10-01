/**
 * Generates the QR fixtures in test/fixtures/. Output is committed, so CI never
 * needs to run this. Re-run after changing a payload:
 *
 *   node scripts/gen-fixtures.mts
 *
 * HEIC is produced with macOS `sips` and is skipped on other platforms.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'
import sharp from 'sharp'

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../test/fixtures')
mkdirSync(out, { recursive: true })

/** Payloads shared with the tests via test/fixtures/manifest.json. */
const PAYLOADS = {
  https: 'https://befund.radiologie-example.de/r/AbC123?token=8f3e2c1d',
  httpsSecond: 'https://portal.labor-example.de/ergebnis/77881',
  http: 'http://befund.radiologie-example.de/r/AbC123',
  javascript: 'javascript:alert(document.cookie)',
  data: 'data:text/html,<script>alert(1)</script>',
  idn: 'https://bеfund.radiologie-example.de/r/AbC123', // Cyrillic "е" (U+0435)
  text: 'Befund-ID 4711 · Zugangs-PIN 0815',
} as const

async function qrPng(text: string, opts: { width?: number; dark?: string; light?: string } = {}) {
  return QRCode.toBuffer(text, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 4,
    width: opts.width ?? 400,
    color: { dark: opts.dark ?? '#000000', light: opts.light ?? '#ffffff' },
  })
}

async function write(name: string, data: Buffer | Promise<Buffer>) {
  writeFileSync(join(out, name), await data)
  console.log('wrote', name)
}

/** Minimal 24-bit BMP writer — sharp has no BMP output. */
async function toBmp(png: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const rowSize = Math.ceil((info.width * 3) / 4) * 4
  const pixelBytes = rowSize * info.height
  const buf = Buffer.alloc(54 + pixelBytes)
  buf.write('BM', 0, 'ascii')
  buf.writeUInt32LE(54 + pixelBytes, 2)
  buf.writeUInt32LE(54, 10)
  buf.writeUInt32LE(40, 14)
  buf.writeInt32LE(info.width, 18)
  buf.writeInt32LE(info.height, 22)
  buf.writeUInt16LE(1, 26)
  buf.writeUInt16LE(24, 28)
  buf.writeUInt32LE(pixelBytes, 34)
  for (let y = 0; y < info.height; y++) {
    const srcRow = info.height - 1 - y // BMP rows are bottom-up
    for (let x = 0; x < info.width; x++) {
      const s = (srcRow * info.width + x) * 3
      const d = 54 + y * rowSize + x * 3
      buf[d] = data[s + 2] ?? 0 // BGR
      buf[d + 1] = data[s + 1] ?? 0
      buf[d + 2] = data[s] ?? 0
    }
  }
  return buf
}

/** Single-page PDF with one embedded JPEG (DCTDecode) filling an A4 page. */
async function toPdf(png: Buffer): Promise<Buffer> {
  const jpeg = await sharp(png).flatten({ background: '#ffffff' }).jpeg({ quality: 92 }).toBuffer()
  const { width, height } = await sharp(jpeg).metadata()
  const content = Buffer.from(`q 300 0 0 300 147 400 cm /Im0 Do Q`)
  const objects: Buffer[] = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    Buffer.from(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>',
    ),
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
      ),
      jpeg,
      Buffer.from('\nendstream'),
    ]),
    Buffer.concat([
      Buffer.from(`<< /Length ${content.length} >>\nstream\n`),
      content,
      Buffer.from('\nendstream'),
    ]),
  ]
  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary')]
  const offsets: number[] = []
  let length = parts[0]?.length ?? 0
  objects.forEach((body, i) => {
    offsets.push(length)
    const obj = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), body, Buffer.from('\nendobj\n')])
    parts.push(obj)
    length += obj.length
  })
  const xref =
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`
  parts.push(Buffer.from(xref))
  return Buffer.concat(parts)
}

const single = await qrPng(PAYLOADS.https)

await write('single-https.png', single)
await write('http.png', qrPng(PAYLOADS.http))
await write('javascript.png', qrPng(PAYLOADS.javascript))
await write('data-url.png', qrPng(PAYLOADS.data))
await write('idn-homograph.png', qrPng(PAYLOADS.idn))
await write('non-url.png', qrPng(PAYLOADS.text))

// Two codes side by side, as on a printout with result + lab portal.
const second = await qrPng(PAYLOADS.httpsSecond)
await write(
  'multiple.png',
  sharp({ create: { width: 900, height: 460, channels: 3, background: '#ffffff' } })
    .composite([
      { input: single, left: 30, top: 30 },
      { input: second, left: 470, top: 30 },
    ])
    .png()
    .toBuffer(),
)

// Rotated 33° — a phone photo of a tilted printout.
await write('rotated.png', sharp(single).rotate(33, { background: '#ffffff' }).png().toBuffer())

// Small, low-contrast, lossy — grey print photographed in poor light.
await write(
  'small-lowcontrast.jpg',
  sharp(await qrPng(PAYLOADS.https, { width: 150, dark: '#6b6b6b', light: '#c8c8c8' }))
    .jpeg({ quality: 70 })
    .toBuffer(),
)

// Screenshot-like: code inside a larger UI, saved as WEBP.
await write(
  'screenshot.webp',
  sharp({ create: { width: 1280, height: 800, channels: 3, background: '#e9edf2' } })
    .composite([
      {
        input: await sharp({
          create: { width: 1180, height: 60, channels: 3, background: '#2b5d8a' },
        })
          .png()
          .toBuffer(),
        left: 50,
        top: 40,
      },
      { input: await sharp(single).resize(260).toBuffer(), left: 900, top: 420 },
    ])
    .webp({ quality: 90 })
    .toBuffer(),
)

await write('single-https.bmp', toBmp(await sharp(single).resize(240).toBuffer()))
await write('single-https.pdf', toPdf(single))

// No code at all.
await write(
  'no-qr.png',
  sharp({ create: { width: 400, height: 300, channels: 3, background: '#d7e3ec' } })
    .png()
    .toBuffer(),
)

if (process.platform === 'darwin') {
  const tmp = join(out, '.tmp-heic-src.png')
  writeFileSync(tmp, single)
  try {
    execFileSync('sips', ['-s', 'format', 'heic', tmp, '--out', join(out, 'single-https.heic')], {
      stdio: 'ignore',
    })
    console.log('wrote single-https.heic')
  } finally {
    rmSync(tmp, { force: true })
  }
} else {
  console.log('skipped single-https.heic (needs macOS sips)')
}

writeFileSync(join(out, 'manifest.json'), JSON.stringify(PAYLOADS, null, 2) + '\n')
console.log('wrote manifest.json')
