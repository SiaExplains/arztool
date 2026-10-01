import type { ReaderOptions } from 'zxing-wasm/reader'

/**
 * One set of decoder options for the app and the unit tests, so the tests
 * exercise exactly what ships. Tuned for phone photos and screenshots of
 * printouts: small, rotated, low-contrast, inverted, several codes per image.
 */
export const QR_READER_OPTIONS = {
  formats: ['QRCode', 'MicroQRCode', 'RMQRCode'],
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
  tryDownscale: true,
  tryDenoise: true,
  maxNumberOfSymbols: 8,
} as const satisfies ReaderOptions
