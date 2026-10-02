import { useEffect, useRef, useState } from 'react'
import type { InputFile } from '@shared/ipc/channels'

async function fileToInput(file: File): Promise<InputFile> {
  return { name: file.name || 'image', bytes: new Uint8Array(await file.arrayBuffer()) }
}

/** Images and PDFs we can decode; anything else is skipped when several files arrive. */
function isDecodable(file: File): boolean {
  return file.type.startsWith('image/') || file.type === 'application/pdf'
}

/** First decodable file, or — for a single file of unknown type — that file (bytes are sniffed later). */
function pickFile(files: FileList | undefined): File | undefined {
  const list = Array.from(files ?? [])
  return list.find(isDecodable) ?? (list.length === 1 ? list[0] : undefined)
}

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement)
  )
}

interface Handlers {
  onFile: (file: InputFile) => void
  /** Paste event carried no image — ask main to read the system clipboard. */
  onPasteWithoutImage: () => void
  onMenuOpen: () => void
}

/**
 * Wires the three window-wide input sources: drag & drop anywhere, Cmd/Ctrl+V,
 * and File → Open from the app menu. Returns whether a drag is hovering.
 */
export function useInputSources(handlers: Handlers): { dragging: boolean } {
  const [dragging, setDragging] = useState(false)
  const latest = useRef(handlers)
  useEffect(() => {
    latest.current = handlers
  })

  useEffect(() => {
    // dragenter/dragleave fire for every child element; count to know when the
    // pointer really left the window.
    let depth = 0
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth += 1
      setDragging(true)
    }
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onDrop = (e: DragEvent) => {
      // Always prevent default: Chromium would otherwise try to open the file.
      e.preventDefault()
      depth = 0
      setDragging(false)
      const file = pickFile(e.dataTransfer?.files)
      if (file)
        void fileToInput(file).then((input) => {
          latest.current.onFile(input)
        })
    }
    const onPaste = (e: ClipboardEvent) => {
      if (isEditable(e.target)) return
      // Chromium exposes only the *first* copied file to the page. If that one is not
      // an image, main reads the whole clipboard (all files, image data, HTML).
      const file = Array.from(e.clipboardData?.files ?? []).find(isDecodable)
      e.preventDefault()
      if (file)
        void fileToInput(file).then((input) => {
          latest.current.onFile(input)
        })
      else latest.current.onPasteWithoutImage()
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    document.addEventListener('paste', onPaste)
    const unsubscribeMenu = window.arztool.menu.onOpenImage(() => {
      latest.current.onMenuOpen()
    })

    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
      document.removeEventListener('paste', onPaste)
      unsubscribeMenu()
    }
  }, [])

  return { dragging }
}
