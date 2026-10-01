import { getDocument, GlobalWorkerOptions, VerbosityLevel } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Bundled worker, served from app:// — never a CDN.
GlobalWorkerOptions.workerSrc = workerUrl

/** Render target for the longest page side, in pixels. Enough for small printed codes. */
const TARGET_PIXELS = 2600

export interface RenderedPdf {
  image: ImageData
  pageCount: number
}

/**
 * Render page 1 of a PDF to pixels. Loaded lazily (dynamic import) so pdf.js is
 * only fetched when a PDF is actually opened.
 */
export async function renderFirstPdfPage(bytes: Uint8Array): Promise<RenderedPdf> {
  const task = getDocument({
    data: bytes.slice(), // pdf.js transfers (detaches) the buffer it is given
    useWasm: false, // no wasm fetches; JS fallbacks cover scanned-image filters
    disableFontFace: true,
    useSystemFonts: false,
    enableXfa: false,
    verbosity: VerbosityLevel.ERRORS,
  })

  try {
    const doc = await task.promise
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({
      scale: TARGET_PIXELS / Math.max(base.width, base.height),
    })

    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    await page.render({ canvas, viewport, background: '#ffffff' }).promise

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('2D canvas unavailable')
    return { image: ctx.getImageData(0, 0, canvas.width, canvas.height), pageCount: doc.numPages }
  } finally {
    await task.destroy()
  }
}
