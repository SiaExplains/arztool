import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel, IpcEvent, type ArztoolApi } from '@shared/ipc/channels'

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
    onOpenImage: (listener) => {
      // Wrap so the renderer never receives the IpcRendererEvent (it exposes `sender`).
      const wrapped = () => {
        listener()
      }
      ipcRenderer.on(IpcEvent.MenuOpenImage, wrapped)
      return () => {
        ipcRenderer.removeListener(IpcEvent.MenuOpenImage, wrapped)
      }
    },
  },
}

contextBridge.exposeInMainWorld('arztool', api)
