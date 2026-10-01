import { join } from 'node:path'
import { app, BrowserWindow, nativeTheme } from 'electron'
import { PRELOAD_ROLE_ARG } from '@shared/ipc/channels'
import { APP_ORIGIN } from '../app-protocol'

let shellWindow: BrowserWindow | null = null

export function getShellWindow(): BrowserWindow | null {
  return shellWindow
}

export function createShellWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 520,
    show: false,
    title: 'Arztool',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f172a' : '#f8fafc',
    webPreferences: {
      preload: join(__dirname, '../preload/shell.js'),
      additionalArguments: [`${PRELOAD_ROLE_ARG}shell`],
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  })

  win.once('ready-to-show', () => {
    win.show()
  })
  win.on('closed', () => {
    shellWindow = null
  })

  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devServerUrl) {
    void win.loadURL(devServerUrl)
  } else {
    void win.loadURL(`${APP_ORIGIN}/index.html`)
  }

  shellWindow = win
  return win
}
