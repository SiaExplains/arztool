import { contextBridge, ipcRenderer } from 'electron'
import {
  IpcChannel,
  IpcEvent,
  PRELOAD_ROLE_ARG,
  type ArztoolApi,
  type PreloadRole,
  type ViewerState,
  type ViewerToolbarApi,
} from '@shared/ipc/channels'

/**
 * One preload bundle for all of Arztool's own pages (a second bundle would
 * share chunks, which sandboxed preloads cannot load). Main passes the role
 * via `additionalArguments`; each role gets only its own API. Main also
 * checks the sender of every message, so this is not the only gate.
 */
const role: PreloadRole = process.argv.includes(`${PRELOAD_ROLE_ARG}viewer-toolbar`)
  ? 'viewer-toolbar'
  : 'shell'

/** Subscribe without ever handing the IpcRendererEvent (it exposes `sender`) to the page. */
function subscribe(channel: string, deliver: (payload: unknown) => void): () => void {
  const wrapped = (_event: unknown, payload: unknown) => {
    deliver(payload)
  }
  ipcRenderer.on(channel, wrapped)
  return () => {
    ipcRenderer.removeListener(channel, wrapped)
  }
}

if (role === 'viewer-toolbar') {
  const api: ViewerToolbarApi = {
    getState: () => ipcRenderer.invoke(IpcChannel.ViewerGetState),
    command: (command) => ipcRenderer.invoke(IpcChannel.ViewerCommand, { command }),
    onState: (listener) =>
      subscribe(IpcEvent.ViewerState, (state) => {
        listener(state as ViewerState)
      }),
  }
  contextBridge.exposeInMainWorld('arztoolViewer', api)
} else {
  const api: ArztoolApi = {
    app: {
      getInfo: () => ipcRenderer.invoke(IpcChannel.AppGetInfo),
    },
    files: {
      openImage: () => ipcRenderer.invoke(IpcChannel.FileOpenImage),
      convertHeic: (bytes) => ipcRenderer.invoke(IpcChannel.ImageConvertHeic, { bytes }),
    },
    clipboard: {
      readImage: () => ipcRenderer.invoke(IpcChannel.ClipboardReadImage),
      writeText: (text) => ipcRenderer.invoke(IpcChannel.ClipboardWriteText, { text }),
    },
    menu: {
      onOpenImage: (listener) =>
        subscribe(IpcEvent.MenuOpenImage, () => {
          listener()
        }),
    },
    viewer: {
      open: (url) => ipcRenderer.invoke(IpcChannel.ViewerOpen, { url }),
    },
  }
  contextBridge.exposeInMainWorld('arztool', api)
}
