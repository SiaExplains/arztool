import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import { QR_READER_OPTIONS } from '@shared/qr/reader-options'

// zxing-wasm fetches its .wasm from jsDelivr by default. Arztool never decodes
// over the network: point it at the copy bundled with the app.
prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) =>
      path.endsWith('.wasm') ? wasmUrl : prefix + path,
  },
})

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export interface DetectedCode {
  text: string
  bounds: Bounds
}

export async function readQrCodes(image: ImageData): Promise<DetectedCode[]> {
  const results = await readBarcodes(image, QR_READER_OPTIONS)
  return results
    .filter((result) => result.isValid)
    .map((result) => {
      const { topLeft, topRight, bottomLeft, bottomRight } = result.position
      const xs = [topLeft.x, topRight.x, bottomLeft.x, bottomRight.x]
      const ys = [topLeft.y, topRight.y, bottomLeft.y, bottomRight.y]
      const x = Math.min(...xs)
      const y = Math.min(...ys)
      return {
        text: result.text,
        bounds: { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y },
      }
    })
}
