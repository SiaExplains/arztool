import { app, Menu, type MenuItemConstructorOptions } from 'electron'
import { IpcEvent } from '@shared/ipc/channels'
import { t } from './i18n'
import { getShellWindow } from './windows/shell'

function sendToShell(channel: string): void {
  const win = getShellWindow()
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
  win.webContents.send(channel)
}

/**
 * The Edit menu is not optional: on macOS, Cmd+V/C/X/A only reach web content
 * through menu roles.
 */
export function installAppMenu(): void {
  const isMac = process.platform === 'darwin'

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: t(isMac ? 'menu.fileMac' : 'menu.file'),
      submenu: [
        {
          id: 'open-image',
          label: t('menu.openImage'),
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            sendToShell(IpcEvent.MenuOpenImage)
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      role: 'viewMenu',
      submenu: [
        ...(app.isPackaged
          ? []
          : ([
              { role: 'reload' },
              { role: 'toggleDevTools' },
              { type: 'separator' },
            ] satisfies MenuItemConstructorOptions[])),
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
