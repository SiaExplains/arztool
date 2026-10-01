import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel, type ArztoolApi } from '@shared/ipc/channels'

const api: ArztoolApi = {
  app: {
    getInfo: () => ipcRenderer.invoke(IpcChannel.AppGetInfo),
  },
}

contextBridge.exposeInMainWorld('arztool', api)
