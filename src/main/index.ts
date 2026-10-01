import { join } from 'node:path'
import { app, BrowserWindow, session } from 'electron'
import { registerAppIpc } from './ipc/app'
import { registerAppProtocol, registerAppSchemePrivileges } from './protocol'
import { hardenSession, installGlobalGuards } from './security'
import { createShellWindow, getShellWindow } from './windows/shell'

registerAppSchemePrivileges()
app.enableSandbox()

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  installGlobalGuards()

  app.on('second-instance', () => {
    const win = getShellWindow()
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  void app.whenReady().then(() => {
    if (process.platform === 'win32') app.setAppUserModelId('de.arztool.app')

    hardenSession(session.defaultSession)
    registerAppProtocol(join(__dirname, '../renderer'))
    registerAppIpc()
    createShellWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createShellWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
