import type { ComponentType } from 'react'
import type { ParseKeys } from 'i18next'
import { QrViewerTool } from './qr-viewer/QrViewerTool'

/**
 * A tool is a self-contained feature mounted by the shell. Adding a tool means
 * adding a folder under tools/ and one entry here — the shell knows nothing else.
 */
export interface ToolDefinition {
  id: string
  titleKey: ParseKeys
  descriptionKey: ParseKeys
  Component: ComponentType
}

export const tools: readonly ToolDefinition[] = [
  {
    id: 'qr-viewer',
    titleKey: 'tools.qrViewer.title',
    descriptionKey: 'tools.qrViewer.description',
    Component: QrViewerTool,
  },
]
