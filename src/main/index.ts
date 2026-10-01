import { join } from 'node:path'
import { app, BrowserWindow, session } from 'electron'
import { registerAppIpc } from './ipc/app'
import { registerClipboardIpc } from './ipc/clipboard'
import { registerFileIpc } from './ipc/files'
import { registerSettingsIpc } from './ipc/settings'
import { registerViewerIpc } from './ipc/viewer'
import { setMainLanguage } from './i18n'
import { installAppMenu } from './menu'
import { getSettings, onSettingsChanged } from './settings'
import { registerAppProtocol, registerAppSchemePrivileges } from './protocol'
import { hardenSession, installGlobalGuards } from './security'
import { createShellWindow, getShellWindow } from './windows/shell'
import { refreshAllViewers } from './windows/viewer'

registerAppSchemePrivileges()
app.enableSandbox()

// Tests and parallel dev runs get their own profile (and therefore their own
// single-instance lock). Ignored in packaged builds.
const devUserData = process.env['ARZTOOL_USER_DATA_DIR']
if (!app.isPackaged && devUserData) app.setPath('userData', devUserData)

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
    registerFileIpc()
    registerClipboardIpc()
    registerViewerIpc()
    registerSettingsIpc()

    setMainLanguage(getSettings().language)
    installAppMenu()
    onSettingsChanged((settings) => {
      setMainLanguage(settings.language)
      installAppMenu()
      refreshAllViewers()
    })
    createShellWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createShellWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
