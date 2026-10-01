/// <reference types="vite/client" />
import type { ArztoolApi, ViewerToolbarApi } from '@shared/ipc/channels'

declare global {
  interface Window {
    /** Present in the shell window only. */
    readonly arztool: ArztoolApi
    /** Present in the viewer toolbar only. */
    readonly arztoolViewer: ViewerToolbarApi
  }
}
