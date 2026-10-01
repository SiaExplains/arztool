/// <reference types="vite/client" />
import type { ArztoolApi } from '@shared/ipc/channels'

declare global {
  interface Window {
    readonly arztool: ArztoolApi
  }
}
